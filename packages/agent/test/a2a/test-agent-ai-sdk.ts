#!/usr/bin/env bun
/**
 * A2A tests for Agent — real end-to-end verification across all available providers.
 *
 * Tests the full Agent lifecycle with real LLM backends:
 *   init → push message → process (LLM runs + tool calls) → verify state → stop
 *
 * Automatically discovers providers via:
 *   AI SDK: DEEPSEEK_API_KEY, KIMI_CODE_API_KEY, BIGMODEL_API_KEY_CN, MINIMAX_CODE_API_KEY_CN, ANTHROPIC_API_KEY, OPENAI_API_KEY
 *   CLI:    claude CLI, cursor CLI, codex CLI
 */
import { Agent } from "../../src/agent.ts";
import type { AgentState, RunInfo, AssembledPrompt } from "../../src/types.ts";
import type { LoopEvent, LoopResult } from "@agent-worker/loop";
import {
  createTest,
  runSuite,
  printReport,
  type TestStatus,
  type SuiteResult,
  withTimeout,
} from "../../../loop/test/a2a/harness.ts";
import { getAvailableProviders, type ProviderConfig } from "./providers.ts";

const TIMEOUT = 120_000;

// ── Helpers ────────────────────────────────────────────────────────────────

function createAgent(
  provider: ProviderConfig,
  opts?: {
    instructions?: string;
    maxRuns?: number;
    debounceMs?: number;
    includeBuiltins?: boolean;
  },
) {
  const loop = provider.createLoop();
  return {
    agent: new Agent({
      loop,
      instructions: opts?.instructions ?? "You are a helpful test agent. Be concise.",
      maxRuns: opts?.maxRuns ?? 3,
      inbox: { debounceMs: opts?.debounceMs ?? 50 },
      toolkit: { includeBuiltins: opts?.includeBuiltins ?? true },
    }),
    loop,
  };
}

function waitForState(agent: Agent, target: AgentState, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (agent.state === target) return resolve();
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for "${target}", current: "${agent.state}"`)),
      timeoutMs,
    );
    agent.on("stateChange", (state) => {
      if (state === target) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

/** Wait for agent to finish processing (reach idle or error) */
function waitForIdle(agent: Agent, timeoutMs = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (agent.state === "idle" || agent.state === "error") return resolve();
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for idle/error, current: "${agent.state}"`)),
      timeoutMs,
    );
    agent.on("stateChange", (state) => {
      if (state === "idle" || state === "error") {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

function collectAgentEvents(agent: Agent) {
  const events: LoopEvent[] = [];
  const runs: RunInfo[] = [];
  const results: LoopResult[] = [];
  const states: AgentState[] = [];
  const prompts: AssembledPrompt[] = [];

  agent.on("event", (e) => events.push(e));
  agent.on("runStart", (info) => runs.push(info));
  agent.on("runEnd", (result) => results.push(result));
  agent.on("stateChange", (s) => states.push(s));
  agent.on("contextAssembled", (p) => prompts.push(p));

  return { events, runs, results, states, prompts };
}

// ── Test factory ───────────────────────────────────────────────────────────

function buildTests(provider: ProviderConfig) {
  const RUNTIME = `Agent+${provider.name}`;
  let available = false;

  return [
    // 0. Preflight — check if this provider/runtime is usable
    createTest("preflight", RUNTIME, async () => {
      const loop = provider.createLoop();
      if (loop.preflight) {
        const info = await loop.preflight();
        if (!info.ok) {
          return { status: "skip" as TestStatus, message: info.error ?? "Not available" };
        }
      }
      available = true;
      await loop.cleanup?.();
      return { status: "pass" as TestStatus, message: "Available" };
    }),

    // 1. Simple message → LLM response
    createTest("simple-message", RUNTIME, async () => {
      if (!available) return { status: "skip" as TestStatus, message: "Not available" };

      return withTimeout(TIMEOUT, async () => {
        const { agent } = createAgent(provider, { debounceMs: 10, includeBuiltins: false });
        await agent.init();
        const collected = collectAgentEvents(agent);

        agent.push("Reply with exactly: AGENT_A2A_OK");

        // Wait for processing to start then finish
        await waitForState(agent, "processing", 10_000);
        await waitForIdle(agent);
        await agent.stop();

        if (agent.state === "error" || collected.runs.length === 0) {
          return {
            status: "fail" as TestStatus,
            message: `Agent errored or no runs. State: ${agent.state}`,
          };
        }

        const textEvents = collected.events.filter((e) => e.type === "text");
        const allText = textEvents
          .map((e) => (e as Extract<LoopEvent, { type: "text" }>).text)
          .join("");

        if (!allText.includes("AGENT_A2A_OK")) {
          return {
            status: "fail" as TestStatus,
            message: `Missing marker. Got: ${allText.slice(0, 200)}`,
          };
        }

        return {
          status: "pass" as TestStatus,
          message: `${collected.runs.length} run(s), marker found`,
        };
      });
    }),

    // 2. State transitions: idle → waiting → processing → idle
    createTest("state-transitions", RUNTIME, async () => {
      if (!available) return { status: "skip" as TestStatus, message: "Not available" };

      return withTimeout(TIMEOUT, async () => {
        const { agent } = createAgent(provider, { debounceMs: 10, includeBuiltins: false });
        await agent.init();
        const collected = collectAgentEvents(agent);

        agent.push("Say hi");

        // Must wait for processing first, then for idle
        await waitForState(agent, "processing", 10_000);
        await waitForIdle(agent);
        await agent.stop();

        const hasProcessing = collected.states.includes("processing");
        // Check that a terminal state (idle or error) appeared after processing
        const processingIdx = collected.states.indexOf("processing");
        const terminalAfter = collected.states
          .slice(processingIdx)
          .some((s) => s === "idle" || s === "error");

        if (!hasProcessing) {
          return {
            status: "fail" as TestStatus,
            message: `No "processing". States: ${collected.states.join(" → ")}`,
          };
        }
        if (!terminalAfter) {
          return {
            status: "fail" as TestStatus,
            message: `No terminal state after processing. States: ${collected.states.join(" → ")}`,
          };
        }

        return { status: "pass" as TestStatus, message: collected.states.join(" → ") };
      });
    }),

    // 3. Tool usage — verify agent can call a tool and produce side-effects
    createTest("tool-call", RUNTIME, async () => {
      if (!available) return { status: "skip" as TestStatus, message: "Not available" };
      if (provider.toolSupport === false)
        return { status: "skip" as TestStatus, message: "No tool support" };

      return withTimeout(TIMEOUT, async () => {
        const { agent } = createAgent(provider, {
          instructions:
            'You have an agent_notes tool. When asked to save something, call agent_notes with action="write", key, and content. Do nothing else.',
          debounceMs: 10,
        });
        await agent.init();
        const collected = collectAgentEvents(agent);

        agent.push('Save a note: key="ping" content="pong"');
        await waitForState(agent, "processing", 10_000);
        await waitForIdle(agent);
        await agent.stop();

        const toolStarts = collected.events.filter((e) => e.type === "tool_call_start");
        const noteTools = toolStarts.filter((e) => {
          const name = (e as Extract<LoopEvent, { type: "tool_call_start" }>).name;
          return name === "agent_notes" || name.endsWith("__agent_notes");
        });

        if (noteTools.length === 0) {
          return {
            status: "fail" as TestStatus,
            message: `No agent_notes calls. Tools: ${toolStarts.map((e) => (e as any).name).join(", ") || "none"}`,
          };
        }

        const val = await agent.notes.read("ping");
        return {
          status: val?.includes("pong") ? ("pass" as TestStatus) : ("fail" as TestStatus),
          message: val?.includes("pong")
            ? `agent_notes ×${noteTools.length}, note="ping:pong"`
            : `Note mismatch. Got: ${val}`,
        };
      });
    }),

    // 4. Context assembly — system prompt includes instructions
    createTest("context-assembly", RUNTIME, async () => {
      if (!available) return { status: "skip" as TestStatus, message: "Not available" };

      return withTimeout(TIMEOUT, async () => {
        const { agent } = createAgent(provider, {
          instructions: "CUSTOM_INSTRUCTION_MARKER_12345",
          debounceMs: 10,
          includeBuiltins: false,
        });
        await agent.init();
        const collected = collectAgentEvents(agent);

        agent.push("Say OK");
        await waitForState(agent, "processing", 10_000);
        await waitForIdle(agent);
        await agent.stop();

        if (collected.prompts.length === 0) {
          return { status: "fail" as TestStatus, message: "No contextAssembled events" };
        }

        const prompt = collected.prompts[0]!;
        const hasInstructions = prompt.system.includes("CUSTOM_INSTRUCTION_MARKER_12345");

        return {
          status: hasInstructions ? ("pass" as TestStatus) : ("fail" as TestStatus),
          message: hasInstructions
            ? `Context: ${prompt.tokenCount} tokens, instructions present`
            : `Instructions missing. System: ${prompt.system.slice(0, 200)}`,
        };
      });
    }),

    // 5. History persists across runs
    createTest("history-persistence", RUNTIME, async () => {
      if (!available) return { status: "skip" as TestStatus, message: "Not available" };

      return withTimeout(TIMEOUT * 2, async () => {
        const { agent } = createAgent(provider, {
          debounceMs: 10,
          maxRuns: 5,
          includeBuiltins: false,
        });
        await agent.init();

        agent.push("Say exactly: FIRST");
        await waitForState(agent, "processing", 10_000);
        await waitForIdle(agent);
        const historyAfterFirst = agent.context.length;

        agent.push("Say exactly: SECOND");
        await waitForState(agent, "processing", 10_000);
        await waitForIdle(agent);
        await agent.stop();

        const historyAfterSecond = agent.context.length;

        if (historyAfterFirst < 1) {
          return { status: "fail" as TestStatus, message: "No history after first run" };
        }
        if (historyAfterSecond <= historyAfterFirst) {
          return {
            status: "fail" as TestStatus,
            message: `History didn't grow: ${historyAfterFirst} → ${historyAfterSecond}`,
          };
        }

        return {
          status: "pass" as TestStatus,
          message: `${historyAfterFirst} → ${historyAfterSecond} turns`,
        };
      });
    }),

    // 6. Stop during processing
    createTest("stop-during-processing", RUNTIME, async () => {
      if (!available) return { status: "skip" as TestStatus, message: "Not available" };

      return withTimeout(TIMEOUT, async () => {
        const { agent } = createAgent(provider, { debounceMs: 10, includeBuiltins: false });
        await agent.init();

        agent.push("Write a very long essay about the history of computing");
        await waitForState(agent, "processing", 10_000);
        await agent.stop();

        if (agent.state !== "stopped") {
          return { status: "fail" as TestStatus, message: `Expected stopped, got ${agent.state}` };
        }

        let threw = false;
        try {
          agent.push("another");
        } catch {
          threw = true;
        }

        return {
          status: threw ? ("pass" as TestStatus) : ("fail" as TestStatus),
          message: threw ? "Stopped cleanly, push throws" : "push after stop didn't throw",
        };
      });
    }),

    // 7. Inbox message tracking
    createTest("inbox-tracking", RUNTIME, async () => {
      if (!available) return { status: "skip" as TestStatus, message: "Not available" };

      return withTimeout(TIMEOUT, async () => {
        const { agent } = createAgent(provider, { debounceMs: 10, includeBuiltins: false });
        await agent.init();

        const received: string[] = [];
        agent.on("messageReceived", (msg) => received.push(msg.content));

        agent.push({ content: "Hello from user", from: "test-user" });
        await waitForState(agent, "processing", 10_000);
        await waitForIdle(agent);
        await agent.stop();

        if (received.length === 0) {
          return { status: "fail" as TestStatus, message: "No messageReceived events" };
        }

        const msgs = agent.inboxMessages;
        const hasUserMsg = msgs.some(
          (m) => m.content === "Hello from user" && m.from === "test-user",
        );

        return {
          status: hasUserMsg ? ("pass" as TestStatus) : ("fail" as TestStatus),
          message: hasUserMsg
            ? `${msgs.length} message(s), from field tracked`
            : `Message not found: ${JSON.stringify(msgs)}`,
        };
      });
    }),
  ];
}

// ── Main ───────────────────────────────────────────────────────────────────

const providers = getAvailableProviders();

if (providers.length === 0) {
  console.log("\n⚠️  No providers found. Set API keys or install CLI tools.");
  process.exit(0);
}

console.log(
  `\n🧪 Agent A2A Tests — ${providers.length} provider(s): ${providers.map((p) => p.name).join(", ")}\n`,
);

const allResults: SuiteResult[] = [];

for (const provider of providers) {
  const RUNTIME = `Agent+${provider.name}`;
  console.log(`\n▶ ${RUNTIME} A2A Tests\n`);

  const tests = buildTests(provider);
  const result = await runSuite(RUNTIME, tests);
  allResults.push(result);
}

printReport(allResults);
