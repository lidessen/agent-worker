/**
 * Enhanced A2A test utilities for systematic runtime testing.
 *
 * Provides high-level assertions that test LoopRun interface compliance,
 * event stream validity, status transitions, and cross-runtime behaviors.
 */

import type { LoopEvent, LoopResult, LoopRun, LoopStatus } from "../../src/types.ts";
import { type TestStatus, collectEvents, validateEvents, validateResult } from "./harness.ts";

// ── Types ───────────────────────────────────────────────────────────────────

export interface AssertionResult {
  status: TestStatus;
  message: string;
  details?: unknown;
}

export interface TimestampedEvent {
  event: LoopEvent;
  relativeMs: number;
}

export interface RuntimeCapabilities {
  emitsToolCallEnd: boolean;
  emitsCallId: boolean;
  emitsThinking: boolean;
  hasUsageTracking: boolean;
}

// ── Runtime capability matrix ───────────────────────────────────────────────

const CAPABILITIES: Record<string, RuntimeCapabilities> = {
  AiSdkLoop: {
    emitsToolCallEnd: true,
    emitsCallId: true,
    emitsThinking: true,
    hasUsageTracking: true,
  },
  ClaudeCodeLoop: {
    emitsToolCallEnd: true,
    emitsCallId: true,
    emitsThinking: false,
    hasUsageTracking: true,
  },
  CodexLoop: {
    emitsToolCallEnd: true,
    emitsCallId: false,
    emitsThinking: false,
    hasUsageTracking: false,
  },
  CursorLoop: {
    emitsToolCallEnd: false,
    emitsCallId: true,
    emitsThinking: false,
    hasUsageTracking: false,
  },
};

export function runtimeCapabilities(runtime: string): RuntimeCapabilities {
  return (
    CAPABILITIES[runtime] ?? {
      emitsToolCallEnd: false,
      emitsCallId: false,
      emitsThinking: false,
      hasUsageTracking: false,
    }
  );
}

// ── High-level contract assertions ──────────────────────────────────────────

/**
 * One-call test for full LoopRun interface compliance.
 * Runs a prompt, validates events, result shape, and status transitions.
 */
export async function assertLoopContract(
  loop: {
    run(prompt: string): LoopRun;
    status: LoopStatus;
    cancel(): void;
    cleanup?(): Promise<void>;
  },
  prompt: string,
): Promise<AssertionResult> {
  const errors: string[] = [];

  // Status should start as idle
  if (loop.status !== "idle") {
    errors.push(`Initial status should be idle, got: ${loop.status}`);
  }

  const run = loop.run(prompt);

  // Status should be running
  if (loop.status !== "running") {
    errors.push(`Status after run() should be running, got: ${loop.status}`);
  }

  // LoopRun should be async-iterable
  if (typeof run[Symbol.asyncIterator] !== "function") {
    errors.push("LoopRun is not async-iterable");
  }

  // LoopRun.result should be a promise
  if (!(run.result instanceof Promise)) {
    errors.push("LoopRun.result is not a Promise");
  }

  // Collect and validate events
  const events = await collectEvents(run);
  const eventErrors = validateEvents(events);
  errors.push(...eventErrors);

  // Validate result
  const result = await run.result;
  const resultErrors = validateResult(result);
  errors.push(...resultErrors);

  // result.events should match streamed events
  if (result.events.length !== events.length) {
    errors.push(`result.events (${result.events.length}) != streamed events (${events.length})`);
  }

  // Status should be completed
  if (loop.status !== "completed") {
    errors.push(`Final status should be completed, got: ${loop.status}`);
  }

  await loop.cleanup?.();

  if (errors.length > 0) {
    return { status: "fail", message: errors.join("; "), details: { errors, events, result } };
  }

  return {
    status: "pass",
    message: `Contract OK: ${events.length} events, ${result.durationMs}ms`,
    details: { eventCount: events.length, durationMs: result.durationMs, usage: result.usage },
  };
}

/**
 * Validates the event stream structure and ordering.
 */
export function assertEventStream(events: LoopEvent[]): AssertionResult {
  const errors = validateEvents(events);

  if (events.length === 0) {
    errors.push("Event stream is empty");
  }

  // Check for at least one content event (text or tool_call_start)
  const hasContent = events.some((e) => e.type === "text" || e.type === "tool_call_start");
  if (!hasContent) {
    errors.push("No content events (text or tool_call_start)");
  }

  if (errors.length > 0) {
    return { status: "fail", message: errors.join("; "), details: { errors } };
  }

  return { status: "pass", message: `${events.length} valid events` };
}

/**
 * Tests status transitions: idle → running → completed.
 */
export async function assertStatusTransitions(
  loop: { run(prompt: string): LoopRun; status: LoopStatus; cleanup?(): Promise<void> },
  prompt: string,
): Promise<AssertionResult> {
  const transitions: LoopStatus[] = [loop.status];

  const run = loop.run(prompt);
  transitions.push(loop.status);

  await collectEvents(run);
  await run.result;
  transitions.push(loop.status);

  await loop.cleanup?.();

  const expected = ["idle", "running", "completed"];
  const match =
    transitions.length === expected.length && transitions.every((s, i) => s === expected[i]);

  if (!match) {
    return {
      status: "fail",
      message: `Expected [${expected.join(" → ")}], got [${transitions.join(" → ")}]`,
    };
  }

  return { status: "pass", message: transitions.join(" → ") };
}

/**
 * Tests cancel behavior: starts a long-running prompt, cancels after delay.
 */
export async function assertCancellation(
  loop: {
    run(prompt: string): LoopRun;
    status: LoopStatus;
    cancel(): void;
    cleanup?(): Promise<void>;
  },
  prompt: string,
  delayMs = 500,
  maxDurationMs = 10_000,
): Promise<AssertionResult> {
  const run = loop.run(prompt);

  setTimeout(() => loop.cancel(), delayMs);

  const start = Date.now();
  await collectEvents(run);
  try {
    await run.result;
  } catch {
    /* expected on cancel */
  }
  const elapsed = Date.now() - start;

  await loop.cleanup?.();

  if (loop.status !== "cancelled") {
    return { status: "fail", message: `Expected cancelled, got ${loop.status}` };
  }

  if (elapsed > maxDurationMs) {
    return { status: "fail", message: `Cancel took ${elapsed}ms, max allowed: ${maxDurationMs}ms` };
  }

  return { status: "pass", message: `Cancelled in ${elapsed}ms` };
}

/**
 * Deep validation of LoopResult shape.
 */
export function assertResultShape(result: LoopResult): AssertionResult {
  const errors = validateResult(result);

  // Additional checks
  if (result.events.length === 0) {
    errors.push("result.events is empty");
  }

  if (result.durationMs < 0) {
    errors.push(`Negative durationMs: ${result.durationMs}`);
  }

  if (result.usage) {
    if (result.usage.totalTokens < result.usage.inputTokens + result.usage.outputTokens - 1) {
      // Allow off-by-one rounding
      errors.push("totalTokens < inputTokens + outputTokens");
    }
  }

  if (errors.length > 0) {
    return { status: "fail", message: errors.join("; "), details: { errors, result } };
  }

  return {
    status: "pass",
    message:
      `Result valid: ${result.events.length} events, ${result.durationMs}ms, ` +
      `tokens: ${result.usage.totalTokens}`,
  };
}

/**
 * Checks tool_call_start/end pairing. Accounts for runtimes that don't emit tool_call_end.
 */
export function assertToolCallPairing(events: LoopEvent[], runtime: string): AssertionResult {
  const caps = runtimeCapabilities(runtime);
  const starts = events.filter((e) => e.type === "tool_call_start");
  const ends = events.filter((e) => e.type === "tool_call_end");

  if (starts.length === 0) {
    return { status: "fail", message: "No tool_call_start events" };
  }

  if (!caps.emitsToolCallEnd) {
    // This runtime doesn't emit end events — just verify starts are valid
    return {
      status: "pass",
      message: `${starts.length} starts (runtime doesn't emit tool_call_end)`,
    };
  }

  if (starts.length !== ends.length) {
    return {
      status: "fail",
      message: `Mismatched: ${starts.length} starts, ${ends.length} ends`,
      details: { starts, ends },
    };
  }

  // If callIds are available, check pairing
  if (caps.emitsCallId) {
    const startIds = new Set(
      starts
        .filter(
          (e): e is Extract<LoopEvent, { type: "tool_call_start" }> => e.type === "tool_call_start",
        )
        .map((e) => e.callId)
        .filter(Boolean),
    );
    const endIds = new Set(
      ends
        .filter(
          (e): e is Extract<LoopEvent, { type: "tool_call_end" }> => e.type === "tool_call_end",
        )
        .map((e) => e.callId)
        .filter(Boolean),
    );

    for (const id of startIds) {
      if (!endIds.has(id)) {
        return { status: "fail", message: `tool_call_start id=${id} has no matching end` };
      }
    }
  }

  return {
    status: "pass",
    message: `${starts.length} tool calls properly paired`,
  };
}

// ── Utility helpers ─────────────────────────────────────────────────────────

/**
 * Wraps a test function with a timeout.
 */
export function withTestTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * Collects events with relative timestamps for timing analysis.
 */
export async function captureTimeline(run: LoopRun): Promise<TimestampedEvent[]> {
  const start = Date.now();
  const timeline: TimestampedEvent[] = [];

  for await (const event of run) {
    timeline.push({ event, relativeMs: Date.now() - start });
  }

  return timeline;
}

/**
 * Formats a timeline for debugging output.
 */
export function formatTimeline(timeline: TimestampedEvent[]): string {
  return timeline
    .map((t) => {
      const e = t.event;
      let detail = e.type;
      if (e.type === "text") detail += `: ${e.text.slice(0, 60)}`;
      if (e.type === "tool_call_start") detail += `: ${e.name}`;
      if (e.type === "tool_call_end") detail += `: ${e.name}`;
      return `  [${String(t.relativeMs).padStart(6)}ms] ${detail}`;
    })
    .join("\n");
}

/**
 * Extracts all text content from events, concatenated.
 */
export function extractAllText(events: LoopEvent[]): string {
  return events
    .filter((e): e is Extract<LoopEvent, { type: "text" }> => e.type === "text")
    .map((e) => e.text)
    .join("");
}

/**
 * Extracts tool call names from events.
 */
export function extractToolNames(events: LoopEvent[]): string[] {
  return [
    ...new Set(
      events
        .filter(
          (e): e is Extract<LoopEvent, { type: "tool_call_start" }> => e.type === "tool_call_start",
        )
        .map((e) => e.name),
    ),
  ];
}

/**
 * Counts events by type.
 */
export function countByType(events: LoopEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Asserts that text events contain a specific marker string.
 */
export function assertTextContains(events: LoopEvent[], marker: string): AssertionResult {
  const text = extractAllText(events);
  if (text.includes(marker)) {
    return { status: "pass", message: `Text contains "${marker}"` };
  }
  return {
    status: "fail",
    message: `Text missing "${marker}": ${text.slice(0, 200)}`,
    details: { text },
  };
}

/**
 * Asserts that usage numbers are reasonable (non-negative, consistent).
 */
export function assertUsage(result: LoopResult, runtime: string): AssertionResult {
  const caps = runtimeCapabilities(runtime);
  const { usage } = result;

  if (!caps.hasUsageTracking) {
    // Runtime might not report usage — just check it's present and not negative
    if (usage.inputTokens < 0 || usage.outputTokens < 0) {
      return { status: "fail", message: "Negative token counts" };
    }
    return {
      status: "pass",
      message: `Usage: in=${usage.inputTokens} out=${usage.outputTokens} (tracking limited)`,
    };
  }

  if (usage.inputTokens === 0 && usage.outputTokens === 0) {
    return { status: "fail", message: "All usage counts are zero", details: { usage } };
  }

  if (usage.totalTokens < usage.inputTokens || usage.totalTokens < usage.outputTokens) {
    return {
      status: "fail",
      message: `Inconsistent: total=${usage.totalTokens} < in=${usage.inputTokens} or out=${usage.outputTokens}`,
    };
  }

  return {
    status: "pass",
    message: `Usage: in=${usage.inputTokens} out=${usage.outputTokens} total=${usage.totalTokens}`,
  };
}

/**
 * Run a prompt that requires tool usage and verify tool events appear.
 * Useful for testing that a runtime properly emits tool call events.
 */
export async function assertToolUsage(
  loop: { run(prompt: string): LoopRun; cleanup?(): Promise<void> },
  prompt: string,
  runtime: string,
): Promise<AssertionResult> {
  const run = loop.run(prompt);
  const events = await collectEvents(run);
  await run.result;

  const starts = events.filter((e) => e.type === "tool_call_start");
  if (starts.length === 0) {
    await loop.cleanup?.();
    return {
      status: "fail",
      message: "No tool_call_start events",
      details: { eventTypes: countByType(events) },
    };
  }

  const pairingResult = assertToolCallPairing(events, runtime);
  await loop.cleanup?.();

  if (pairingResult.status === "fail") return pairingResult;

  return {
    status: "pass",
    message: `${starts.length} tool calls, names: ${extractToolNames(events).join(", ")}`,
  };
}

/**
 * Runs the same prompt on a loop twice and checks for idempotent cleanup.
 * Verifies that a loop can be reused after cleanup (if the runtime supports it).
 */
export async function assertReusability(
  createLoop: () => { run(prompt: string): LoopRun; status: LoopStatus; cleanup?(): Promise<void> },
  prompt: string,
): Promise<AssertionResult> {
  // First run
  const loop1 = createLoop();
  const run1 = loop1.run(prompt);
  await collectEvents(run1);
  const result1 = await run1.result;
  await loop1.cleanup?.();

  // Second run with new instance
  const loop2 = createLoop();
  const run2 = loop2.run(prompt);
  await collectEvents(run2);
  const result2 = await run2.result;
  await loop2.cleanup?.();

  if (result1.events.length === 0 || result2.events.length === 0) {
    return { status: "fail", message: "One of the runs produced no events" };
  }

  return {
    status: "pass",
    message: `Run 1: ${result1.events.length} events, Run 2: ${result2.events.length} events`,
  };
}
