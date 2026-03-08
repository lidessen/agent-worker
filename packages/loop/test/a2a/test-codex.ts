#!/usr/bin/env bun
/**
 * A2A tests for CodexLoop — real runtime verification.
 *
 * Tests: availability → simple prompt → event structure → status transitions
 */

import { CodexLoop } from "../../src/loops/codex.ts";
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

const RUNTIME = "CodexLoop";
let available = false;

const tests = [
  // 1. CLI availability
  createTest("cli-available", RUNTIME, async () => {
    const loop = new CodexLoop();
    const info = await loop.preflight();
    const result = assertPreflight(info);
    available = result.status === "pass";
    return result;
  }),

  // 2. Simple prompt
  createTest("simple-prompt", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new CodexLoop({ fullAuto: true });
    const run = loop.run("Reply with exactly: HELLO_A2A_TEST");

    const events = await collectEvents(run);
    const result = await run.result;

    const eventErrors = validateEvents(events);
    if (eventErrors.length > 0) {
      return { status: "fail" as TestStatus, message: `Event errors: ${eventErrors.join("; ")}`, details: { eventErrors } };
    }

    const textEvents = events.filter((e) => e.type === "text");
    if (textEvents.length === 0) {
      return { status: "fail" as TestStatus, message: "No text events emitted", details: { events } };
    }

    return { status: "pass" as TestStatus, message: `Got ${events.length} events` };
  }),

  // 3. Result structure
  createTest("result-structure", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new CodexLoop({ fullAuto: true });
    const run = loop.run("Reply with: OK");
    await collectEvents(run);
    const result = await run.result;

    const errors = validateResult(result);
    if (errors.length > 0) {
      return { status: "fail" as TestStatus, message: errors.join("; "), details: { result } };
    }

    return { status: "pass" as TestStatus, message: `Valid result: ${result.events.length} events, ${result.durationMs}ms` };
  }),

  // 4. Status transitions
  createTest("status-transitions", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new CodexLoop({ fullAuto: true });
    if (loop.status !== "idle") return { status: "fail" as TestStatus, message: `Expected idle, got ${loop.status}` };

    const run = loop.run("Reply: hi");
    if (loop.status !== "running") return { status: "fail" as TestStatus, message: `Expected running, got ${loop.status}` };

    await collectEvents(run);
    await run.result;

    if (loop.status !== "completed") return { status: "fail" as TestStatus, message: `Expected completed, got ${loop.status}` };

    return { status: "pass" as TestStatus, message: "idle → running → completed" };
  }),

  // 5. Cancel
  createTest("cancel", RUNTIME, async () => {
    if (!available) return { status: "skip" as TestStatus, message: "CLI not available" };

    const loop = new CodexLoop({ fullAuto: true });
    const run = loop.run("Write a detailed 2000-word analysis of every major war in human history, covering causes, key battles, and lasting consequences for each one");

    // Cancel very quickly before the LLM can finish
    setTimeout(() => loop.cancel(), 50);

    const start = Date.now();
    await collectEvents(run);
    try { await run.result; } catch { /* may throw */ }
    const elapsed = Date.now() - start;

    if (loop.status !== "cancelled") {
      return { status: "fail" as TestStatus, message: `Expected cancelled, got ${loop.status}` };
    }

    return { status: "pass" as TestStatus, message: `Cancelled in ${elapsed}ms` };
  }),
];

console.log(`\n▶ ${RUNTIME} A2A Tests\n`);
const result = await runSuite(RUNTIME, tests);
printReport([result]);
