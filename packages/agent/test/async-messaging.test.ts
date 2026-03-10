/**
 * Scripted async messaging scenarios.
 *
 * Tests message interleaving, burst sends, send-guard behavior,
 * and mid-processing message injection using a controllable mock loop.
 */
import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Agent } from "../src/agent.ts";
import type { AgentLoop, AgentState } from "../src/types.ts";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";

// ── Controllable mock loop ────────────────────────────────────────────────

interface ControllableLoop extends AgentLoop {
  setDelay(ms: number): void;
  setResponse(text: string): void;
  /** Resolve the current run manually (when delay is Infinity) */
  resolveCurrentRun(): void;
  prompts: string[];
  runCount: number;
}

function createControllableLoop(initialDelay = 50): ControllableLoop {
  let responseText = "OK";
  let responseDelayMs = initialDelay;
  let runCount = 0;
  let _status: LoopStatus = "idle";
  const prompts: string[] = [];
  let _resolveRun: (() => void) | null = null;

  return {
    supports: ["directTools"],
    prompts,
    get runCount() {
      return runCount;
    },
    get status() {
      return _status;
    },

    run(prompt: string): LoopRun {
      runCount++;
      _status = "running";
      prompts.push(prompt);

      const textEvent: LoopEvent = { type: "text", text: responseText };

      const delayPromise =
        responseDelayMs === Infinity
          ? new Promise<void>((resolve) => {
              _resolveRun = resolve;
            })
          : new Promise<void>((resolve) => setTimeout(resolve, responseDelayMs));

      const result = delayPromise.then((): LoopResult => {
        _status = "completed";
        return {
          events: [textEvent],
          usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
          durationMs: responseDelayMs === Infinity ? 0 : responseDelayMs,
        };
      });

      return {
        async *[Symbol.asyncIterator]() {
          await delayPromise;
          yield textEvent;
        },
        result,
      };
    },

    cancel() {
      _status = "cancelled";
      _resolveRun?.();
    },

    setTools() {},
    setPrepareStep() {},

    setDelay(ms: number) {
      responseDelayMs = ms;
    },
    setResponse(text: string) {
      responseText = text;
    },
    resolveCurrentRun() {
      _resolveRun?.();
      _resolveRun = null;
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Wait for a specific state transition. If `afterLeaving` is set,
 * waits for the agent to leave that state first (handles "already idle" case).
 */
function waitForState(
  agent: Agent,
  target: AgentState,
  timeoutMs = 5000,
  afterLeaving?: AgentState,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for state "${target}" (current: ${agent.state})`)),
      timeoutMs,
    );
    let leftInitial = !afterLeaving || agent.state !== afterLeaving;

    agent.on("stateChange", (state) => {
      if (!leftInitial) {
        if (state !== afterLeaving) leftInitial = true;
        else return;
      }
      if (state === target) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

/** Wait for agent to process and return to idle. */
function waitForIdle(agent: Agent, timeoutMs = 5000): Promise<void> {
  return waitForState(agent, "idle", timeoutMs, "idle");
}

/** Wait for agent to enter processing state. */
function waitForProcessing(agent: Agent, timeoutMs = 5000): Promise<void> {
  if (agent.state === "processing") return Promise.resolve();
  return waitForState(agent, "processing", timeoutMs);
}

function waitForRunEnd(agent: Agent, timeoutMs = 5000): Promise<LoopResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for runEnd")), timeoutMs);
    agent.on("runEnd", (result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

function collectStates(agent: Agent): AgentState[] {
  const states: AgentState[] = [];
  agent.on("stateChange", (s) => states.push(s));
  return states;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(fn: () => boolean, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!fn()) {
    if (Date.now() > deadline) throw new Error("waitUntil timeout");
    await sleep(10);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("async messaging scenarios", () => {
  let agent: Agent;
  let loop: ControllableLoop;

  beforeEach(async () => {
    loop = createControllableLoop(50);
    agent = new Agent({
      name: "test-agent",
      instructions: "You are a test agent.",
      loop,
      maxRuns: 10,
      inbox: { debounceMs: 50 },
    });
    await agent.init();
  });

  afterEach(async () => {
    if (agent.state !== "stopped") {
      await agent.stop();
    }
  });

  // ── 1. Basic send & process ───────────────────────────────────────────

  test("single message triggers processing cycle", async () => {
    const states = collectStates(agent);

    agent.push("hello");
    await waitForIdle(agent);

    expect(states).toContain("waiting");
    expect(states).toContain("processing");
    expect(loop.runCount).toBe(1);
    expect(loop.prompts[0]).toContain("hello");
  });

  // ── 2. Multiple messages before debounce ─────────────────────────────

  test("burst messages within debounce window are batched into one run", async () => {
    // Send 3 messages rapidly (within 50ms debounce)
    agent.push("msg 1");
    agent.push("msg 2");
    agent.push("msg 3");

    await waitForIdle(agent);

    // All 3 should be batched into a single run prompt
    expect(loop.runCount).toBe(1);
    const prompt = loop.prompts[0];
    expect(prompt).toContain("msg 1");
    expect(prompt).toContain("msg 2");
    expect(prompt).toContain("msg 3");
  });

  // ── 3. Message during processing ─────────────────────────────────────

  test("message sent during processing triggers follow-up run", async () => {
    // Use slow loop so we can inject a message mid-processing
    loop.setDelay(Infinity);

    agent.push("initial message");
    await waitUntil(() => loop.runCount >= 1);

    // Agent is now processing. Push another message.
    agent.push("interrupting message");

    // Complete the first run
    loop.setDelay(10);
    loop.resolveCurrentRun();

    // Wait for both runs to complete
    await waitForIdle(agent);

    expect(loop.runCount).toBe(2);
    expect(loop.prompts[0]).toContain("initial message");
    expect(loop.prompts[1]).toContain("interrupting message");
  });

  // ── 4. Multiple messages during a single run ─────────────────────────

  test("multiple messages during processing are batched in follow-up run", async () => {
    loop.setDelay(Infinity);

    agent.push("first");
    await waitUntil(() => loop.runCount >= 1);

    // Push several messages while processing
    agent.push("during-1");
    agent.push("during-2");
    agent.push("during-3");

    loop.setDelay(10);
    loop.resolveCurrentRun();

    await waitForIdle(agent);

    expect(loop.runCount).toBe(2);
    // The follow-up run should have all 3 interrupting messages
    const followUp = loop.prompts[1];
    expect(followUp).toContain("during-1");
    expect(followUp).toContain("during-2");
    expect(followUp).toContain("during-3");
  });

  // ── 5. Message after idle → new cycle ────────────────────────────────

  test("message after idle starts a new processing cycle", async () => {
    agent.push("cycle 1");
    await waitForIdle(agent);
    expect(loop.runCount).toBe(1);

    // Now idle. Send another message.
    agent.push("cycle 2");
    await waitForIdle(agent);

    expect(loop.runCount).toBe(2);
    expect(loop.prompts[1]).toContain("cycle 2");
  });

  // ── 6. State transitions are correct ─────────────────────────────────

  test("state transitions: idle → waiting → processing → idle", async () => {
    const states = collectStates(agent);

    agent.push("test");
    await waitForIdle(agent);

    expect(states[0]).toBe("waiting");
    expect(states[1]).toBe("processing");
    expect(states[2]).toBe("idle");
  });

  // ── 7. Rapid burst doesn't duplicate runs ────────────────────────────

  test("rapid burst of 10 messages results in minimal runs", async () => {
    for (let i = 0; i < 10; i++) {
      agent.push(`burst-${i}`);
    }

    await waitForIdle(agent, 5000);

    // All should be batched — at most 1-2 runs
    expect(loop.runCount).toBeLessThanOrEqual(2);
    // First prompt should contain all or most messages
    const allContent = loop.prompts.join("\n");
    for (let i = 0; i < 10; i++) {
      expect(allContent).toContain(`burst-${i}`);
    }
  });

  // ── 8. Messages with different senders ───────────────────────────────

  test("messages from different senders are attributed correctly", async () => {
    agent.push({ content: "hello from alice", from: "alice" });
    agent.push({ content: "hello from bob", from: "bob" });

    await waitForIdle(agent);

    const prompt = loop.prompts[0];
    expect(prompt).toContain("[alice]");
    expect(prompt).toContain("[bob]");
    expect(prompt).toContain("hello from alice");
    expect(prompt).toContain("hello from bob");
  });

  // ── 9. Inbox state after processing ──────────────────────────────────

  test("messages are marked read after processing", async () => {
    agent.push("read me");
    await waitForIdle(agent);

    const msgs = agent.inboxMessages;
    expect(msgs.length).toBe(1);
    expect(msgs[0].status).toBe("read");
  });

  // ── 10. History accumulates correctly ────────────────────────────────

  test("conversation history records trigger and response", async () => {
    agent.push("question 1");
    await waitForIdle(agent);

    const history = agent.context;
    expect(history.length).toBe(2);
    expect(history[0].role).toBe("user");
    expect(history[0].content).toContain("question 1");
    expect(history[1].role).toBe("assistant");
    expect(history[1].content).toBe("OK");
  });

  // ── 11. Multi-cycle history ──────────────────────────────────────────

  test("history accumulates across multiple cycles", async () => {
    agent.push("cycle-a");
    await waitForIdle(agent);

    agent.push("cycle-b");
    await waitForIdle(agent);

    const history = agent.context;
    expect(history.length).toBe(4); // 2 user + 2 assistant
    expect(history[0].content).toContain("cycle-a");
    expect(history[2].content).toContain("cycle-b");
  });

  // ── 12. Interleaved sends across 3 cycles ────────────────────────────

  test("interleaved messages across 3 processing cycles", async () => {
    loop.setDelay(Infinity);

    // Cycle 1: send initial message
    agent.push("msg-A");

    // Wait for loop.run() to actually be called (not just state=processing)
    await waitUntil(() => loop.runCount >= 1);

    // Inject msg-B during cycle 1 processing
    agent.push("msg-B");
    loop.resolveCurrentRun();

    // Wait for run 2 to call loop.run()
    await waitUntil(() => loop.runCount >= 2);

    // Inject msg-C during cycle 2 processing
    agent.push("msg-C");
    loop.setDelay(10);
    loop.resolveCurrentRun();

    await waitForIdle(agent);

    expect(loop.runCount).toBe(3);
    expect(loop.prompts[0]).toContain("msg-A");
    expect(loop.prompts[1]).toContain("msg-B");
    expect(loop.prompts[2]).toContain("msg-C");
  });

  // ── 13. Stop during processing ───────────────────────────────────────

  test("stop during processing prevents further runs", async () => {
    loop.setDelay(Infinity);

    agent.push("will be interrupted");
    await waitUntil(() => loop.runCount >= 1);

    // Push another message, then stop
    agent.push("should not be processed");
    await agent.stop();

    expect(agent.state).toBe("stopped");
    expect(loop.runCount).toBe(1); // Only the first run started
  });

  // ── 14. Push after stop throws ───────────────────────────────────────

  test("push after stop throws", async () => {
    await agent.stop();
    expect(() => agent.push("too late")).toThrow("Agent is stopped");
  });

  // ── 15. Debounce batching with timing ────────────────────────────────

  test("messages sent after debounce window trigger separate run", async () => {
    agent.push("before debounce");
    await waitForIdle(agent);

    // Now wait a bit and send another
    await sleep(100);
    agent.push("after debounce");
    await waitForIdle(agent);

    expect(loop.runCount).toBe(2);
  });
});
