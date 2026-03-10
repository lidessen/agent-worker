---
name: a2a-test
description: "Systematically test the @agent-worker/loop and @agent-worker/agent packages against real LLM backends using the aw CLI. A2A tests are interactive, CLI-driven tests — not automated TS scripts. Use this skill when the user asks to test loops, run a2a tests, verify runtime implementations, or check if agent loops work correctly. Trigger on phrases like 'test loops', 'run a2a tests', 'test the runtimes', 'verify loop implementations', 'check if claude/codex/cursor works'."
---

# A2A Test Skill

A2A (Agent-to-Agent) tests verify real runtime behavior against live LLM backends. They are **interactive CLI tests** using the `aw` CLI tool — not automated TS scripts.

## Test plans

All a2a test procedures are documented as markdown:

- **`packages/loop/test/a2a/loop-tests.md`** — Loop-level tests per runtime (AiSdkLoop, ClaudeCodeLoop, CodexLoop, CursorLoop)
- **`packages/agent/test/a2a/agent-tests.md`** — Agent-level end-to-end tests across all providers
- **`packages/agent/test/a2a/messaging.md`** — Async messaging pipeline tests (batching, interleaving, state transitions)

## How to run

A2A tests are run manually using the `aw` CLI:

```bash
# 1. Start the daemon (pick a runtime/model)
aw start --model anthropic:claude-haiku-4-5-20251001
aw start --runtime claude-code --model sonnet
aw start --runtime codex
aw start --runtime cursor

# 2. Send messages and observe behavior
aw send "Reply with exactly: HELLO_A2A_TEST"
aw recv          # View responses
aw log --json    # View debug events
aw state         # View agent state

# 3. Stop the daemon
aw stop
```

## Test flow

For each runtime, verify in order:

1. **Preflight** — Daemon starts successfully (API key / CLI available)
2. **Simple prompt** — Send a trivial prompt, verify text response contains marker
3. **Event structure** — `aw log --json` entries have correct type/shape
4. **Result structure** — `run_end` has durationMs > 0, usage tracking (where supported)
5. **Status transitions** — `aw log --follow` shows idle → processing → idle
6. **Cancel** — `aw stop` during processing terminates cleanly
7. **Tool calls** — `tool_call_start`/`tool_call_end` pairing (where supported)

## Unit tests (separate from a2a)

Unit tests are mock-based and run with `bun test`:

```bash
bun test packages/loop/test/
bun test packages/agent/test/
```

## Loop APIs under test

Each loop class exposes:

- `preflight()` → `PreflightResult` — env/config check
- `run(prompt)` → `LoopRun` — streaming `LoopEvent` + `.result: Promise<LoopResult>`
- `cancel()` — abort in-flight run
- `status` — `"idle" | "running" | "completed" | "failed" | "cancelled"`

### Event types

- `text` — text output
- `thinking` — reasoning/chain-of-thought
- `tool_call_start` — tool invocation begins (name, callId, args)
- `tool_call_end` — tool invocation completes (name, callId, result, durationMs, error)
- `error` — error occurred
- `unknown` — unrecognized event from provider

### Runtime capability matrix

| Capability       | AiSdkLoop | ClaudeCodeLoop | CodexLoop | CursorLoop |
| ---------------- | --------- | -------------- | --------- | ---------- |
| tool_call_end    | Yes       | Yes            | Yes       | No         |
| callId in events | Yes       | Yes            | No        | Yes        |
| thinking events  | Yes       | No             | No        | No         |
| usage tracking   | Yes       | Yes            | No        | No         |

## Verdicts

When running a2a tests, record results as pass/fail/skip in the test matrix at the bottom of each markdown file.
