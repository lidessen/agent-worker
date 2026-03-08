---
name: a2a-test
description: "Systematically test the @agent-worker/loop package's real runtime implementations (AiSdkLoop, ClaudeCodeLoop, CodexLoop, CursorLoop) by executing actual code against live environments. Use this skill when the user asks to test loops, run a2a tests, verify runtime implementations, or check if agent loops work correctly. Trigger on phrases like 'test loops', 'run a2a tests', 'test the runtimes', 'verify loop implementations', 'check if claude/codex/cursor works'."
---

# A2A Loop Test Skill

You (Claude Code agent) systematically test `@agent-worker/loop` by executing real code against live runtimes. No mocks — you verify actual behavior.

## Test flow

For each runtime, verify in order:

1. **Preflight** — `preflight()` — CLI installed, API key present, auth valid (env check, not runtime test)
2. **Simple prompt** — Send a trivial prompt, verify text response contains marker
3. **Event structure** — Validate every event has correct type/shape (`tool_call_start` / `tool_call_end`)
4. **Result structure** — Check LoopResult (events, usage, durationMs)
5. **Status transitions** — idle → running → completed
6. **Cancel** — Cancel mid-run, verify status → cancelled
7. **Tool calls** — Verify `tool_call_start` has name + args, `tool_call_end` has name + result

## How to run

```bash
# All runtimes
bun packages/loop/test/a2a/run-all.ts

# Specific runtime(s)
bun packages/loop/test/a2a/run-all.ts claude-code
bun packages/loop/test/a2a/run-all.ts ai-sdk
bun packages/loop/test/a2a/run-all.ts codex cursor

# Individual test file
bun packages/loop/test/a2a/test-claude-code.ts
bun packages/loop/test/a2a/test-ai-sdk.ts
bun packages/loop/test/a2a/test-codex.ts
bun packages/loop/test/a2a/test-cursor.ts

# Unit tests (mock-based, fast)
bun test packages/loop/test/
```

## Test files

- `packages/loop/test/a2a/harness.ts` — Test framework + assertion utilities
- `packages/loop/test/a2a/test-claude-code.ts` — ClaudeCodeLoop tests
- `packages/loop/test/a2a/test-codex.ts` — CodexLoop tests
- `packages/loop/test/a2a/test-cursor.ts` — CursorLoop tests
- `packages/loop/test/a2a/test-ai-sdk.ts` — AiSdkLoop tests (requires ANTHROPIC_API_KEY)
- `packages/loop/test/a2a/run-all.ts` — Runner that spawns all test files

## Harness utilities

All from `packages/loop/test/a2a/harness.ts`:

### Test runner
- `createTest(name, runtime, fn)` — Define a test, auto-captures timing and errors
- `runSuite(runtime, tests)` — Run tests sequentially, print verdicts
- `printReport(results)` — Summary across multiple suites, exit(1) if any failed

### Event helpers
- `collectEvents(run)` — Drain LoopRun async iterable into array
- `extractText(events)` — Join all text event content into one string
- `extractToolStarts(events)` — Filter to `tool_call_start` events (typed)
- `extractToolEnds(events)` — Filter to `tool_call_end` events (typed)
- `assertTextContains(events, marker)` — Check text events contain a string
- `assertHasEventType(events, type)` — Check at least one event of given type exists

### Validators
- `assertPreflight(info)` — Check PreflightResult shape, return pass/skip/fail
- `validateEvents(events)` — Validate all events have correct structure
- `validateResult(result)` — Validate LoopResult shape (events, usage, durationMs)

### Utilities
- `withTimeout(ms, fn)` — Race a promise against a timeout

## Loop APIs under test

Each loop class exposes:
- `preflight()` → `PreflightResult` — env/config check (CLI installed, API key present). Not a runtime verification.
- `run(prompt)` → `LoopRun` — best-effort streaming of `LoopEvent` + `.result: Promise<LoopResult>`
- `cancel()` — abort in-flight run
- `status` — `"idle" | "running" | "completed" | "failed" | "cancelled"`

### Event types
- `text` — text output
- `thinking` — reasoning/chain-of-thought
- `tool_call_start` — tool invocation begins (name, callId, args)
- `tool_call_end` — tool invocation completes (name, callId, result, durationMs, error)
- `error` — error occurred
- `unknown` — unrecognized event from provider

### Streaming semantics
All loops stream events in real-time. AiSdkLoop uses `ToolLoopAgent.stream()` with `fullStream` for real-time text/thinking deltas, and callbacks for tool_call_start/end. CLI loops parse NDJSON streams as they arrive.

### Error propagation
Errors propagate through the async iterator (thrown from `for await`), not just via `.result` rejection. Use `collectEventsSafe()` in test-utils if you need to drain events from an error path without the iterator throwing.

## Verdicts

Each test returns `pass`, `fail`, or `skip`. Skipped tests (runtime unavailable) don't count as failures.

## Adding a new test

```ts
createTest("my-new-test", RUNTIME, async () => {
  if (!available) return { status: "skip" as TestStatus, message: "Not available" };

  const loop = new SomeLoop(/* opts */);
  const run = loop.run("prompt");
  const events = await collectEvents(run);
  const result = await run.result;

  // Use helpers
  const check = assertTextContains(events, "EXPECTED");
  if (!check.ok) return { status: "fail", message: check.message };

  const starts = extractToolStarts(events);
  if (starts.length === 0) return { status: "fail", message: "No tool calls" };

  return { status: "pass", message: "All good" };
});
```
