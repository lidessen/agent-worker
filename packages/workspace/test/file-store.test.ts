import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { FileWorkspaceStateStore } from "../src/state/file-store.ts";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "aw-file-store-"));
});

afterEach(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe("FileWorkspaceStateStore", () => {
  test("createTask round-trips through a fresh store instance", async () => {
    const first = new FileWorkspaceStateStore(dir);
    await first.ready;
    const created = await first.createTask({
      workspaceId: "w1",
      title: "Ship it",
      goal: "Merge PR",
    });

    // New instance pointed at the same dir should replay the task on startup.
    const second = new FileWorkspaceStateStore(dir);
    await second.ready;
    const replayed = await second.getTask(created.id);

    expect(replayed).not.toBeNull();
    expect(replayed?.title).toBe("Ship it");
    expect(replayed?.goal).toBe("Merge PR");
    expect(replayed?.status).toBe("draft");
  });

  test("updateTask persists the last snapshot under last-write-wins semantics", async () => {
    const first = new FileWorkspaceStateStore(dir);
    await first.ready;
    const task = await first.createTask({ workspaceId: "w1", title: "t", goal: "g" });

    await first.updateTask(task.id, { status: "open", priority: 1 });
    await first.updateTask(task.id, { status: "in_progress", priority: 2 });

    const second = new FileWorkspaceStateStore(dir);
    await second.ready;
    const replayed = await second.getTask(task.id);
    expect(replayed?.status).toBe("in_progress");
    expect(replayed?.priority).toBe(2);
  });

  test("attempt lifecycle replays correctly", async () => {
    const first = new FileWorkspaceStateStore(dir);
    await first.ready;
    const task = await first.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const attempt = await first.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });
    await first.updateAttempt(attempt.id, {
      status: "completed",
      resultSummary: "ok",
      endedAt: Date.now(),
    });

    const second = new FileWorkspaceStateStore(dir);
    await second.ready;
    const replayed = await second.getAttempt(attempt.id);
    expect(replayed?.status).toBe("completed");
    expect(replayed?.resultSummary).toBe("ok");
    expect(replayed?.endedAt).toBeGreaterThan(0);
  });

  test("handoffs and artifacts replay with task cross-refs intact", async () => {
    const first = new FileWorkspaceStateStore(dir);
    await first.ready;
    const task = await first.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const attempt = await first.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });
    await first.createHandoff({
      taskId: task.id,
      fromAttemptId: attempt.id,
      createdBy: "codex",
      kind: "progress",
      summary: "halfway",
      completed: ["step 1"],
    });
    await first.createArtifact({
      taskId: task.id,
      createdByAttemptId: attempt.id,
      kind: "file",
      title: "diff.patch",
      ref: "file:/tmp/diff.patch",
    });

    const second = new FileWorkspaceStateStore(dir);
    await second.ready;

    const handoffs = await second.listHandoffs(task.id);
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]!.summary).toBe("halfway");

    const artifacts = await second.listArtifacts(task.id);
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]!.title).toBe("diff.patch");

    // The owning task should have been re-persisted with the artifact ref
    // so replay picks it up too.
    const replayedTask = await second.getTask(task.id);
    expect(replayedTask?.artifactRefs).toEqual([artifacts[0]!.id]);
  });

  test("listTasks filter applies across replay", async () => {
    const first = new FileWorkspaceStateStore(dir);
    await first.ready;
    await first.createTask({ workspaceId: "w1", title: "a", goal: "g" });
    await first.createTask({ workspaceId: "w1", title: "b", goal: "g", status: "open" });
    await first.createTask({ workspaceId: "w1", title: "c", goal: "g", status: "open" });

    const second = new FileWorkspaceStateStore(dir);
    await second.ready;
    const open = await second.listTasks({ status: ["open"] });
    expect(open.map((t) => t.title)).toEqual(["b", "c"]);
  });

  test("rejects creating an attempt for an unknown task after replay", async () => {
    const first = new FileWorkspaceStateStore(dir);
    await first.ready;
    // No tasks created.
    const second = new FileWorkspaceStateStore(dir);
    await second.ready;
    await expect(
      second.createAttempt({ taskId: "task_missing", agentName: "codex", role: "worker" }),
    ).rejects.toThrow("task not found");
  });
});
