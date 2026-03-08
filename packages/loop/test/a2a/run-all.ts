#!/usr/bin/env bun
/**
 * A2A test runner — runs all runtime tests sequentially.
 *
 * Usage:
 *   bun packages/loop/test/a2a/run-all.ts                    # all runtimes
 *   bun packages/loop/test/a2a/run-all.ts claude-code ai-sdk  # specific runtimes
 */

import { Glob } from "bun";

const requested = new Set(process.argv.slice(2));
const testDir = import.meta.dir;

const runtimes: { name: string; file: string }[] = [
  { name: "claude-code", file: "test-claude-code.ts" },
  { name: "codex", file: "test-codex.ts" },
  { name: "cursor", file: "test-cursor.ts" },
  { name: "ai-sdk", file: "test-ai-sdk.ts" },
];

const toRun = requested.size > 0
  ? runtimes.filter((r) => requested.has(r.name))
  : runtimes;

if (toRun.length === 0) {
  console.error("No matching runtimes. Available:", runtimes.map((r) => r.name).join(", "));
  process.exit(1);
}

console.log(`\n${"═".repeat(60)}`);
console.log(`A2A Test Runner — testing ${toRun.length} runtime(s)`);
console.log(`${"═".repeat(60)}`);

let totalFailed = 0;

for (const runtime of toRun) {
  const filePath = `${testDir}/${runtime.file}`;
  console.log(`\n── ${runtime.name} ──`);

  const proc = Bun.spawn(["bun", "run", filePath], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    totalFailed++;
  }
}

console.log(`\n${"═".repeat(60)}`);
if (totalFailed > 0) {
  console.log(`${totalFailed} runtime(s) had failures.`);
  process.exit(1);
} else {
  console.log("All runtime tests completed.");
}
