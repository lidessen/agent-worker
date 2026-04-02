#!/usr/bin/env bun
/**
 * Extract evaluation metrics from agent-worker event logs.
 *
 * Usage:
 *   aw log --json | bun tools/evals/eval-metrics.ts
 *   bun tools/evals/eval-metrics.ts < events.jsonl
 */

import { createInterface } from "node:readline";

interface Event {
  ts: string;
  kind: string;
  agent?: string;
  type?: string;
  data?: unknown;
  [key: string]: unknown;
}

interface AgentMetrics {
  events: number;
  toolCalls: number;
  messages: number;
  errors: number;
  firstEventTs: string | null;
  lastEventTs: string | null;
}

const events: Event[] = [];
const rl = createInterface({ input: process.stdin });

for await (const line of rl) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  try {
    events.push(JSON.parse(trimmed) as Event);
  } catch {
    // Skip non-JSON lines.
  }
}

if (events.length === 0) {
  console.error("No events found. Pipe JSONL events via stdin.");
  console.error("  aw log --json | bun tools/evals/eval-metrics.ts");
  process.exit(1);
}

const agentMap = new Map<string, AgentMetrics>();

function getAgent(name: string): AgentMetrics {
  let metrics = agentMap.get(name);
  if (!metrics) {
    metrics = {
      events: 0,
      toolCalls: 0,
      messages: 0,
      errors: 0,
      firstEventTs: null,
      lastEventTs: null,
    };
    agentMap.set(name, metrics);
  }
  return metrics;
}

for (const ev of events) {
  const agent = ev.agent ?? "unknown";
  const metrics = getAgent(agent);
  metrics.events++;
  metrics.lastEventTs = ev.ts;
  if (!metrics.firstEventTs) metrics.firstEventTs = ev.ts;

  if (ev.kind === "tool_call" || ev.type === "tool_call_start") metrics.toolCalls++;
  if (ev.kind === "message") metrics.messages++;
  if (ev.kind === "error" || ev.type === "error") metrics.errors++;
}

const firstTs = events[0]?.ts;
const lastTs = events[events.length - 1]?.ts;
const durationMs = firstTs && lastTs ? new Date(lastTs).getTime() - new Date(firstTs).getTime() : 0;

console.log("=== Agent-Worker Eval Metrics ===\n");
console.log(`Total events:  ${events.length}`);
console.log(`Time span:     ${firstTs} → ${lastTs}`);
console.log(
  `Duration:      ${(durationMs / 1000).toFixed(1)}s (${(durationMs / 60000).toFixed(1)}min)`,
);
console.log(`Agents active: ${agentMap.size}`);
console.log();

console.log("Per-Agent Breakdown:");
console.log("| Agent | Events | Tool Calls | Messages | Errors | Active Window |");
console.log("|-------|--------|-----------|----------|--------|---------------|");

for (const [name, metrics] of [...agentMap.entries()].sort((a, b) => b[1].events - a[1].events)) {
  const window =
    metrics.firstEventTs && metrics.lastEventTs
      ? `${((new Date(metrics.lastEventTs).getTime() - new Date(metrics.firstEventTs).getTime()) / 1000).toFixed(0)}s`
      : "—";
  console.log(
    `| ${name.padEnd(12)} | ${String(metrics.events).padStart(6)} | ${String(metrics.toolCalls).padStart(9)} | ${String(metrics.messages).padStart(8)} | ${String(metrics.errors).padStart(6)} | ${window.padStart(13)} |`,
  );
}

console.log();

const totalToolCalls = [...agentMap.values()].reduce((sum, metrics) => sum + metrics.toolCalls, 0);
const totalMessages = [...agentMap.values()].reduce((sum, metrics) => sum + metrics.messages, 0);
const totalErrors = [...agentMap.values()].reduce((sum, metrics) => sum + metrics.errors, 0);

console.log(
  `Totals: ${totalToolCalls} tool calls, ${totalMessages} messages, ${totalErrors} errors`,
);
console.log();

if (agentMap.size > 1) {
  const overlapping = [...agentMap.values()].filter(
    (metrics) => metrics.firstEventTs && metrics.lastEventTs && metrics.events > 1,
  ).length;
  console.log(`Parallelism: ${overlapping}/${agentMap.size} agents had overlapping activity`);
}
