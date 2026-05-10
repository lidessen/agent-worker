import { test, expect, describe } from "bun:test";
import { RunCoordinator } from "../src/run-coordinator.ts";
import { Inbox } from "../src/inbox.ts";
import { TodoManager } from "../src/todo.ts";
import { InMemoryNotesStorage } from "../src/notes.ts";
import { ContextEngine } from "../src/context-engine.ts";
import { ReminderManager } from "../src/reminder.ts";
import type { Turn, AgentLoop } from "../src/types.ts";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";

function createMockLoop(
  response = "OK",
): AgentLoop & { lastInput: string | { system: string; prompt: string } | null; runCount: number } {
  const mock: AgentLoop & {
    lastInput: string | { system: string; prompt: string } | null;
    runCount: number;
    _status: LoopStatus;
  } = {
    supports: ["directTools"],
    lastInput: null,
    runCount: 0,
    _status: "idle" as LoopStatus,

    get status(): LoopStatus {
      return mock._status;
    },

    run(input: string | { system: string; prompt: string }): LoopRun {
      mock.lastInput = input;
      mock.runCount++;

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

function createEventLoop(
  steps: Array<{ event: LoopEvent; delayMs?: number }>,
  durationMs = 75,
): AgentLoop & { lastInput: string | { system: string; prompt: string } | null; runCount: number } {
  const mock: AgentLoop & {
    lastInput: string | { system: string; prompt: string } | null;
    runCount: number;
    _status: LoopStatus;
  } = {
    supports: ["directTools"],
    lastInput: null,
    runCount: 0,
    _status: "idle" as LoopStatus,

    get status(): LoopStatus {
      return mock._status;
    },

    run(input: string | { system: string; prompt: string }): LoopRun {
      mock.lastInput = input;
      mock.runCount++;

      const loopResult: LoopResult = {
        events: steps.map((step) => step.event),
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
        durationMs,
      };

      const result = Promise.resolve().then(() => {
        mock._status = "completed";
        return loopResult;
      });

      return {
        async *[Symbol.asyncIterator]() {
          for (const step of steps) {
            if (step.delayMs) {
              await new Promise((resolve) => setTimeout(resolve, step.delayMs));
            }
            yield step.event;
          }
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

function createRecordingMemory() {
  const extractCalls: Array<{ turns: Turn[]; source: string }> = [];
  const memory = {
    extractCalls,
    shouldExtract(trigger: "checkpoint" | "event" | "idle") {
      return trigger === "checkpoint" || trigger === "event";
    },
    async extract(turns: Turn[], source: string) {
      extractCalls.push({
        turns: turns.map((turn) => ({ ...turn })),
        source,
      });
    },
    async formatForPrompt() {
      return "";
    },
    async recall() {
      return [];
    },
    async search() {
      return [];
    },
    storageBackend: {
      async add() {
        return "mem_test";
      },
      async list() {
        return [];
      },
      async remove() {},
      async search() {
        return [];
      },
    },
  };

  return memory as unknown as import("../src/memory.ts").MemoryManager & {
    extractCalls: Array<{ turns: Turn[]; source: string }>;
  };
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

  test("buildNotification for message", () => {
    const { coordinator } = createCoordinator();
    const content = coordinator.buildNotification("next_message");
    expect(content).toContain("[notification]");
    expect(content).toContain("inbox");
  });

  test("buildNotification for todo", () => {
    const { coordinator } = createCoordinator();
    const content = coordinator.buildNotification("next_todo");
    expect(content).toContain("[notification]");
    expect(content).toContain("todo");
  });

  test("executeRun persists notification and response to history", async () => {
    const loop = createMockLoop("Done!");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("do the thing");

    await coordinator.executeRun("next_message");

    expect(coordinator.history).toHaveLength(2);
    expect(coordinator.history[0]!.role).toBe("user");
    expect(coordinator.history[0]!.content).toContain("[notification]");
    expect(coordinator.history[1]!.role).toBe("assistant");
    expect(coordinator.history[1]!.content).toBe("Done!");
  });

  test("executeRun passes structured input to loop", async () => {
    const loop = createMockLoop("Noted.");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("fix the bug");

    await coordinator.executeRun("next_message");

    // loop.run should receive { system, prompt } not a flat string
    expect(loop.lastInput).toHaveProperty("system");
    expect(loop.lastInput).toHaveProperty("prompt");
    const input = loop.lastInput as { system: string; prompt: string };
    expect(input.system).toContain("[ROLE]");
    expect(input.prompt).toContain("[notification]");
    expect(input.prompt).toContain("fix the bug");
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

  test("shouldContinue returns waiting_reminder when only reminders pending", () => {
    const { coordinator, reminders } = createCoordinator();
    reminders.add("inbox_wait", { timeoutMs: 5000 });
    expect(coordinator.shouldContinue()).toBe("waiting_reminder");
    reminders.cancelAll();
  });

  test("processLoop awaits reminder then resumes", async () => {
    const loop = createMockLoop("OK");
    const { coordinator, inbox, reminders } = createCoordinator(loop);

    // Add a reminder that fires after 30ms
    reminders.add("test_wait", { timeoutMs: 30 });

    // Push a message after the reminder fires (simulating async arrival)
    setTimeout(() => inbox.push("delayed msg"), 60);

    const outcome = await coordinator.processLoop({});
    expect(outcome).toBe("idle");
    // The timeout reminder should have been pushed as a system message
    // and the delayed msg should have been processed
    expect(loop.runCount).toBeGreaterThanOrEqual(1);
  });

  test("timeout reminder pushes sanitized system message to inbox", async () => {
    const loop = createMockLoop("OK");
    const { coordinator, inbox, reminders } = createCoordinator(loop);

    reminders.add("evil\nlabel", { timeoutMs: 10 });

    const outcome = await coordinator.processLoop({});
    expect(outcome).toBe("idle");

    // Check that the system message was sanitized (no raw newlines in label)
    const systemMsgs = inbox.all.filter((m) => m.from === "system");
    expect(systemMsgs.length).toBeGreaterThanOrEqual(1);
    const content = systemMsgs[0]!.content;
    expect(content).toContain("evil label");
    expect(content).not.toContain("evil\nlabel");
  });

  test("processLoop respects shouldStop", async () => {
    const loop = createMockLoop("OK");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("msg1");

    let stopped = false;
    setTimeout(() => {
      stopped = true;
    }, 10);

    const outcome = await coordinator.processLoop({
      shouldStop: () => stopped,
    });

    expect(outcome).toBe("idle");
  });

  test("assembleForStep returns empty for step 0", async () => {
    const { coordinator } = createCoordinator();
    const result = await coordinator.assembleForStep({
      steps: [],
      stepNumber: 0,
      model: {},
      messages: [],
      experimental_context: undefined,
    });
    expect(result).toEqual({});
  });

  test("assembleForStep returns system prompt for step > 0", async () => {
    const { coordinator } = createCoordinator();
    const result = await coordinator.assembleForStep({
      steps: [{}],
      stepNumber: 1,
      model: {},
      messages: [],
      experimental_context: undefined,
    });
    expect(result.system).toBeDefined();
    expect(result.system).toContain("Be helpful");
  });

  test("processLoop extracts memories at event and checkpoint boundaries", async () => {
    const loop = createEventLoop([
      {
        event: { type: "text", text: "First assistant sentence with enough detail." },
        delayMs: 300,
      },
      {
        event: {
          type: "tool_call_start",
          name: "agent_notes",
          callId: "call_1",
          args: { note: "capture this" },
        },
      },
      {
        event: {
          type: "tool_call_end",
          name: "agent_notes",
          callId: "call_1",
          result: { ok: true },
        },
      },
    ]);
    const memory = createRecordingMemory();
    const inbox = new Inbox({}, () => {});
    const coordinator = new RunCoordinator({
      loop,
      inbox,
      todos: new TodoManager(),
      notes: new InMemoryNotesStorage(),
      contextEngine: new ContextEngine(),
      memory,
      reminders: new ReminderManager(),
      instructions: "Be helpful.",
      maxRuns: 10,
    });
    inbox.push("trigger event extraction");

    const outcome = await coordinator.processLoop({});

    expect(outcome).toBe("idle");
    expect(memory.extractCalls.length).toBeGreaterThanOrEqual(2);
    expect(memory.extractCalls.some((call) => call.source.startsWith("run_1:event_"))).toBe(true);
    expect(memory.extractCalls.some((call) => call.source === "run_1")).toBe(true);
    expect(
      memory.extractCalls.some((call) => call.turns.some((turn) => turn.role === "tool")),
    ).toBe(true);
  });

  test("processLoop keeps fallback tool ids stable across assistant buffer flushes", async () => {
    const loop = createEventLoop([
      {
        event: { type: "text", text: "Assistant text before tool." },
      },
      {
        event: {
          type: "tool_call_start",
          name: "agent_notes",
          args: { note: "capture this" },
        },
      },
      {
        event: { type: "text", text: "Assistant text before tool result." },
      },
      {
        event: {
          type: "tool_call_end",
          name: "agent_notes",
          result: { ok: true },
        },
      },
    ]);

    const inbox = new Inbox({}, () => {});
    const memory = createRecordingMemory();
    const coordinator = new RunCoordinator({
      loop,
      inbox,
      todos: new TodoManager(),
      notes: new InMemoryNotesStorage(),
      contextEngine: new ContextEngine(),
      memory,
      reminders: new ReminderManager(),
      instructions: "Be helpful.",
      maxRuns: 10,
    });
    inbox.push("trigger tool fallback");

    await coordinator.processLoop({});

    const toolTurns = memory.extractCalls
      .flatMap((call) => call.turns)
      .filter((turn) => turn.role === "tool");
    expect(toolTurns.some((turn) => turn.content.includes('args={"note":"capture this"}'))).toBe(
      true,
    );
    expect(toolTurns.some((turn) => turn.content.includes('result={"ok":true}'))).toBe(true);
  });

  test("processLoop returns error when loop throws", async () => {
    const err = new Error("loop failed");
    const resultPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(err), 0);
    });
    // Prevent unhandled rejection since processLoop catches via iterator
    resultPromise.catch(() => {});

    const errorLoop: ReturnType<typeof createMockLoop> = {
      ...createMockLoop(),
      run() {
        return {
          async *[Symbol.asyncIterator]() {
            yield undefined as never;
            throw err;
          },
          result: resultPromise,
        };
      },
    };
    const inbox = new Inbox({}, () => {});
    const todos = new TodoManager();
    const coordinator = new RunCoordinator({
      loop: errorLoop,
      inbox,
      todos,
      notes: new InMemoryNotesStorage(),
      contextEngine: new ContextEngine(),
      memory: null,
      reminders: new ReminderManager(),
      instructions: "Be helpful.",
      maxRuns: 10,
    });
    inbox.push("trigger");

    const outcome = await coordinator.processLoop({});
    expect(outcome).toBe("error");
  });

  test("processLoop fires onEvent callback", async () => {
    const loop = createMockLoop("OK");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("msg1");

    const events: unknown[] = [];
    await coordinator.processLoop({
      onEvent: (e) => {
        events.push(e);
      },
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty("type", "text");
  });

  test("processLoop fires onContextAssembled callback", async () => {
    const loop = createMockLoop("OK");
    const { coordinator, inbox } = createCoordinator(loop);
    inbox.push("msg1");

    let assembledPrompt: unknown = null;
    await coordinator.processLoop({
      onContextAssembled: (p) => {
        assembledPrompt = p;
      },
    });

    expect(assembledPrompt).not.toBeNull();
    expect(assembledPrompt).toHaveProperty("system");
    expect(assembledPrompt).toHaveProperty("turns");
  });

  test("buildNotification is the same regardless of message count", () => {
    const { coordinator, inbox } = createCoordinator();
    inbox.push("hello");
    inbox.push("world");
    const content = coordinator.buildNotification("next_message");
    expect(content).toContain("[notification]");
    expect(content).toContain("inbox");
  });
});
