#!/usr/bin/env bun
/**
 * A2A test runner for @agent-worker/agent package.
 *
 * Usage:
 *   bun packages/agent/test/a2a/run-all.ts            # all tests
 *   bun packages/agent/test/a2a/run-all.ts ai-sdk      # only AI SDK backend
 */

const runtimes = [{ name: "ai-sdk", file: "test-agent-ai-sdk.ts" }];

const filter = process.argv.slice(2);
const selected = filter.length > 0 ? runtimes.filter((r) => filter.includes(r.name)) : runtimes;

if (selected.length === 0) {
  console.error(`No matching runtimes. Available: ${runtimes.map((r) => r.name).join(", ")}`);
  process.exit(1);
}

console.log(`\n🧪 Agent A2A Tests — ${selected.map((r) => r.name).join(", ")}\n`);

let failed = 0;

for (const runtime of selected) {
  const testFile = new URL(runtime.file, import.meta.url).pathname;
  console.log(`\n─── ${runtime.name} ───\n`);

  const proc = Bun.spawn(["bun", "run", testFile], {
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    failed++;
  }
}

console.log(`\n${"═".repeat(60)}`);
if (failed > 0) {
  console.log(`${failed} runtime(s) had failures.`);
  process.exit(1);
} else {
  console.log("All agent A2A tests passed.");
}
