/**
 * A2A test harness — Agent (Claude Code) tests real runtime implementations.
 *
 * Each test is a standalone check that returns a structured verdict.
 * The agent runs these via `bun run` and interprets the results.
 */

import type { LoopEvent, LoopResult, LoopRun, PreflightResult } from "../../src/types.ts";

// ── Verdict types ───────────────────────────────────────────────────────────

export type TestStatus = "pass" | "fail" | "skip";

export interface TestVerdict {
  name: string;
  runtime: string;
  status: TestStatus;
  message: string;
  details?: unknown;
  durationMs: number;
}

export interface SuiteResult {
  runtime: string;
  verdicts: TestVerdict[];
  passed: number;
  failed: number;
  skipped: number;
}

// ── Test runner ─────────────────────────────────────────────────────────────

export type TestFn = () => Promise<TestVerdict>;

export function createTest(
  name: string,
  runtime: string,
  fn: () => Promise<{ status: TestStatus; message: string; details?: unknown }>,
): TestFn {
  return async () => {
    const start = Date.now();
    try {
      const result = await fn();
      return { name, runtime, ...result, durationMs: Date.now() - start };
    } catch (err) {
      return {
        name,
        runtime,
        status: "fail" as TestStatus,
        message: `Unexpected error: ${(err as Error).message}`,
        details: { stack: (err as Error).stack },
        durationMs: Date.now() - start,
      };
    }
  };
}

export async function runSuite(runtime: string, tests: TestFn[]): Promise<SuiteResult> {
  const verdicts: TestVerdict[] = [];

  for (const test of tests) {
    const verdict = await test();
    verdicts.push(verdict);

    const icon = verdict.status === "pass" ? "✅" : verdict.status === "fail" ? "❌" : "⏭️";
    console.log(`  ${icon} ${verdict.name} (${verdict.durationMs}ms)`);
    if (verdict.status === "fail") {
      console.log(`     → ${verdict.message}`);
    }
    if (verdict.status === "skip") {
      console.log(`     → ${verdict.message}`);
    }
  }

  return {
    runtime,
    verdicts,
    passed: verdicts.filter((v) => v.status === "pass").length,
    failed: verdicts.filter((v) => v.status === "fail").length,
    skipped: verdicts.filter((v) => v.status === "skip").length,
  };
}

export function printReport(results: SuiteResult[]) {
  console.log("\n" + "═".repeat(60));
  for (const r of results) {
    const total = r.verdicts.length;
    console.log(
      `${r.runtime}: ${r.passed}/${total} passed, ${r.failed} failed, ${r.skipped} skipped`,
    );
  }
  console.log("═".repeat(60));

  const allFailed = results.flatMap((r) => r.verdicts.filter((v) => v.status === "fail"));
  if (allFailed.length > 0) {
    console.log(`\n${allFailed.length} test(s) failed.`);
    process.exit(1);
  } else {
    console.log("\nAll tests passed.");
  }
}

// ── Shared assertions ───────────────────────────────────────────────────────

/** Collect all events from a LoopRun */
export async function collectEvents(run: LoopRun): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  for await (const event of run) {
    events.push(event);
  }
  return events;
}

/** Assert preflight check returns expected shape */
export function assertPreflight(info: PreflightResult): {
  status: TestStatus;
  message: string;
  details: unknown;
} {
  if (!info.ok) {
    return {
      status: "skip",
      message: `Not available: ${info.error ?? "unknown reason"}`,
      details: info,
    };
  }
  return {
    status: "pass",
    message: `OK${info.version ? `, version: ${info.version}` : ""}`,
    details: info,
  };
}

/** Validate LoopEvent structure */
export function validateEvents(events: LoopEvent[]): string[] {
  const errors: string[] = [];

  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (!e.type) {
      errors.push(`Event[${i}] missing type`);
      continue;
    }

    switch (e.type) {
      case "text":
        if (typeof e.text !== "string") errors.push(`Event[${i}] text: text is not a string`);
        break;
      case "thinking":
        if (typeof e.text !== "string") errors.push(`Event[${i}] thinking: text is not a string`);
        break;
      case "tool_call_start":
        if (typeof e.name !== "string")
          errors.push(`Event[${i}] tool_call_start: name is not a string`);
        break;
      case "tool_call_end":
        if (typeof e.name !== "string")
          errors.push(`Event[${i}] tool_call_end: name is not a string`);
        break;
      case "error":
        if (!(e.error instanceof Error))
          errors.push(`Event[${i}] error: error is not an Error instance`);
        break;
      case "unknown":
        // unknown is always valid
        break;
      default:
        errors.push(`Event[${i}] unexpected type: ${(e as any).type}`);
    }
  }

  return errors;
}

/** Assert events contain at least one event of the given type */
export function assertHasEventType(
  events: LoopEvent[],
  type: LoopEvent["type"],
): { ok: boolean; message: string } {
  const found = events.some((e) => e.type === type);
  return found
    ? { ok: true, message: `Found ${type} event` }
    : { ok: false, message: `No ${type} event found in ${events.length} events` };
}

/** Extract all text from text events, joined */
export function extractText(events: LoopEvent[]): string {
  return events
    .filter((e): e is Extract<LoopEvent, { type: "text" }> => e.type === "text")
    .map((e) => e.text)
    .join(" ");
}

/** Assert text events contain a marker string */
export function assertTextContains(
  events: LoopEvent[],
  marker: string,
): { ok: boolean; message: string; text: string } {
  const text = extractText(events);
  return text.includes(marker)
    ? { ok: true, message: `Text contains "${marker}"`, text }
    : { ok: false, message: `Text missing "${marker}": ${text.slice(0, 200)}`, text };
}

/** Extract tool_call_start events */
export function extractToolStarts(events: LoopEvent[]) {
  return events.filter(
    (e): e is Extract<LoopEvent, { type: "tool_call_start" }> => e.type === "tool_call_start",
  );
}

/** Extract tool_call_end events */
export function extractToolEnds(events: LoopEvent[]) {
  return events.filter(
    (e): e is Extract<LoopEvent, { type: "tool_call_end" }> => e.type === "tool_call_end",
  );
}

/** Run with a timeout — rejects if fn takes longer than ms */
export function withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Validate LoopResult structure */
export function validateResult(result: LoopResult): string[] {
  const errors: string[] = [];

  if (!Array.isArray(result.events)) errors.push("result.events is not an array");
  if (typeof result.durationMs !== "number") errors.push("result.durationMs is not a number");
  if (result.durationMs <= 0) errors.push("result.durationMs should be positive");

  if (!result.usage) {
    errors.push("result.usage is missing");
  } else {
    if (typeof result.usage.inputTokens !== "number")
      errors.push("usage.inputTokens is not a number");
    if (typeof result.usage.outputTokens !== "number")
      errors.push("usage.outputTokens is not a number");
    if (typeof result.usage.totalTokens !== "number")
      errors.push("usage.totalTokens is not a number");
  }

  return errors;
}
