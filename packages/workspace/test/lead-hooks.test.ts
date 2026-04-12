import { describe, test, expect } from "bun:test";
import { buildLeadHooks } from "../src/loop/lead-hooks.ts";
import { InMemoryWorkspaceStateStore } from "../src/state/index.ts";

describe("buildLeadHooks.onCheckpoint", () => {
  test("first run emits no delta — nothing to compare against", async () => {
    const store = new InMemoryWorkspaceStateStore();
    await store.createTask({ workspaceId: "w1", title: "a", goal: "g" });
    const hooks = buildLeadHooks(store);

    const result = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 1 });
    expect(result).toEqual({ kind: "noop" });
  });

  test("only fires at run_start; run_end and event are noops", async () => {
    const store = new InMemoryWorkspaceStateStore();
    const hooks = buildLeadHooks(store);

    const end = await hooks.onCheckpoint!({ reason: "run_end", runNumber: 1 });
    const event = await hooks.onCheckpoint!({ reason: "event", runNumber: 1 });
    expect(end).toEqual({ kind: "noop" });
    expect(event).toEqual({ kind: "noop" });
  });

  test("reports new tasks since the last snapshot", async () => {
    const store = new InMemoryWorkspaceStateStore();
    await store.createTask({ workspaceId: "w1", title: "first", goal: "g" });
    const hooks = buildLeadHooks(store);

    // Baseline.
    await hooks.onCheckpoint!({ reason: "run_start", runNumber: 1 });

    // Between runs, a new task appears.
    await store.createTask({ workspaceId: "w1", title: "second", goal: "g" });

    const result = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 2 });
    expect(result).not.toBeNull();
    expect(result).not.toEqual({ kind: "noop" });
    const inject = result as { kind: "inject"; content: string };
    expect(inject.kind).toBe("inject");
    expect(inject.content).toContain("New tasks");
    expect(inject.content).toContain("second");
    expect(inject.content).not.toContain("first");
  });

  test("reports status transitions", async () => {
    const store = new InMemoryWorkspaceStateStore();
    const task = await store.createTask({ workspaceId: "w1", title: "t", goal: "g" });
    const hooks = buildLeadHooks(store);

    await hooks.onCheckpoint!({ reason: "run_start", runNumber: 1 });
    await store.updateTask(task.id, { status: "open" });

    const result = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 2 });
    const inject = result as { kind: "inject"; content: string };
    expect(inject.kind).toBe("inject");
    expect(inject.content).toContain("Status changes");
    expect(inject.content).toContain("draft → open");
  });

  test("reports activeAttempt changes without a full status transition", async () => {
    const store = new InMemoryWorkspaceStateStore();
    const task = await store.createTask({
      workspaceId: "w1",
      title: "t",
      goal: "g",
      status: "open",
    });
    const hooks = buildLeadHooks(store);
    await hooks.onCheckpoint!({ reason: "run_start", runNumber: 1 });

    // Advance task to in_progress with an active attempt — exercise the
    // status-changed branch.
    const attempt = await store.createAttempt({
      taskId: task.id,
      agentName: "codex",
      role: "worker",
    });
    await store.updateTask(task.id, { status: "in_progress", activeAttemptId: attempt.id });

    const first = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 2 });
    const firstInject = first as { kind: "inject"; content: string };
    expect(firstInject.content).toContain("Status changes");

    // Now only the activeAttemptId changes (re-dispatch). Status stays
    // in_progress.
    const other = await store.createAttempt({
      taskId: task.id,
      agentName: "cursor",
      role: "worker",
    });
    await store.updateTask(task.id, { activeAttemptId: other.id });

    const second = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 3 });
    const secondInject = second as { kind: "inject"; content: string };
    expect(secondInject.kind).toBe("inject");
    expect(secondInject.content).toContain("Active attempt changes");
    expect(secondInject.content).toContain(other.id);
  });

  test("reports removed tasks when a task leaves the tracked set", async () => {
    const store = new InMemoryWorkspaceStateStore();
    const task = await store.createTask({ workspaceId: "w1", title: "bye", goal: "g" });
    const hooks = buildLeadHooks(store);

    await hooks.onCheckpoint!({ reason: "run_start", runNumber: 1 });
    // Completed drops it out of the active set (draft/open/in_progress/blocked).
    await store.updateTask(task.id, { status: "completed" });

    const result = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 2 });
    const inject = result as { kind: "inject"; content: string };
    expect(inject.kind).toBe("inject");
    expect(inject.content).toContain("Removed tasks");
    expect(inject.content).toContain("bye");
  });

  test("emits noop when nothing changes between runs", async () => {
    const store = new InMemoryWorkspaceStateStore();
    await store.createTask({ workspaceId: "w1", title: "still here", goal: "g" });
    const hooks = buildLeadHooks(store);

    await hooks.onCheckpoint!({ reason: "run_start", runNumber: 1 });
    const result = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 2 });
    expect(result).toEqual({ kind: "noop" });
  });

  test("trackStatuses option narrows the observation window", async () => {
    const store = new InMemoryWorkspaceStateStore();
    await store.createTask({ workspaceId: "w1", title: "draft only", goal: "g" });
    const hooks = buildLeadHooks(store, { trackStatuses: ["open"] });

    // First run should see an empty tracked set (the only task is draft).
    await hooks.onCheckpoint!({ reason: "run_start", runNumber: 1 });

    // A new open task arrives — delta should report it but ignore drafts.
    await store.createTask({ workspaceId: "w1", title: "open task", goal: "g", status: "open" });
    await store.createTask({ workspaceId: "w1", title: "another draft", goal: "g" });

    const result = await hooks.onCheckpoint!({ reason: "run_start", runNumber: 2 });
    const inject = result as { kind: "inject"; content: string };
    expect(inject.content).toContain("open task");
    expect(inject.content).not.toContain("another draft");
  });
});
