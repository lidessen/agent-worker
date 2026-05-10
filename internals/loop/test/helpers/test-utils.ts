/**
 * Test utilities for @agent-worker/loop tests.
 */

import type { LoopEvent, LoopRun } from "../../src/types.ts";

/** Drain all events from a LoopRun into an array */
export async function collectEvents(run: LoopRun): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  for await (const event of run) {
    events.push(event);
  }
  return events;
}

/** Drain events, swallowing iterator errors (for error-path tests) */
export async function collectEventsSafe(run: LoopRun): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  try {
    for await (const event of run) {
      events.push(event);
    }
  } catch {
    // Expected — channel.error() propagates through the iterator
  }
  return events;
}

/** Filter events by type */
export function eventsOfType<T extends LoopEvent["type"]>(
  events: LoopEvent[],
  type: T,
): Extract<LoopEvent, { type: T }>[] {
  return events.filter((e) => e.type === type) as Extract<LoopEvent, { type: T }>[];
}

/** Wrap a promise with a timeout guard */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = "Operation"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Check if an event stream contains at least one text event with non-empty content */
export function hasTextOutput(events: LoopEvent[]): boolean {
  return events.some((e) => e.type === "text" && e.text.trim().length > 0);
}

/** Check if an event stream contains tool calls (start or end) */
export function hasToolCalls(events: LoopEvent[]): boolean {
  return events.some((e) => e.type === "tool_call_start" || e.type === "tool_call_end");
}

/** Get all unique tool names from events */
export function getToolNames(events: LoopEvent[]): string[] {
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

/** Pretty-print events for debugging */
export function formatEventSummary(events: LoopEvent[]): string {
  const counts: Record<string, number> = {};
  for (const e of events) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");
}
