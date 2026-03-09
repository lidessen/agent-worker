import { test, expect, describe } from "bun:test";
import { RunCoordinator } from "../src/run-coordinator.ts";
import { Inbox } from "../src/inbox.ts";
import { TodoManager } from "../src/todo.ts";
import { InMemoryNotesStorage } from "../src/notes.ts";
import { ContextEngine } from "../src/context-engine.ts";
import { ReminderManager } from "../src/reminder.ts";
import type { AgentLoop } from "../src/types.ts";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";

function createMockLoop(response = "OK"): AgentLoop & { lastPrompt: string | null; runCount: number } {
  const mock: AgentLoop & { lastPrompt: string | null; runCount: number; _status: LoopStatus } = {
    supports: ["directTools"],
    lastPrompt: null,
    runCount: 0,
    _status: "idle" as LoopStatus,

    get status(): LoopStatus {
      return mock._status;
    },

    run(prompt: string): LoopRun {
      mock.lastPrompt = prompt;
      mock.runCount++;
      mock._status = "running";

      const textEvent: LoopEvent = { type: "text", text: response };
      const loopResult: LoopResult = {
        events: [textEvent],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        durationMs: 50,
      };

      const result = Promise.resolve().then(() => {
        mock._status = "completed";
        return loopResult;
      });

      return {
        async *[Symbol.asyncIterator]() {
          yield textEvent;
        },
        result,
      };
    },

    cancel() {
      mock._status = "cancelled";
    },

    setTools() {},
    setPrepareStep() {},
  };
  return mock;
}

function createCoordinator(loop?: ReturnType<typeof createMockLoop>) {
  const inbox = new Inbox({}, () => {});
  const todos = new TodoManager();
  const notes = new InMemoryNotesStorage();
  const contextEngine = new ContextEngine();

  const reminders = new ReminderManager();

  return {
    coordinator: new RunCoordinator({
      loop: loop ?? createMockLoop(),
      inbox,
      todos,
      notes,
      contextEngine,
      memory: null,
      reminders,
      instructions: "Be helpful.",
      maxRuns: 10,
    }),
    inbox,
    todos,
    reminders,
  };
}

describe("RunCoordinator", () => {
  test("shouldContinue returns idle when nothing pending", () => {
    const { coordinator } = createCoordinator();
    expect(coordinator.shouldContinue()).toBe("idle");
  });

  test("shouldContinue returns next_message when inbox has unread", () => {
    const { coordinator, inbox } = createCoordinator();
    inbox.push("hello");
    expect(coordinator.shouldContinue()).toBe("next_message");
  });

  test("shouldContinue returns next_todo when only todos pending", () => {
    const { coordinator, todos } = createCoordinator();
    todos.add("do something");
    expect(coordinator.shouldContinue()).toBe("next_todo");
  });

  test("shouldContinue prefers messages over todos", () => {
    const { coordinator, inbox, todos } = createCoordinator();
    inbox.push("hello");
    todos.add("do something");
    expect(coordinator.shouldContinue()).toBe("next_message");
  });

  test("buildTriggerContent for message", () => {
    const { coordinator, inbox } = createCoordinator();
    inbox.push("hello world");
    const content = coordinator.buildTriggerContent("next_message");
    expect(content).toBe("hello world");
  });

  test("buildTriggerContent for message with from", () => {
    const { coordinator, inbox } = createCoordinator();
    inbox.push({ content: "fix this", from: "alice" });
    const content = coordinator.buildTriggerContent("next_message");
    expect(content).toBe("[alice] fix this");
  });

  test("buildTriggerContent for todo", () => {
    const { coordinator, todos } = createCoordinator();
    todos.add("task A");
    todos.add("task B");
    const content = coordinator.buildTriggerContent("next_todo");
    expect(content).toContain("task A");
    expect(content).toContain("task B");
  });

  test("executeRun persists trigger content and response to history", async () => {
    const loop = createMockLoop("Done!");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("do the thing");

    await coordinator.executeRun("next_message");

    expect(coordinator.history).toHaveLength(2);
    expect(coordinator.history[0]!.role).toBe("user");
    expect(coordinator.history[0]!.content).toBe("do the thing");
    expect(coordinator.history[1]!.role).toBe("assistant");
    expect(coordinator.history[1]!.content).toBe("Done!");
  });

  test("history stores raw trigger, not assembled prompt", async () => {
    const loop = createMockLoop("Noted.");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("fix the bug");

    await coordinator.executeRun("next_message");

    const userTurn = coordinator.history[0]!;
    expect(userTurn.content).toBe("fix the bug");
    // Should not contain system instructions or context engine artifacts
    expect(userTurn.content).not.toContain("Be helpful");
    expect(userTurn.content).not.toContain("Inbox");
  });

  test("processLoop runs until idle", async () => {
    const loop = createMockLoop("OK");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("msg1");

    const runStarts: number[] = [];
    const outcome = await coordinator.processLoop({
      onRunStart: (info) => runStarts.push(info.runNumber),
    });

    expect(outcome).toBe("idle");
    expect(runStarts.length).toBeGreaterThanOrEqual(1);
  });

  test("processLoop respects shouldStop", async () => {
    const loop = createMockLoop("OK");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("msg1");

    let stopped = false;
    setTimeout(() => { stopped = true; }, 10);

    const outcome = await coordinator.processLoop({
      shouldStop: () => stopped,
    });

    expect(outcome).toBe("idle");
  });
});
