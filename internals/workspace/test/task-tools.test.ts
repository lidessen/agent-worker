import { describe, test, expect } from "bun:test";
import { createTaskTools } from "../src/context/mcp/task.ts";
import { InMemoryWorkspaceStateStore } from "../src/state/index.ts";
import { InstructionQueue } from "../src/loop/priority-queue.ts";

function setup(agentName = "lead") {
  const store = new InMemoryWorkspaceStateStore();
  const tools = createTaskTools(agentName, "test-ws", store);
  return { store, tools };
}

function setupWithQueue(agentName = "lead") {
  const store = new InMemoryWorkspaceStateStore();
  const queue = new InstructionQueue();
  const tools = createTaskTools(agentName, "test-ws", store, { instructionQueue: queue });
  return { store, tools, queue };
}

describe("task_create", () => {
  test("creates a draft task with agent-origin source ref by default", async () => {
    const { store, tools } = setup("lead");
    const result = await tools.task_create({ title: "Ship it", goal: "Merge PR" });

    expect(result).toContain("created [draft]");
    const tasks = await store.listTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.status).toBe("draft");
    expect(tasks[0]!.sourceRefs).toEqual([expect.objectContaining({ kind: "agent", ref: "lead" })]);
  });

  test("records an explicit source when provided", async () => {
    const { store, tools } = setup();
    await tools.task_create({
      title: "Reply",
      goal: "Answer question",
      source: { kind: "channel", ref: "general#42", excerpt: "please check" },
    });

    const [task] = await store.listTasks();
    expect(task!.sourceRefs[0]).toEqual(
      expect.objectContaining({ kind: "channel", ref: "general#42", excerpt: "please check" }),
    );
  });

  test("rejects missing title or goal", async () => {
    const { tools } = setup();
    expect(await tools.task_create({ title: "", goal: "x" })).toContain("Error");
    expect(await tools.task_create({ title: "y", goal: "" })).toContain("Error");
  });

  test("rejects invalid status", async () => {
    const { tools } = setup();
    const result = await tools.task_create({
      title: "t",
      goal: "g",
      // deliberately bad status
      status: "nope" as unknown as "draft",
    });
    expect(result).toContain("invalid status");
  });
});

describe("task_list", () => {
  test("returns 'No tasks.' on empty store", async () => {
    const { tools } = setup();
    expect(await tools.task_list({})).toBe("No tasks.");
  });

  test("filters by comma-separated status", async () => {
    const { store, tools } = setup();
    await store.createTask({ workspaceId: "test-ws", title: "a", goal: "g" });
    await store.createTask({
      workspaceId: "test-ws",
      title: "b",
      goal: "g",
      status: "open",
    });
    await store.createTask({
      workspaceId: "test-ws",
      title: "c",
      goal: "g",
      status: "in_progress",
    });

    const result = await tools.task_list({ status: "open,in_progress" });
    expect(result).toContain("b");
    expect(result).toContain("c");
    expect(result).not.toContain("] a [draft]");
  });

  test("rejects invalid status filter", async () => {
    const { tools } = setup();
    const result = await tools.task_list({ status: "open,nope" });
    expect(result).toContain("invalid");
  });
});

describe("task_get", () => {
  test("returns formatted task", async () => {
    const { store, tools } = setup();
    const created = await store.createTask({
      workspaceId: "test-ws",
      title: "Investigate",
      goal: "Find the bug",
      status: "open",
    });
    const result = await tools.task_get({ id: created.id });
    expect(result).toContain(created.id);
    expect(result).toContain("[open]");
    expect(result).toContain("Find the bug");
  });

  test("reports missing task", async () => {
    const { tools } = setup();
    expect(await tools.task_get({ id: "task_nope" })).toContain("not found");
  });
});

describe("attempt lifecycle", () => {
  test("wake_create wires itself as active and advances the task to in_progress", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "Fix bug",
      goal: "g",
      status: "open",
    });

    const result = await tools.wake_create({ taskId: task.id });
    expect(result).toContain("[running]");

    const refreshed = await store.getTask(task.id);
    expect(refreshed?.status).toBe("in_progress");
    expect(refreshed?.activeWakeId).toBeTruthy();
  });

  test("wake_update(completed) clears the task's activeWakeId and stamps endedAt", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "Fix",
      goal: "g",
      status: "open",
    });
    await tools.wake_create({ taskId: task.id });
    const taskAfterCreate = await store.getTask(task.id);
    const attemptId = taskAfterCreate!.activeWakeId!;

    const update = await tools.wake_update({
      id: attemptId,
      status: "completed",
      resultSummary: "all green",
    });
    expect(update).toContain("[completed]");

    const refreshed = await store.getTask(task.id);
    expect(refreshed?.activeWakeId).toBeUndefined();

    const attempt = await store.getWake(attemptId);
    expect(attempt?.status).toBe("completed");
    expect(attempt?.endedAt).toBeGreaterThan(0);
    expect(attempt?.resultSummary).toBe("all green");
  });

  test("wake_list returns Wakes for a task", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    await tools.wake_create({ taskId: task.id });
    await tools.wake_create({ taskId: task.id, agentName: "worker-b" });

    const result = await tools.wake_list({ taskId: task.id });
    expect(result).toContain("Wakes (2)");
  });

  test("wake_create rejects invalid role", async () => {
    const { store, tools } = setup();
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    const result = await tools.wake_create({
      taskId: task.id,
      role: "boss" as unknown as "worker",
    });
    expect(result).toContain("invalid role");
  });
});

describe("handoff_create + handoff_list", () => {
  test("records and lists structured handoffs for a task", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    await tools.wake_create({ taskId: task.id });
    const t = await store.getTask(task.id);
    const attemptId = t!.activeWakeId!;

    const create = await tools.handoff_create({
      taskId: task.id,
      closingWakeId: attemptId,
      kind: "progress",
      summary: "halfway",
      completed: ["step 1"],
      pending: ["step 2"],
    });
    expect(create).toContain("recorded");
    expect(create).toContain("progress");

    const list = await tools.handoff_list({ taskId: task.id });
    expect(list).toContain("halfway");
    expect(list).toContain("step 1");
  });

  test("handoff_create rejects invalid kind", async () => {
    const { tools } = setup();
    const result = await tools.handoff_create({
      taskId: "task_nope",
      closingWakeId: "wake_nope",
      kind: "garbage" as unknown as "progress",
      summary: "x",
    });
    expect(result).toContain("invalid handoff kind");
  });
});

describe("artifact_create + artifact_list", () => {
  test("registers an artifact and mirrors it into the task's artifactRefs", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    await tools.wake_create({ taskId: task.id });
    const t = await store.getTask(task.id);
    const attemptId = t!.activeWakeId!;

    const result = await tools.artifact_create({
      taskId: task.id,
      createdByWakeId: attemptId,
      kind: "file",
      title: "diff.patch",
      ref: "file:/tmp/diff.patch",
    });
    expect(result).toContain("registered");

    const refreshed = await store.getTask(task.id);
    expect(refreshed?.artifactRefs).toHaveLength(1);

    const list = await tools.artifact_list({ taskId: task.id });
    expect(list).toContain("diff.patch");
  });
});

describe("task_update", () => {
  test("updates status and returns the new state", async () => {
    const { store, tools } = setup();
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "Investigate",
      goal: "Find the bug",
    });

    const result = await tools.task_update({ id: task.id, status: "open" });
    expect(result).toContain("[open]");

    const refreshed = await store.getTask(task.id);
    expect(refreshed?.status).toBe("open");
  });

  test("rejects invalid status in patch", async () => {
    const { store, tools } = setup();
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "t",
      goal: "g",
    });
    const result = await tools.task_update({
      id: task.id,
      status: "garbage" as unknown as "open",
    });
    expect(result).toContain("invalid status");
  });

  test("reports missing task on update", async () => {
    const { tools } = setup();
    expect(await tools.task_update({ id: "task_missing", title: "x" })).toContain("not found");
  });
});

describe("task_dispatch", () => {
  test("creates a Wake, advances the task, and enqueues an instruction", async () => {
    const { store, tools, queue } = setupWithQueue("lead");
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "Fix bug",
      goal: "Make the failing test pass",
      status: "open",
      acceptanceCriteria: "CI green",
    });

    const result = await tools.task_dispatch({ taskId: task.id, worker: "codex" });
    expect(result).toContain("Dispatched");

    const refreshed = await store.getTask(task.id);
    expect(refreshed?.status).toBe("in_progress");
    expect(refreshed?.activeWakeId).toBeTruthy();

    const attempts = await store.listWakes(task.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.agentName).toBe("codex");
    expect(attempts[0]!.role).toBe("worker");
    // Phase-1 v3: dispatch never attaches worktrees. The
    // worker creates them via worktree_create during the run.
    expect(attempts[0]!.worktrees).toBeUndefined();

    const enqueued = queue.dequeue("codex");
    expect(enqueued).not.toBeNull();
    expect(enqueued?.agentName).toBe("codex");
    expect(enqueued?.content).toContain("Fix bug");
    expect(enqueued?.content).toContain("Make the failing test pass");
    expect(enqueued?.content).toContain("CI green");
    expect(enqueued?.content).toContain(attempts[0]!.id);
    expect(enqueued?.channel).toBe("dispatch");
    expect(enqueued?.priority).toBe("normal");
  });

  test("is unavailable when no instruction queue is wired", async () => {
    const { store, tools } = setup();
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    const result = await tools.task_dispatch({ taskId: task.id, worker: "codex" });
    expect(result).toContain("unavailable");
  });

  test("refuses to dispatch a task that already has an active attempt", async () => {
    const { store, tools, queue: _queue } = setupWithQueue();
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    await tools.task_dispatch({ taskId: task.id, worker: "codex" });

    const second = await tools.task_dispatch({ taskId: task.id, worker: "cursor" });
    expect(second).toContain("already has an active attempt");
  });

  test("refuses to dispatch a terminal task", async () => {
    const { store, tools } = setupWithQueue();
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "t",
      goal: "g",
      status: "completed",
    });
    const result = await tools.task_dispatch({ taskId: task.id, worker: "codex" });
    expect(result).toContain("already completed");
  });

  test("reports missing task", async () => {
    const { tools } = setupWithQueue();
    const result = await tools.task_dispatch({ taskId: "task_missing", worker: "codex" });
    expect(result).toContain("not found");
  });

  test("serialises concurrent dispatches on the same task", async () => {
    const { store, tools, queue } = setupWithQueue();
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });

    const [first, second] = await Promise.all([
      tools.task_dispatch({ taskId: task.id, worker: "codex" }),
      tools.task_dispatch({ taskId: task.id, worker: "cursor" }),
    ]);

    // Exactly one dispatch should have succeeded; the other must report
    // either the in-flight lock or the active-attempt guard.
    const successes = [first, second].filter((r) => r.startsWith("Dispatched"));
    const failures = [first, second].filter((r) => !r.startsWith("Dispatched"));
    expect(successes).toHaveLength(1);
    expect(failures[0]).toMatch(/in flight|already has an active attempt/);

    // Only one attempt should exist, and the task should reference it.
    const attempts = await store.listWakes(task.id);
    expect(attempts).toHaveLength(1);
    const refreshed = await store.getTask(task.id);
    expect(refreshed?.activeWakeId).toBe(attempts[0]!.id);

    // Exactly one instruction should have been enqueued for the winning worker.
    const winner = attempts[0]!.agentName;
    const instruction = queue.dequeue(winner);
    expect(instruction).not.toBeNull();
    const other = winner === "codex" ? "cursor" : "codex";
    expect(queue.dequeue(other)).toBeNull();
  });

  test("walks the full lifecycle: intake → dispatch → worker handoff → completed", async () => {
    const store = new InMemoryWorkspaceStateStore();
    const queue = new InstructionQueue();
    const leadTools = createTaskTools("lead", "test-ws", store, { instructionQueue: queue });
    const workerTools = createTaskTools("codex", "test-ws", store, { instructionQueue: queue });

    // 1. Lead intakes a new request as a draft task.
    const createResult = await leadTools.task_create({
      title: "Wire auth middleware",
      goal: "Protect /api/admin with the new JWT check",
      source: { kind: "user", ref: "msg-42", excerpt: "Please add auth." },
      acceptanceCriteria: "All admin endpoints return 401 without a token.",
    });
    expect(createResult).toContain("created [draft]");

    const drafts = await store.listTasks({ status: ["draft"] });
    expect(drafts).toHaveLength(1);
    const task = drafts[0]!;

    // 2. Lead confirms the draft by advancing to open.
    const confirm = await leadTools.task_update({ id: task.id, status: "open" });
    expect(confirm).toContain("[open]");

    // 3. Lead dispatches to a worker. This creates the Attempt, advances the
    //    task to in_progress, and enqueues an instruction.
    const dispatch = await leadTools.task_dispatch({ taskId: task.id, worker: "codex" });
    expect(dispatch).toContain("Dispatched");

    const afterDispatch = await store.getTask(task.id);
    expect(afterDispatch?.status).toBe("in_progress");
    expect(afterDispatch?.activeWakeId).toBeTruthy();

    const instruction = queue.dequeue("codex");
    expect(instruction).not.toBeNull();
    expect(instruction?.content).toContain("Wire auth middleware");
    expect(instruction?.content).toContain("All admin endpoints return 401");

    // Parse the attempt id out of the instruction body so the "worker" can
    // act on exactly what the dispatch told it to use.
    const attemptIdMatch = instruction!.content.match(/Wake id: (wake_[a-f0-9]+)/);
    expect(attemptIdMatch).not.toBeNull();
    const attemptId = attemptIdMatch![1]!;

    // 4. Worker registers an artifact and records a progress handoff.
    const artifact = await workerTools.artifact_create({
      taskId: task.id,
      createdByWakeId: attemptId,
      kind: "file",
      title: "auth.ts",
      ref: "file:/repo/src/auth.ts",
    });
    expect(artifact).toContain("registered");

    const handoff = await workerTools.handoff_create({
      taskId: task.id,
      closingWakeId: attemptId,
      kind: "completed",
      summary: "Implemented middleware with unit tests",
      completed: ["JWT verification", "401 on missing token", "integration test"],
      artifactRefs: [artifact.match(/art_[a-f0-9]+/)![0]],
      touchedPaths: ["src/auth.ts", "test/auth.test.ts"],
    });
    expect(handoff).toContain("recorded");

    // 5. Worker closes the attempt. This clears activeWakeId automatically.
    const close = await workerTools.wake_update({
      id: attemptId,
      status: "completed",
      resultSummary: "Shipped",
    });
    expect(close).toContain("[completed]");

    const beforeClose = await store.getTask(task.id);
    expect(beforeClose?.activeWakeId).toBeUndefined();

    // 6. Lead reviews and marks the task completed.
    const finish = await leadTools.task_update({ id: task.id, status: "completed" });
    expect(finish).toContain("[completed]");

    const final = await store.getTask(task.id);
    expect(final?.status).toBe("completed");
    expect(final?.artifactRefs).toHaveLength(1);

    // Handoff + attempt + artifact should all be discoverable from the task.
    const handoffs = await store.listHandoffs(task.id);
    expect(handoffs).toHaveLength(1);
    expect(handoffs[0]!.kind).toBe("completed");
    expect(handoffs[0]!.summary).toContain("middleware");

    const attempts = await store.listWakes(task.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]!.status).toBe("completed");
    expect(attempts[0]!.endedAt).toBeGreaterThan(0);
  });

  test("handed_off status clears activeWakeId and unblocks re-dispatch", async () => {
    const { store, tools } = setupWithQueue();
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    await tools.task_dispatch({ taskId: task.id, worker: "codex" });

    const attempts = await store.listWakes(task.id);
    const attemptId = attempts[0]!.id;

    const update = await tools.wake_update({ id: attemptId, status: "handed_off" });
    expect(update).toContain("[handed_off]");

    const afterHandoff = await store.getTask(task.id);
    expect(afterHandoff?.activeWakeId).toBeUndefined();

    // Now the lead can hand the task to someone else.
    const redispatch = await tools.task_dispatch({ taskId: task.id, worker: "cursor" });
    expect(redispatch).toContain("Dispatched");

    const allAttempts = await store.listWakes(task.id);
    expect(allAttempts).toHaveLength(2);
  });
});
