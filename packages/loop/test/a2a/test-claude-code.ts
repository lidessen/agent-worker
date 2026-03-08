#!/usr/bin/env bun
/**
 * A2A tests for ClaudeCodeLoop — real runtime verification.
 *
 * Tests: availability → auth → simple prompt → event structure → usage tracking
 */

import { ClaudeCodeLoop } from "../../src/loops/claude-code.ts";
import {
  createTest,
  runSuite,
  printReport,
  collectEvents,
  assertPreflight,
  validateEvents,
  validateResult,
  type TestStatus,
} from "./harness.ts";

const RUNTIME = "ClaudeCodeLoop";
let available = false;

const tests = [
  // 1. CLI availability
  createTest("cli-available", RUNTIME, async () => {
    const loop = new ClaudeCodeLoop();
    const info = await loop.preflight();
    const result = assertPreflight(info);
    available = result.status === "pass";
    return result;
  }),

  // 2. Simple prompt — run a trivial task and verify events
  createTest("simple-prompt", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new ClaudeCodeLoop({
      permissionMode: "bypassPermissions",
    });
    const run = loop.run("Reply with exactly: HELLO_A2A_TEST");

    const events = await collectEvents(run);
    const result = await run.result;

    // Validate event structure
    const eventErrors = validateEvents(events);
    if (eventErrors.length > 0) {
      return { status: "fail" as TestStatus, message: `Event validation errors: ${eventErrors.join("; ")}`, details: { events, eventErrors } };
    }

    // Should have at least one text event
    const textEvents = events.filter((e) => e.type === "text");
    if (textEvents.length === 0) {
      return { status: "fail" as TestStatus, message: "No text events emitted", details: { events } };
    }

    // Text should contain our marker
    const allText = textEvents.map((e) => (e as { type: "text"; text: string }).text).join(" ");
    if (!allText.includes("HELLO_A2A_TEST")) {
      return { status: "fail" as TestStatus, message: `Expected text to contain HELLO_A2A_TEST, got: ${allText.slice(0, 200)}`, details: { allText } };
    }

    return { status: "pass" as TestStatus, message: `Got ${events.length} events, text contains marker`, details: { eventCount: events.length } };
  }),

  // 3. Result structure
  createTest("result-structure", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new ClaudeCodeLoop({
      permissionMode: "bypassPermissions",
    });
    const run = loop.run("Reply with: OK");

    await collectEvents(run);
    const result = await run.result;

    const resultErrors = validateResult(result);
    if (resultErrors.length > 0) {
      return { status: "fail" as TestStatus, message: `Result validation errors: ${resultErrors.join("; ")}`, details: { result, resultErrors } };
    }

    return {
      status: "pass" as TestStatus,
      message: `Result valid: ${result.events.length} events, ${result.durationMs}ms, usage: in=${result.usage.inputTokens} out=${result.usage.outputTokens}`,
      details: { durationMs: result.durationMs, usage: result.usage },
    };
  }),

  // 4. Status transitions
  createTest("status-transitions", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new ClaudeCodeLoop({
      permissionMode: "bypassPermissions",
    });

    if (loop.status !== "idle") {
      return { status: "fail" as TestStatus, message: `Initial status should be idle, got: ${loop.status}` };
    }

    const run = loop.run("Reply: hi");

    if (loop.status !== "running") {
      return { status: "fail" as TestStatus, message: `Status after run() should be running, got: ${loop.status}` };
    }

    await collectEvents(run);
    await run.result;

    if (loop.status !== "completed") {
      return { status: "fail" as TestStatus, message: `Status after completion should be completed, got: ${loop.status}` };
    }

    return { status: "pass" as TestStatus, message: "idle → running → completed" };
  }),

  // 5. Cancel support
  createTest("cancel", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new ClaudeCodeLoop({
      permissionMode: "bypassPermissions",
    });
    const run = loop.run("Write a 500-word essay about the history of computing");

    // Cancel almost immediately
    setTimeout(() => loop.cancel(), 200);

    const start = Date.now();
    await collectEvents(run);
    try { await run.result; } catch { /* may throw on cancel */ }
    const elapsed = Date.now() - start;

    if (loop.status !== "cancelled") {
      return { status: "fail" as TestStatus, message: `Status after cancel should be cancelled, got: ${loop.status}` };
    }

    if (elapsed > 10_000) {
      return { status: "fail" as TestStatus, message: `Cancel took too long: ${elapsed}ms` };
    }

    return { status: "pass" as TestStatus, message: `Cancelled in ${elapsed}ms` };
  }),

  // 6. Tool call events (ask it to do something that uses tools)
  createTest("tool-call-events", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new ClaudeCodeLoop({
      permissionMode: "bypassPermissions",
      allowedTools: ["Bash"],
    });
    const run = loop.run('Run this bash command and tell me the result: echo "A2A_TOOL_TEST"');

    const events = await collectEvents(run);
    await run.result;

    const starts = events.filter((e) => e.type === "tool_call_start");
    if (starts.length === 0) {
      return { status: "fail" as TestStatus, message: "No tool_call_start events emitted", details: { events } };
    }

    for (const tc of starts) {
      if (tc.type !== "tool_call_start") continue;
      if (typeof tc.name !== "string" || tc.name.length === 0) {
        return { status: "fail" as TestStatus, message: `tool_call_start event has invalid name: ${tc.name}` };
      }
    }

    return {
      status: "pass" as TestStatus,
      message: `Got ${starts.length} tool_call_start events`,
      details: { toolCallCount: starts.length },
    };
  }),
];

// ── Run ─────────────────────────────────────────────────────────────────────

console.log(`\n▶ ${RUNTIME} A2A Tests\n`);
const result = await runSuite(RUNTIME, tests);
printReport([result]);
