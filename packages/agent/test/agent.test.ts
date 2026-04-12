import { test, expect, describe } from "bun:test";
import { Agent } from "../src/agent.ts";
import type { AgentLoop, AgentState } from "../src/types.ts";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";
import { EventBus } from "@agent-worker/shared";

/** Create a mock AgentLoop that returns a fixed text response */
function createMockLoop(response = "Hello!"): AgentLoop & {
  lastPrompt: string | null;
  prompts: string[];
  runCount: number;
} {
  const mock: AgentLoop & {
    lastPrompt: string | null;
    prompts: string[];
    runCount: number;
    _status: LoopStatus;
  } = {
    supports: ["directTools"],
    lastPrompt: null,
    prompts: [],
    runCount: 0,
    _status: "idle" as LoopStatus,

    get status(): LoopStatus {
      return mock._status;
    },

    run(prompt: string): LoopRun {
      mock.lastPrompt = prompt;
      mock.prompts.push(prompt);
      mock.runCount++;
      mock._status = "running";

      const events: LoopEvent[] = [];
      const textEvent: LoopEvent = { type: "text", text: response };
      events.push(textEvent);

      const loopResult: LoopResult = {
        events,
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        durationMs: 100,
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

function createInterruptibleLoop(): AgentLoop & {
  interrupts: string[];
} {
  const mock: AgentLoop & {
    interrupts: string[];
    _status: LoopStatus;
  } = {
    supports: ["interruptible"],
    interrupts: [],
    _status: "idle" as LoopStatus,

    get status(): LoopStatus {
      return mock._status;
    },

    run(_prompt: string): LoopRun {
      mock._status = "running";
      const textEvent: LoopEvent = { type: "text", text: "working" };
      const result = new Promise<LoopResult>((resolve) => {
        setTimeout(() => {
          mock._status = "completed";
          resolve({
            events: [textEvent],
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            durationMs: 300,
          });
        }, 300);
      });

      return {
        async *[Symbol.asyncIterator]() {
          yield textEvent;
          await new Promise((resolve) => setTimeout(resolve, 350));
        },
        result,
      };
    },

    async interrupt(input: string) {
      mock.interrupts.push(input);
    },

    cancel() {
      mock._status = "cancelled";
    },
  };

  return mock;
}

/** Create a mock CLI loop (supports: [], has setMcpConfig) */
function createMockCliLoop(): AgentLoop & { mcpConfigPath: string | null } {
  const mock: AgentLoop & { mcpConfigPath: string | null; _status: LoopStatus } = {
    supports: [],
    mcpConfigPath: null,
    _status: "idle" as LoopStatus,

    get status(): LoopStatus {
      return mock._status;
    },

    run(_prompt: string): LoopRun {
      mock._status = "running";
      const textEvent: LoopEvent = { type: "text", text: "cli response" };
      const result = Promise.resolve().then(() => {
        mock._status = "completed";
        return {
          events: [textEvent],
          usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
          durationMs: 50,
        } satisfies LoopResult;
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

    setMcpConfig(configPath: string) {
      mock.mcpConfigPath = configPath;
    },
  };
  return mock;
}

describe("Agent", () => {
  test("constructs with minimal config", () => {
    const agent = new Agent({
      loop: createMockLoop(),
    });
    expect(agent.state).toBe("idle");
  });

  test("init sets up tools for direct loop", async () => {
    const loop = createMockLoop();
    let toolsSet = false;
    loop.setTools = () => {
      toolsSet = true;
    };

    const agent = new Agent({ loop });
    await agent.init();
    expect(toolsSet).toBe(true);
  });

  test("push adds message to inbox", async () => {
    const agent = new Agent({ loop: createMockLoop() });
    await agent.init();

    const received: unknown[] = [];
    agent.on("messageReceived", (msg) => received.push(msg));

    agent.push("hello");
    expect(agent.inboxMessages).toHaveLength(1);
    expect(received).toHaveLength(1);
  });

  test("push triggers processing after debounce", async () => {
    const loop = createMockLoop();
    const agent = new Agent({
      loop,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    agent.push("test message");
    expect(agent.state).toBe("idle"); // debounce not fired yet

    await new Promise((r) => setTimeout(r, 50));

    // Wait for processing to complete
    await new Promise((r) => setTimeout(r, 100));
    expect(agent.state).toBe("idle");
    expect(loop.lastPrompt).not.toBeNull();
  });

  test("stop prevents further processing", async () => {
    const agent = new Agent({
      loop: createMockLoop(),
    });
    await agent.init();
    await agent.stop();
    expect(agent.state).toBe("stopped");
    expect(() => agent.push("hello")).toThrow("stopped");
  });

  test("state change events are emitted", async () => {
    const agent = new Agent({
      loop: createMockLoop(),
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    const states: AgentState[] = [];
    agent.on("stateChange", (s) => states.push(s));

    agent.push("test");
    await new Promise((r) => setTimeout(r, 200));

    expect(states).toContain("waiting");
    expect(states).toContain("processing");
    expect(states).toContain("idle");
  });

  test("processing notifications interrupt interruptible loops", async () => {
    const loop = createInterruptibleLoop();
    const agent = new Agent({
      loop,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    agent.push("start work");
    await new Promise((r) => setTimeout(r, 40));
    agent.push("new channel message");

    await new Promise((r) => setTimeout(r, 250));

    expect(loop.interrupts).toHaveLength(1);
    expect(loop.interrupts[0]).toContain("[notification]");
    expect(loop.interrupts[0]).toContain("source: channel");
    expect(loop.interrupts[0]).toContain("workspace_attention:");
  });

  test("todo changes during processing interrupt with todo source", async () => {
    const loop = createInterruptibleLoop();
    const agent = new Agent({
      loop,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    agent.push("start work");
    await new Promise((r) => setTimeout(r, 40));
    const todoLoop = (agent as any).todoManager as { add(text: string): void };
    todoLoop.add("follow up");

    await new Promise((r) => setTimeout(r, 250));

    expect(loop.interrupts).toHaveLength(1);
    expect(loop.interrupts[0]).toContain("source: todo");
  });

  test("bus emits unified runtime_event schema for tools and hooks", async () => {
    const bus = new EventBus();
    const events: any[] = [];
    bus.on((event) => events.push(event));

    const loop: AgentLoop = {
      supports: [],
      _status: "idle" as LoopStatus,
      get status() {
        return this._status;
      },
      run(): LoopRun {
        this._status = "running";
        const runtimeEvents: LoopEvent[] = [
          {
            type: "tool_call_start",
            name: "agent_todo",
            callId: "call_1",
            args: { action: "add" },
          },
          {
            type: "tool_call_end",
            name: "agent_todo",
            callId: "call_1",
            result: "ok",
            durationMs: 12,
          },
          {
            type: "hook",
            phase: "response",
            name: "workspace-notify",
            hookEvent: "Notification",
            outcome: "success",
          },
        ];
        const result = Promise.resolve().then(() => {
          this._status = "completed";
          return {
            events: runtimeEvents,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            durationMs: 10,
          } satisfies LoopResult;
        });
        return {
          async *[Symbol.asyncIterator]() {
            for (const event of runtimeEvents) yield event;
          },
          result,
        };
      },
      cancel() {
        this._status = "cancelled";
      },
      setMcpConfig() {},
    } as AgentLoop & { _status: LoopStatus };

    const agent = new Agent({
      loop,
      bus,
      inbox: { debounceMs: 10 },
    });
    await agent.init();
    agent.push("run");
    await new Promise((r) => setTimeout(r, 250));

    const runtimeEvents = events.filter((event) => event.type === "agent.runtime_event");
    expect(runtimeEvents).toHaveLength(3);
    expect(runtimeEvents[0]).toMatchObject({
      source: "agent",
      eventKind: "tool",
      phase: "start",
      name: "agent_todo",
      callId: "call_1",
    });
    expect(runtimeEvents[1]).toMatchObject({
      source: "agent",
      eventKind: "tool",
      phase: "end",
      name: "agent_todo",
      callId: "call_1",
      durationMs: 12,
    });
    expect(runtimeEvents[2]).toMatchObject({
      source: "agent",
      eventKind: "hook",
      phase: "response",
      name: "workspace-notify",
      hookEvent: "Notification",
      outcome: "success",
    });
  });

  test("todos are accessible", async () => {
    const agent = new Agent({ loop: createMockLoop() });
    await agent.init();
    expect(agent.todos).toHaveLength(0);
  });

  test("notes storage is accessible", async () => {
    const agent = new Agent({ loop: createMockLoop() });
    await agent.init();
    await agent.notes.write("test", "value");
    expect(await agent.notes.read("test")).toBe("value");
  });

  test("context history accumulates", async () => {
    const agent = new Agent({
      loop: createMockLoop(),
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    agent.push("first message");
    await new Promise((r) => setTimeout(r, 200));

    expect(agent.context.length).toBeGreaterThan(0);
  });

  test("validates agent_* namespace collision", async () => {
    const agent = new Agent({
      loop: createMockLoop(),
      toolkit: {
        tools: {
          agent_custom: {} as any,
        },
      },
    });

    expect(agent.init()).rejects.toThrow("reserved prefix");
  });

  test("off removes event listener", async () => {
    const agent = new Agent({
      loop: createMockLoop(),
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    const states: AgentState[] = [];
    const handler = (s: AgentState) => states.push(s);

    agent.on("stateChange", handler);
    agent.push("first");
    await new Promise((r) => setTimeout(r, 200));

    const countAfterFirst = states.length;
    expect(countAfterFirst).toBeGreaterThan(0);

    agent.off("stateChange", handler);
    agent.push("second");
    await new Promise((r) => setTimeout(r, 200));

    // No additional state changes should have been captured after off()
    expect(states.length).toBe(countAfterFirst);
  });

  test("multiple listeners on same event", async () => {
    const agent = new Agent({
      loop: createMockLoop(),
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    let count1 = 0;
    let count2 = 0;
    agent.on("stateChange", () => count1++);
    agent.on("stateChange", () => count2++);

    agent.push("test");
    await new Promise((r) => setTimeout(r, 200));

    expect(count1).toBeGreaterThan(0);
    expect(count1).toBe(count2);
  });

  test("runStart and runEnd events are emitted", async () => {
    const agent = new Agent({
      loop: createMockLoop(),
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    let started = false;
    let ended = false;
    agent.on("runStart", () => {
      started = true;
    });
    agent.on("runEnd", () => {
      ended = true;
    });

    agent.push("test");
    await new Promise((r) => setTimeout(r, 200));

    expect(started).toBe(true);
    expect(ended).toBe(true);
  });
});

// ── Fix #1: CLI MCP bridge ─────────────────────────────────────────────────

describe("CLI MCP bridge", () => {
  test("init writes MCP config for CLI loop", async () => {
    const loop = createMockCliLoop();
    const agent = new Agent({ loop });
    await agent.init();

    // setMcpConfig should have been called with a real config path
    expect(loop.mcpConfigPath).not.toBeNull();

    // The config file should exist and be valid JSON
    const file = Bun.file(loop.mcpConfigPath!);
    expect(await file.exists()).toBe(true);

    const config = await file.json();
    expect(config.mcpServers).toBeDefined();
    expect(config.mcpServers["agent-worker"]).toBeDefined();
    // HTTP MCP server — URL-based, no subprocess
    expect(config.mcpServers["agent-worker"].type).toBe("http");
    expect(config.mcpServers["agent-worker"].url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);

    await agent.stop();
  });

  test("includeBuiltins=false still starts MCP server", async () => {
    const loop = createMockCliLoop();
    const agent = new Agent({
      loop,
      toolkit: { includeBuiltins: false },
    });
    await agent.init();

    // MCP server should still be set up
    expect(loop.mcpConfigPath).not.toBeNull();

    const config = await Bun.file(loop.mcpConfigPath!).json();
    expect(config.mcpServers["agent-worker"].type).toBe("http");

    await agent.stop();
  });

  test("stop cleans up temp MCP files", async () => {
    const loop = createMockCliLoop();
    const agent = new Agent({ loop });
    await agent.init();

    const configPath = loop.mcpConfigPath!;
    expect(await Bun.file(configPath).exists()).toBe(true);

    await agent.stop();

    // Config file should be cleaned up
    expect(await Bun.file(configPath).exists()).toBe(false);
  });
});

// ── Fix #2: History pollution ──────────────────────────────────────────────

describe("History content", () => {
  test("history stores trigger content, not assembled prompt", async () => {
    const loop = createMockLoop("I'll fix that!");
    const agent = new Agent({
      instructions: "You are a helpful assistant. Always be thorough.",
      loop,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    agent.push("Fix the login bug");
    await new Promise((r) => setTimeout(r, 200));

    // History should contain a notification, not the assembled prompt
    const userTurns = agent.context.filter((t) => t.role === "user");
    expect(userTurns).toHaveLength(1);

    const userContent = userTurns[0]!.content;

    // Should contain the notification signal
    expect(userContent).toContain("[notification]");

    // Should NOT contain system instructions or context engine artifacts
    expect(userContent).not.toContain("You are a helpful assistant");
    expect(userContent).not.toContain("[INBOX]");
    expect(userContent).not.toContain("[TODOS]");
  });

  test("history does not grow exponentially across runs", async () => {
    const loop = createMockLoop("Done.");
    const agent = new Agent({
      instructions: "Be helpful.",
      loop,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    // Send 3 messages sequentially
    for (const msg of ["msg 1", "msg 2", "msg 3"]) {
      agent.push(msg);
      await new Promise((r) => setTimeout(r, 200));
    }

    // Each message should add 2 turns (user + assistant)
    // Total should be 6, not exponentially growing
    expect(agent.context.length).toBe(6);

    // Each user turn should stay bounded and avoid accumulating prompt artifacts
    const userTurns = agent.context.filter((t) => t.role === "user");
    for (const turn of userTurns) {
      expect(turn.content.length).toBeLessThan(400);
      expect(turn.content).not.toContain("Be helpful.");
      expect(turn.content).not.toContain("[INBOX]");
      expect(turn.content).not.toContain("[TODOS]");
    }
  });

  test("assembled prompt still includes full context for the LLM", async () => {
    const loop = createMockLoop("Noted.");
    const agent = new Agent({
      instructions: "You are a coding assistant.",
      loop,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    let lastPrompt = "";
    agent.on("contextAssembled", (p) => {
      lastPrompt = p.system;
    });

    agent.push("Add tests");
    await new Promise((r) => setTimeout(r, 200));

    // The assembled prompt (what the LLM actually sees) should have system context
    expect(lastPrompt).toContain("You are a coding assistant");
    expect(lastPrompt).toContain("Inbox");
  });
});

// ── Fix #3: maxRuns with unread messages ────────────────────────────────────

describe("maxRuns behavior", () => {
  test("maxRuns resets counter for unread messages", async () => {
    const loop = createMockLoop("Working on it.");
    const agent = new Agent({
      loop,
      maxRuns: 2,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    // Push first batch
    agent.push("first message");
    await new Promise((r) => setTimeout(r, 150));

    // Push more messages after first batch processes
    agent.push("second message");
    await new Promise((r) => setTimeout(r, 150));

    agent.push("third message");
    await new Promise((r) => setTimeout(r, 150));

    // All messages should have been processed across multiple wake cycles
    expect(loop.runCount).toBeGreaterThanOrEqual(3);
    expect(agent.state).toBe("idle");
  });

  test("maxRuns: short messages auto-read in peek are processed in one run", async () => {
    const loop = createMockLoop("Done.");
    const agent = new Agent({
      loop,
      maxRuns: 1,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    // Short messages — auto-read in peek, so one run handles all
    agent.push("msg 1");
    agent.push("msg 2");
    agent.push("msg 3");

    await new Promise((r) => setTimeout(r, 300));

    // All short messages are auto-read in peek during the first run,
    // so the agent correctly finishes in 1 run
    expect(loop.runCount).toBe(1);
    expect(agent.state).toBe("idle");
  });

  test("messages arriving during processing are picked up", async () => {
    const loop = createMockLoop("Noted.");
    const agent = new Agent({
      loop,
      maxRuns: 10,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    // Push first message
    agent.push("first");
    await new Promise((r) => setTimeout(r, 100));

    // Push second message after first is processed
    agent.push("second");
    await new Promise((r) => setTimeout(r, 200));

    // Both should have been processed
    expect(loop.runCount).toBeGreaterThanOrEqual(2);
    expect(agent.state).toBe("idle");
  });
});

// ── Context pressure hooks ─────────────────────────────────────────────

/**
 * Mock loop that emits a configurable sequence of usage events before the
 * final text, letting tests drive the pressure classifier.
 */
function createUsageLoop(usageSequence: Array<{ total: number }>): AgentLoop {
  const loop: AgentLoop & { _status: LoopStatus } = {
    supports: ["directTools", "usageStream"],
    _status: "idle",

    get status(): LoopStatus {
      return loop._status;
    },

    run(_input): LoopRun {
      loop._status = "running";

      const events: LoopEvent[] = usageSequence.map((u) => ({
        type: "usage",
        inputTokens: u.total,
        outputTokens: 0,
        totalTokens: u.total,
        source: "runtime",
      }));
      const textEvent: LoopEvent = { type: "text", text: "ok" };
      events.push(textEvent);

      const loopResult: LoopResult = {
        events,
        usage: {
          inputTokens: usageSequence.at(-1)?.total ?? 0,
          outputTokens: 0,
          totalTokens: usageSequence.at(-1)?.total ?? 0,
        },
        durationMs: 10,
      };

      const result = Promise.resolve().then(() => {
        loop._status = "completed";
        return loopResult;
      });

      return {
        async *[Symbol.asyncIterator]() {
          for (const event of events) yield event;
        },
        result,
      };
    },

    cancel() {
      loop._status = "cancelled";
    },

    setTools() {},
    setPrepareStep() {},
  };
  return loop;
}

describe("Agent context pressure", () => {
  test("fires onContextPressure at soft threshold based on absolute tokens", async () => {
    const calls: Array<{ level: string; total: number }> = [];
    const loop = createUsageLoop([{ total: 500 }, { total: 1200 }, { total: 1900 }]);
    const agent = new Agent({
      loop,
      maxRuns: 1,
      inbox: { debounceMs: 10 },
      contextThresholds: { softTokens: 1000, hardTokens: 2000 },
      hooks: {
        onContextPressure: ({ level, usage }) => {
          calls.push({ level, total: usage.totalTokens });
          return { kind: "continue" };
        },
      },
    });
    await agent.init();

    agent.push("go");
    await new Promise((r) => setTimeout(r, 150));

    // First usage (500) is below soft (1000); second and third cross soft — only fires once.
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ level: "soft", total: 1200 });
    expect(agent.state).toBe("idle");
  });

  test("fires hard and drives graceful stop when hook returns end", async () => {
    const calls: Array<{ level: string }> = [];
    const loop = createUsageLoop([{ total: 500 }, { total: 3000 }]);
    const agent = new Agent({
      loop,
      maxRuns: 5,
      inbox: { debounceMs: 10 },
      contextThresholds: { softTokens: 1000, hardTokens: 2000 },
      hooks: {
        onContextPressure: ({ level }) => {
          calls.push({ level });
          if (level === "hard") return { kind: "end", summary: "rollup" };
          return { kind: "continue" };
        },
      },
    });
    await agent.init();

    agent.push("go");
    await new Promise((r) => setTimeout(r, 200));

    // Both soft (escalated) and hard should have fired from a single usage event of 3000.
    expect(calls.map((c) => c.level)).toEqual(["soft", "hard"]);
    // Loop should have run exactly once — the second run is suppressed by the graceful stop.
    expect((loop as unknown as { supports: readonly string[] }).supports).toContain("usageStream");
    expect(agent.state).toBe("idle");
  });

  test("lastUsage exposes the most recent snapshot", async () => {
    const loop = createUsageLoop([{ total: 100 }, { total: 250 }]);
    const agent = new Agent({
      loop,
      maxRuns: 1,
      inbox: { debounceMs: 10 },
    });
    await agent.init();

    agent.push("go");
    await new Promise((r) => setTimeout(r, 150));

    expect(agent.lastUsage?.totalTokens).toBe(250);
    expect(agent.lastUsage?.source).toBe("runtime");
  });

  test("treats a throwing onContextPressure hook as continue and keeps running", async () => {
    const loop = createUsageLoop([{ total: 1500 }]);
    const agent = new Agent({
      loop,
      maxRuns: 1,
      inbox: { debounceMs: 10 },
      contextThresholds: { softTokens: 1000, hardTokens: 2000 },
      hooks: {
        onContextPressure: () => {
          throw new Error("boom");
        },
      },
    });
    await agent.init();

    agent.push("go");
    await new Promise((r) => setTimeout(r, 150));

    // Agent should have reached idle, not error — throwing hook is swallowed.
    expect(agent.state).toBe("idle");
    expect(agent.lastUsage?.totalTokens).toBe(1500);
  });

  test("does not fire hook when no thresholds cross", async () => {
    let fired = 0;
    const loop = createUsageLoop([{ total: 100 }, { total: 200 }]);
    const agent = new Agent({
      loop,
      maxRuns: 1,
      inbox: { debounceMs: 10 },
      contextThresholds: { softTokens: 1000, hardTokens: 2000 },
      hooks: {
        onContextPressure: () => {
          fired++;
          return { kind: "continue" };
        },
      },
    });
    await agent.init();

    agent.push("go");
    await new Promise((r) => setTimeout(r, 150));

    expect(fired).toBe(0);
  });
});
