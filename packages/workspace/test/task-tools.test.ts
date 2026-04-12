import { describe, test, expect } from "bun:test";
import { createTaskTools } from "../src/context/mcp/task.ts";
import { InMemoryWorkspaceStateStore } from "../src/state/index.ts";

function setup(agentName = "lead") {
  const store = new InMemoryWorkspaceStateStore();
  const tools = createTaskTools(agentName, "test-ws", store);
  return { store, tools };
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
  test("attempt_create wires itself as active and advances the task to in_progress", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "Fix bug",
      goal: "g",
      status: "open",
    });

    const result = await tools.attempt_create({ taskId: task.id });
    expect(result).toContain("[running]");

    const refreshed = await store.getTask(task.id);
    expect(refreshed?.status).toBe("in_progress");
    expect(refreshed?.activeAttemptId).toBeTruthy();
  });

  test("attempt_update(completed) clears the task's activeAttemptId and stamps endedAt", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({
      workspaceId: "test-ws",
      title: "Fix",
      goal: "g",
      status: "open",
    });
    await tools.attempt_create({ taskId: task.id });
    const taskAfterCreate = await store.getTask(task.id);
    const attemptId = taskAfterCreate!.activeAttemptId!;

    const update = await tools.attempt_update({
      id: attemptId,
      status: "completed",
      resultSummary: "all green",
    });
    expect(update).toContain("[completed]");

    const refreshed = await store.getTask(task.id);
    expect(refreshed?.activeAttemptId).toBeUndefined();

    const attempt = await store.getAttempt(attemptId);
    expect(attempt?.status).toBe("completed");
    expect(attempt?.endedAt).toBeGreaterThan(0);
    expect(attempt?.resultSummary).toBe("all green");
  });

  test("attempt_list returns attempts for a task", async () => {
    const { store, tools } = setup("worker-a");
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    await tools.attempt_create({ taskId: task.id });
    await tools.attempt_create({ taskId: task.id, agentName: "worker-b" });

    const result = await tools.attempt_list({ taskId: task.id });
    expect(result).toContain("Attempts (2)");
  });

  test("attempt_create rejects invalid role", async () => {
    const { store, tools } = setup();
    const task = await store.createTask({ workspaceId: "test-ws", title: "t", goal: "g" });
    const result = await tools.attempt_create({
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
    await tools.attempt_create({ taskId: task.id });
    const t = await store.getTask(task.id);
    const attemptId = t!.activeAttemptId!;

    const create = await tools.handoff_create({
      taskId: task.id,
      fromAttemptId: attemptId,
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
      fromAttemptId: "att_nope",
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
    await tools.attempt_create({ taskId: task.id });
    const t = await store.getTask(task.id);
    const attemptId = t!.activeAttemptId!;

    const result = await tools.artifact_create({
      taskId: task.id,
      createdByAttemptId: attemptId,
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
