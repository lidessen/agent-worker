import { describe, test, expect } from "bun:test";
import { InMemoryHarnessStateStore } from "../src/state/index.ts";

function freshStore() {
  return new InMemoryHarnessStateStore();
}

describe("InMemoryHarnessStateStore — Task", () => {
  test("createTask defaults status to draft and auto-fills id/timestamps", async () => {
    const store = freshStore();
    const task = await store.createTask({
      harnessId: "w1",
      title: "Write tests",
      goal: "Add state store unit tests",
    });

    expect(task.id).toMatch(/^task_/);
    expect(task.status).toBe("draft");
    expect(task.sourceRefs).toEqual([]);
    expect(task.createdAt).toBeGreaterThan(0);
    expect(task.updatedAt).toBe(task.createdAt);
  });

  test("updateTask rejects unknown id", async () => {
    const store = freshStore();
    await expect(store.updateTask("task_missing", { title: "x" })).rejects.toThrow("not found");
  });

  test("updateTask preserves id, harnessId, createdAt and refreshes updatedAt", async () => {
    const store = freshStore();
    const task = await store.createTask({
      harnessId: "w1",
      title: "t",
      goal: "g",
    });

    // Wait a tick so updatedAt is guaranteed distinct.
    await new Promise((r) => setTimeout(r, 5));
    const next = await store.updateTask(task.id, {
      status: "open",
      title: "t'",
      // Trying to change harnessId at compile time is prevented by
      // TaskPatch's Omit. This test only verifies the runtime invariants.
    });

    expect(next.id).toBe(task.id);
    expect(next.harnessId).toBe("w1");
    expect(next.createdAt).toBe(task.createdAt);
    expect(next.updatedAt).toBeGreaterThan(task.createdAt);
    expect(next.status).toBe("open");
    expect(next.title).toBe("t'");
  });

  test("listTasks filters by status and returns creation-time order", async () => {
    const store = freshStore();
    const a = await store.createTask({ harnessId: "w1", title: "a", goal: "g" });
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.createTask({
      harnessId: "w1",
      title: "b",
      goal: "g",
      status: "open",
    });
    await new Promise((r) => setTimeout(r, 5));
    const c = await store.createTask({
      harnessId: "w1",
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
    await store.createTask({ harnessId: "w1", title: "x", goal: "g", ownerLeadId: "lead-a" });
    await store.createTask({ harnessId: "w1", title: "y", goal: "g", ownerLeadId: "lead-b" });

    const ownedByA = await store.listTasks({ ownerLeadId: "lead-a" });
    expect(ownedByA).toHaveLength(1);
    expect(ownedByA[0]!.title).toBe("x");
  });
});

describe("InMemoryHarnessStateStore — Wake", () => {
  test("createWake requires an existing task", async () => {
    const store = freshStore();
    await expect(
      store.createWake({
        taskId: "task_nope",
        agentName: "worker",
        role: "worker",
      }),
    ).rejects.toThrow("task not found");
  });

  test("createWake defaults status to running and stamps startedAt", async () => {
    const store = freshStore();
    const task = await store.createTask({ harnessId: "w1", title: "t", goal: "g" });
    const wake = await store.createWake({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    expect(wake.id).toMatch(/^wake_/);
    expect(wake.status).toBe("running");
    expect(wake.startedAt).toBeGreaterThan(0);
    expect(wake.endedAt).toBeUndefined();
  });

  test("updateWake preserves id, taskId, startedAt", async () => {
    const store = freshStore();
    const task = await store.createTask({ harnessId: "w1", title: "t", goal: "g" });
    const wake = await store.createWake({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const completed = await store.updateWake(wake.id, {
      status: "completed",
      endedAt: Date.now(),
      resultSummary: "ok",
    });

    expect(completed.id).toBe(wake.id);
    expect(completed.taskId).toBe(task.id);
    expect(completed.startedAt).toBe(wake.startedAt);
    expect(completed.status).toBe("completed");
    expect(completed.resultSummary).toBe("ok");
  });

  test("listWakes returns Wakes for a task in started-order", async () => {
    const store = freshStore();
    const task = await store.createTask({ harnessId: "w1", title: "t", goal: "g" });
    const first = await store.createWake({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.createWake({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const wakes = await store.listWakes(task.id);
    expect(wakes.map((w) => w.id)).toEqual([first.id, second.id]);
  });
});

describe("InMemoryHarnessStateStore — Handoff", () => {
  test("createHandoff requires an existing task and closingWake", async () => {
    const store = freshStore();
    await expect(
      store.createHandoff({
        taskId: "task_nope",
        closingWakeId: "wake_nope",
        createdBy: "codex",
        kind: "progress",
        summary: "x",
      }),
    ).rejects.toThrow("task not found");
  });

  test("createHandoff fills defaults and returns a persistable record", async () => {
    const store = freshStore();
    const task = await store.createTask({ harnessId: "w1", title: "t", goal: "g" });
    const wake = await store.createWake({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const handoff = await store.createHandoff({
      taskId: task.id,
      closingWakeId: wake.id,
      createdBy: "codex",
      kind: "progress",
      summary: "halfway",
    });

    expect(handoff.id).toMatch(/^hnd_/);
    expect(handoff.completed).toEqual([]);
    expect(handoff.pending).toEqual([]);
    expect(handoff.blockers).toEqual([]);
    expect(handoff.resources).toEqual([]);
    expect(handoff.extensions).toEqual({});
    expect(handoff.summary).toBe("halfway");

    const listed = await store.listHandoffs(task.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.id).toBe(handoff.id);
  });

  test("createHandoff round-trips an opaque per-harness extension payload", async () => {
    const store = freshStore();
    const task = await store.createTask({ harnessId: "w1", title: "t", goal: "g" });
    const wake = await store.createWake({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });

    const handoff = await store.createHandoff({
      taskId: task.id,
      closingWakeId: wake.id,
      createdBy: "codex",
      kind: "progress",
      summary: "halfway",
      resources: ["res_one", "res_two"],
      workLogPointer: "worklog/2026-05-09",
      extensions: {
        "coding-harness": { branch: "feature/wake-foundation", testStatus: "green" },
      },
      harnessTypeId: "coding-harness",
    });

    const fetched = await store.getHandoff(handoff.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.resources).toEqual(["res_one", "res_two"]);
    expect(fetched!.workLogPointer).toBe("worklog/2026-05-09");
    expect(fetched!.extensions["coding-harness"]).toEqual({
      branch: "feature/wake-foundation",
      testStatus: "green",
    });
    expect(fetched!.harnessTypeId).toBe("coding-harness");
  });
});

