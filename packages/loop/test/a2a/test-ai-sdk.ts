#!/usr/bin/env bun
/**
 * A2A tests for AiSdkLoop — real runtime verification.
 *
 * Tests: init → simple prompt → event structure → tool calls → status → cleanup
 *
 * Requires ANTHROPIC_API_KEY (or OPENAI_API_KEY depending on model) to be set.
 */

import { AiSdkLoop } from "../../src/loops/ai-sdk.ts";
import {
  createTest,
  runSuite,
  printReport,
  collectEvents,
  validateEvents,
  validateResult,
  type TestStatus,
} from "./harness.ts";

const RUNTIME = "AiSdkLoop";
let apiKeyAvailable = false;

// Use a small/fast model for testing
const MODEL = "anthropic:claude-haiku-4-5-20251001" as any;

const tests = [
  // 1. Preflight check (API key for provider)
  createTest("preflight", RUNTIME, async () => {
    const loop = new AiSdkLoop({ model: MODEL });
    const info = await loop.preflight();

    if (!info.ok) {
      return { status: "skip" as TestStatus, message: info.error ?? "Not available" };
    }

    apiKeyAvailable = true;
    return { status: "pass" as TestStatus, message: "Provider API key found" };
  }),

  // 2. Init and bash tools
  createTest("init-bash-tools", RUNTIME, async () => {
    if (!apiKeyAvailable) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL });
    await loop.init();

    if (!loop.tools || Object.keys(loop.tools).length === 0) {
      return { status: "fail" as TestStatus, message: "No tools after init()" };
    }

    const toolNames = Object.keys(loop.tools);
    const hasBash = toolNames.some((n) => n.toLowerCase().includes("bash"));
    if (!hasBash) {
      return { status: "fail" as TestStatus, message: `Expected bash tool, got: ${toolNames.join(", ")}` };
    }

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: `Tools: ${toolNames.join(", ")}` };
  }),

  // 3. Simple prompt
  createTest("simple-prompt", RUNTIME, async () => {
    if (!apiKeyAvailable) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });
    const run = loop.run("Reply with exactly: HELLO_A2A_TEST");

    const events = await collectEvents(run);
    const result = await run.result;

    const eventErrors = validateEvents(events);
    if (eventErrors.length > 0) {
      return { status: "fail" as TestStatus, message: `Event errors: ${eventErrors.join("; ")}`, details: { eventErrors } };
    }

    const textEvents = events.filter((e) => e.type === "text");
    if (textEvents.length === 0) {
      return { status: "fail" as TestStatus, message: "No text events", details: { events } };
    }

    const allText = textEvents.map((e) => (e as { type: "text"; text: string }).text).join(" ");
    if (!allText.includes("HELLO_A2A_TEST")) {
      return { status: "fail" as TestStatus, message: `Text missing marker: ${allText.slice(0, 200)}` };
    }

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: `${events.length} events, text contains marker` };
  }),

  // 4. Result structure
  createTest("result-structure", RUNTIME, async () => {
    if (!apiKeyAvailable) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });
    const run = loop.run("Reply: OK");
    await collectEvents(run);
    const result = await run.result;

    const errors = validateResult(result);
    if (errors.length > 0) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: errors.join("; "), details: { result } };
    }

    // AI SDK should always have usage info
    if (result.usage.inputTokens === 0 && result.usage.outputTokens === 0) {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: "Usage is all zeros", details: { usage: result.usage } };
    }

    await loop.cleanup();
    return {
      status: "pass" as TestStatus,
      message: `${result.events.length} events, ${result.durationMs}ms, usage: in=${result.usage.inputTokens} out=${result.usage.outputTokens}`,
    };
  }),

  // 5. Status transitions
  createTest("status-transitions", RUNTIME, async () => {
    if (!apiKeyAvailable) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });

    if (loop.status !== "idle") return { status: "fail" as TestStatus, message: `Expected idle, got ${loop.status}` };

    const run = loop.run("Reply: hi");
    if (loop.status !== "running") return { status: "fail" as TestStatus, message: `Expected running, got ${loop.status}` };

    await collectEvents(run);
    await run.result;

    if (loop.status !== "completed") return { status: "fail" as TestStatus, message: `Expected completed, got ${loop.status}` };

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: "idle → running → completed" };
  }),

  // 6. Cancel
  createTest("cancel", RUNTIME, async () => {
    if (!apiKeyAvailable) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL, includeBashTools: false });
    const run = loop.run("Write a very long essay about the entire history of mathematics, covering every century in detail");

    setTimeout(() => loop.cancel(), 500);

    const start = Date.now();
    await collectEvents(run);
    try { await run.result; } catch { /* expected */ }
    const elapsed = Date.now() - start;

    if (loop.status !== "cancelled") {
      await loop.cleanup();
      return { status: "fail" as TestStatus, message: `Expected cancelled, got ${loop.status}` };
    }

    await loop.cleanup();
    return { status: "pass" as TestStatus, message: `Cancelled in ${elapsed}ms` };
  }),

  // 7. Cleanup idempotent
  createTest("cleanup-idempotent", RUNTIME, async () => {
    if (!apiKeyAvailable) return { status: "skip" as TestStatus, message: "No API key" };

    const loop = new AiSdkLoop({ model: MODEL });
    await loop.init();

    // Cleanup twice should not throw
    await loop.cleanup();
    await loop.cleanup();

    return { status: "pass" as TestStatus, message: "cleanup() called twice without error" };
  }),
];

console.log(`\n▶ ${RUNTIME} A2A Tests\n`);
const result = await runSuite(RUNTIME, tests);
printReport([result]);
