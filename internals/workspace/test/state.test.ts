import { describe, test, expect } from "bun:test";
import { InMemoryWorkspaceStateStore } from "../src/state/index.ts";

function freshStore() {
  return new InMemoryWorkspaceStateStore();
}

describe("InMemoryWorkspaceStateStore — Task", () => {
  test("createTask defaults status to draft and auto-fills id/timestamps", async () => {
    const store = freshStore();
    const task = await store.createTask({
      workspaceId: "w1",
      title: "Write tests",
      goal: "Add state store unit tests",
    });

    expect(task.id).toMatch(/^task_/);
    expect(task.status).toBe("draft");
    expect(task.artifactRefs).toEqual([]);
    expect(task.sourceRefs).toEqual([]);
    expect(task.createdAt).toBeGreaterThan(0);
    expect(task.updatedAt).toBe(task.createdAt);
  });

  test("updateTask rejects unknown id", async () => {
    const store = freshStore();
    await expect(store.updateTask("task_missing", { title: "x" })).rejects.toThrow("not found");
  });

  test("updateTask preserves id, workspaceId, createdAt and refreshes updatedAt", async () => {
    const store = freshStore();
    const task = await store.createTask({
      workspaceId: "w1",
      title: "t",
      goal: "g",
    });

    // Wait a tick so updatedAt is guaranteed distinct.
    await new Promise((r) => setTimeout(r, 5));
    const next = await store.updateTask(task.id, {
      status: "open",
      title: "t'",
      // Attempting to change workspaceId at compile time is prevented by
      // TaskPatch's Omit. This test only verifies the runtime invariants.
    });

    expect(next.id).toBe(task.id);
    expect(next.workspaceId).toBe("w1");
    expect(next.createdAt).toBe(task.createdAt);
    expect(next.updatedAt).toBeGreaterThan(task.createdAt);
    expect(next.status).toBe("open");
    expect(next.title).toBe("t'");
  });

  test("listTasks filters by status and returns creation-time order", async () => {
    const store = freshStore();
    const a = await store.createTask({ workspaceId: "w1", title: "a", goal: "g" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.createTask({
      workspaceId: "w1",
      title: "b",
      goal: "g",
      status: "open",
    });
    await new Promise((r) => setTimeout(r, 5));
    const c = await store.createTask({
      workspaceId: "w1",
      title: "c",
      goal: "g",
      status: "open",
    });

    const all = await store.listTasks();
    expect(all.map((t) => t.id)).toEqual([a.id, b.id, c.id]);

    const openOnly = await store.listTasks({ status: ["open"] });
    expect(openOnly.map((t) => t.id)).toEqual([b.id, c.id]);
  });

  test("listTasks filters by ownerLeadId", async () => {
    const store = freshStore();
    await store.createTask({ workspaceId: "w1", title: "x", goal: "g", ownerLeadId: "lead-a" });
    await store.createTask({ workspaceId: "w1", title: "y", goal: "g", ownerLeadId: "lead-b" });

    const ownedByA = await store.listTasks({ ownerLeadId: "lead-a" });
    expect(ownedByA).toHaveLength(1);
    expect(ownedByA[0]!.title).toBe("x");
  });
});

describe("InMemoryWorkspaceStateStore — Attempt", () => {
  test("createAttempt requires an existing task", async () => {
    const store = freshStore();
    await expect(
      store.createAttempt({
        taskId: "task_nope",
        agentName: "worker",
        role: "worker",
      }),
    ).rejects.toThrow("task not found");
  });

  test("createAttempt defaults status to running and stamps startedAt", async () => {
    const store = freshStore();
    const task = await store.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const attempt = await store.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    expect(attempt.id).toMatch(/^att_/);
    expect(attempt.status).toBe("running");
    expect(attempt.startedAt).toBeGreaterThan(0);
    expect(attempt.endedAt).toBeUndefined();
  });

  test("updateAttempt preserves id, taskId, startedAt", async () => {
    const store = freshStore();
    const task = await store.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const attempt = await store.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const completed = await store.updateAttempt(attempt.id, {
      status: "completed",
      endedAt: Date.now(),
      resultSummary: "ok",
    });

    expect(completed.id).toBe(attempt.id);
    expect(completed.taskId).toBe(task.id);
    expect(completed.startedAt).toBe(attempt.startedAt);
    expect(completed.status).toBe("completed");
    expect(completed.resultSummary).toBe("ok");
  });

  test("listAttempts returns attempts for a task in started-order", async () => {
    const store = freshStore();
    const task = await store.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const first = await store.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const attempts = await store.listAttempts(task.id);
    expect(attempts.map((a) => a.id)).toEqual([first.id, second.id]);
  });
});

describe("InMemoryWorkspaceStateStore — Handoff", () => {
  test("createHandoff requires an existing task and fromAttempt", async () => {
    const store = freshStore();
    await expect(
      store.createHandoff({
        taskId: "task_nope",
        fromAttemptId: "att_nope",
        createdBy: "codex",
        kind: "progress",
        summary: "x",
      }),
    ).rejects.toThrow("task not found");
  });

  test("createHandoff fills defaults and returns a persistable record", async () => {
    const store = freshStore();
    const task = await store.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const attempt = await store.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const handoff = await store.createHandoff({
      taskId: task.id,
      fromAttemptId: attempt.id,
      createdBy: "codex",
      kind: "progress",
      summary: "halfway",
    });

    expect(handoff.id).toMatch(/^hnd_/);
    expect(handoff.completed).toEqual([]);
    expect(handoff.pending).toEqual([]);
    expect(handoff.blockers).toEqual([]);
    expect(handoff.summary).toBe("halfway");

    const listed = await store.listHandoffs(task.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(handoff.id);
  });
});

describe("InMemoryWorkspaceStateStore — Artifact", () => {
  test("createArtifact appends to the owning task's artifactRefs", async () => {
    const store = freshStore();
    const task = await store.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const attempt = await store.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const artifact = await store.createArtifact({
      taskId: task.id,
      kind: "file",
      title: "diff.patch",
      ref: "file:/tmp/diff.patch",
      createdByAttemptId: attempt.id,
    });

    expect(artifact.id).toMatch(/^art_/);

    const refreshedTask = await store.getTask(task.id);
    expect(refreshedTask?.artifactRefs).toContain(artifact.id);
  });

  test("listArtifacts is scoped per task", async () => {
    const store = freshStore();
    const taskA = await store.createTask({ workspaceId: "w1", title: "a", goal: "g" });
    const taskB = await store.createTask({ workspaceId: "w1", title: "b", goal: "g" });
    const attemptA = await store.createAttempt({
      taskId: taskA.id,
      agentName: "codex",
      role: "worker",
    });
    const attemptB = await store.createAttempt({
      taskId: taskB.id,
      agentName: "codex",
      role: "worker",
    });

    await store.createArtifact({
      taskId: taskA.id,
      kind: "file",
      title: "a.txt",
      ref: "file:/tmp/a.txt",
      createdByAttemptId: attemptA.id,
    });
    await store.createArtifact({
      taskId: taskB.id,
      kind: "file",
      title: "b.txt",
      ref: "file:/tmp/b.txt",
      createdByAttemptId: attemptB.id,
    });

    const aArtifacts = await store.listArtifacts(taskA.id);
    const bArtifacts = await store.listArtifacts(taskB.id);

    expect(aArtifacts.map((x) => x.title)).toEqual(["a.txt"]);
    expect(bArtifacts.map((x) => x.title)).toEqual(["b.txt"]);
  });
});
