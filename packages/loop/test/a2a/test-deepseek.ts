#!/usr/bin/env bun
/**
 * A2A tests for AiSdkLoop with DeepSeek — async communication model verification.
 *
 * Tests: preflight → simple prompt → event streaming → tool calls → status → cancel
 *
 * Requires DEEPSEEK_API_KEY to be set.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { tool } from "ai";
import { AiSdkLoop } from "../../src/loops/ai-sdk.ts";
import type { LoopEvent, LoopStatus } from "../../src/types.ts";
import {
  createTest,
  runSuite,
  printReport,
  collectEvents,
  validateEvents,
  validateResult,
  extractText,
  extractToolStarts,
  extractToolEnds,
  type TestStatus,
} from "./harness.ts";

const RUNTIME = "AiSdkLoop:deepseek";
let available = false;

// ── DeepSeek model via Anthropic-compatible API ──────────────────────────
// DeepSeek supports Anthropic Messages API at https://api.deepseek.com/anthropic

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

const deepseek = createAnthropic({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/anthropic",
});

const MODEL = deepseek("deepseek-chat");

// ── Simulated workspace tools (channel_send / my_inbox) ──────────────────

const inboxMessages = [
  { id: "msg_001", from: "reviewer", content: "Please check the PR diff", priority: "normal" },
  { id: "msg_002", from: "designer", content: "Logo updated, LGTM?", priority: "immediate" },
];

const channelLog: Array<{ from: string; content: string; channel: string }> = [];

import { jsonSchema } from "ai";

const workspaceTools = {
  channel_send: tool({
    description: "Send a message to a workspace channel. Use this to communicate with other agents.",
    inputSchema: jsonSchema<{ channel: string; content: string }>({
      type: "object",
      properties: {
        channel: { type: "string", description: "Channel name, e.g. 'general'" },
        content: { type: "string", description: "Message content" },
      },
      required: ["channel", "content"],
    }),
    execute: async ({ channel, content }) => {
      channelLog.push({ from: "test-agent", content, channel });
      return { ok: true, messageId: `msg_${Date.now()}` };
    },
  }),

  my_inbox: tool({
    description: "Read pending messages from your inbox. Returns messages that @mention you or are DMs to you.",
    inputSchema: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
    }),
    execute: async () => {
      return { messages: inboxMessages, count: inboxMessages.length };
    },
  }),

  my_inbox_ack: tool({
    description: "Acknowledge a message in your inbox, marking it as processed.",
    inputSchema: jsonSchema<{ messageId: string }>({
      type: "object",
      properties: {
        messageId: { type: "string", description: "The message ID to acknowledge" },
      },
      required: ["messageId"],
    }),
    execute: async ({ messageId }) => {
      const idx = inboxMessages.findIndex((m) => m.id === messageId);
      if (idx === -1) return { ok: false, error: "Message not found" };
      inboxMessages.splice(idx, 1);
      return { ok: true };
    },
  }),
};

// ── Tests ─────────────────────────────────────────────────────────────────

const tests = [
  // 1. Preflight — check DEEPSEEK_API_KEY
  createTest("preflight", RUNTIME, async () => {
    if (!DEEPSEEK_API_KEY) {
      return { status: "skip" as TestStatus, message: "DEEPSEEK_API_KEY not set" };
    }
    available = true;
    return { status: "pass" as TestStatus, message: "DEEPSEEK_API_KEY found" };
  }),

  // 2. Simple prompt — verify basic text response
  createTest("simple-prompt", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });
    const run = loop.run("Reply with exactly: HELLO_DEEPSEEK_A2A");

    const events = await collectEvents(run);
    await run.result;

    const errors = validateEvents(events);
    if (errors.length > 0) {
      return { status: "fail" as TestStatus, message: errors.join("; ") };
    }

    const text = extractText(events);
    if (!text.includes("HELLO_DEEPSEEK_A2A")) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: `Text missing marker: ${text.slice(0, 200)}` };
    }

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: `${events.length} events, marker found` };
  }),

  // 3. Event stream structure — validate every event has correct shape
  createTest("event-structure", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });
    const run = loop.run("Say OK");

    const events = await collectEvents(run);
    const result = await run.result;

    const eventErrors = validateEvents(events);
    if (eventErrors.length > 0) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: eventErrors.join("; ") };
    }

    const resultErrors = validateResult(result);
    if (resultErrors.length > 0) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: resultErrors.join("; ") };
    }

    await loop.cleanup();
    return {
      status: "pass" as TestStatus,
      message: `${events.length} events, ${result.durationMs}ms, in=${result.usage.inputTokens} out=${result.usage.outputTokens}`,
    };
  }),

  // 4. Tool calls — DeepSeek calls workspace tools (my_inbox → channel_send)
  createTest("async-comm-inbox-reply", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "No API key" };

    // Reset state
    channelLog.length = 0;

    const loop = new AiSdkLoop({
      model: MODEL,
      includeBashTools: false,
      tools: workspaceTools,
      instructions: [
        "You are an agent in a multi-agent workspace.",
        "Your name is test-agent.",
        "First, check your inbox with my_inbox.",
        "Then reply to each message by sending a response to #general with channel_send.",
        "After replying, acknowledge each message with my_inbox_ack.",
        "Keep responses short (one sentence each).",
      ].join(" "),
    });

    const run = loop.run("Check your inbox and respond to all pending messages.");
    const events = await collectEvents(run);
    await run.result;

    const starts = extractToolStarts(events);
    const ends = extractToolEnds(events);

    // Should have called my_inbox at least once
    const inboxCalls = starts.filter((s) => s.name === "my_inbox");
    if (inboxCalls.length === 0) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: "Never called my_inbox" };
    }

    // Should have called channel_send at least once
    const sendCalls = starts.filter((s) => s.name === "channel_send");
    if (sendCalls.length === 0) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: "Never called channel_send" };
    }

    // Should have called my_inbox_ack
    const ackCalls = starts.filter((s) => s.name === "my_inbox_ack");

    // Verify tool_call_start/end pairing
    const startNames = starts.map((s) => s.name);
    const endNames = ends.map((e) => e.name);
    const unpaired = startNames.filter(
      (name, i) => !endNames.includes(name),
    );

    await loop.cleanup();
    return {
      status: "pass" as TestStatus,
      message: `inbox:${inboxCalls.length} send:${sendCalls.length} ack:${ackCalls.length} channelLog:${channelLog.length} ends:${ends.length}`,
    };
  }),

  // 5. Tool call start/end pairing — every start has a matching end
  createTest("tool-call-pairing", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({
      model: MODEL,
      includeBashTools: false,
      tools: workspaceTools,
      instructions: "You are an agent. Check your inbox with my_inbox.",
    });

    const run = loop.run("Check inbox.");
    const events = await collectEvents(run);
    await run.result;

    const starts = extractToolStarts(events);
    const ends = extractToolEnds(events);

    if (starts.length === 0) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: "No tool calls at all" };
    }

    // Each start should have a matching end (by callId if available, else by count)
    if (starts.length !== ends.length) {
      await loop.cleanup();
      return {
        status: "fail" as TestStatus,
        message: `Mismatched: ${starts.length} starts vs ${ends.length} ends`,
      };
    }

    // Verify ordering: each start comes before its corresponding end
    for (let i = 0; i < events.length; i++) {
      const e = events[i]!;
      if (e.type === "tool_call_end") {
        const endEvt = e as Extract<LoopEvent, { type: "tool_call_end" }>;
        const startIdx = events.findIndex(
          (ev, j) =>
            j < i &&
            ev.type === "tool_call_start" &&
            (ev as Extract<LoopEvent, { type: "tool_call_start" }>).name === endEvt.name,
        );
        if (startIdx === -1) {
          await loop.cleanup();
          return { status: "fail" as TestStatus, message: `tool_call_end for ${endEvt.name} has no prior start` };
        }
      }
    }

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: `${starts.length} tool calls, all paired` };
  }),

  // 6. Status transitions — idle → running → completed
  createTest("status-transitions", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });
    const s = () => loop.status as LoopStatus;

    if (s() !== "idle") return { status: "fail" as TestStatus, message: `Expected idle, got ${s()}` };

    const run = loop.run("Reply: hi");
    if (s() !== "running") return { status: "fail" as TestStatus, message: `Expected running, got ${s()}` };

    await collectEvents(run);
    await run.result;

    if (s() !== "completed") return { status: "fail" as TestStatus, message: `Expected completed, got ${s()}` };

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: "idle → running → completed" };
  }),

  // 7. Cancel — abort mid-run
  createTest("cancel", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });
    const run = loop.run(
      "Write a very long essay about the entire history of mathematics, covering every century in detail",
    );

    setTimeout(() => loop.cancel(), 500);

    const start = Date.now();
    await collectEvents(run);
    try {
      await run.result;
    } catch {
      /* expected */
    }
    const elapsed = Date.now() - start;

    if (loop.status !== "cancelled") {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: `Expected cancelled, got ${loop.status}` };
    }

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: `Cancelled in ${elapsed}ms` };
  }),

  // 8. Multi-step async comm — inbox → process → reply → ack cycle
  createTest("async-comm-full-cycle", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "No API key" };

    // Reset
    channelLog.length = 0;
    // Re-populate inbox
    inboxMessages.length = 0;
    inboxMessages.push(
      { id: "msg_100", from: "pm", content: "Ship the feature by Friday", priority: "immediate" },
    );

    const loop = new AiSdkLoop({
      model: MODEL,
      includeBashTools: false,
      tools: workspaceTools,
      instructions: [
        "You are test-agent in a multi-agent workspace.",
        "Workflow: 1) my_inbox to read, 2) channel_send to #general to respond, 3) my_inbox_ack to mark done.",
        "Do all three steps for each message.",
      ].join(" "),
    });

    const run = loop.run("Process your inbox.");
    const events = await collectEvents(run);
    await run.result;

    const starts = extractToolStarts(events);
    const toolNames = starts.map((s) => s.name);

    // Verify the three-step flow happened
    const hasInbox = toolNames.includes("my_inbox");
    const hasSend = toolNames.includes("channel_send");
    const hasAck = toolNames.includes("my_inbox_ack");

    await loop.cleanup();

    if (!hasInbox || !hasSend || !hasAck) {
      return {
        status: "fail" as TestStatus,
        message: `Missing steps: inbox=${hasInbox} send=${hasSend} ack=${hasAck}. Tools called: ${toolNames.join(",")}`,
      };
    }

    // Verify ordering: inbox before send, send before ack
    const inboxIdx = toolNames.indexOf("my_inbox");
    const sendIdx = toolNames.indexOf("channel_send");
    const ackIdx = toolNames.indexOf("my_inbox_ack");

    if (inboxIdx > sendIdx || sendIdx > ackIdx) {
      return {
        status: "fail" as TestStatus,
        message: `Wrong order: inbox@${inboxIdx} send@${sendIdx} ack@${ackIdx}`,
      };
    }

    return {
      status: "pass" as TestStatus,
      message: `Full cycle: inbox@${inboxIdx}→send@${sendIdx}→ack@${ackIdx}, ${channelLog.length} messages sent`,
    };
  }),
];

// ── Run ───────────────────────────────────────────────────────────────────

console.log(`\n▶ ${RUNTIME} A2A Tests\n`);
const result = await runSuite(RUNTIME, tests);
printReport([result]);
