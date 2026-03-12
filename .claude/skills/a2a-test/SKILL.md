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

A2A tests are run manually using the unified `aw` CLI (packages/agent-worker/src/cli/index.ts):

```bash
# 1. Start the daemon
aw up

# 2. Create an agent with a specific runtime
aw create test-agent --runtime ai-sdk --model anthropic:claude-haiku-4-5-20251001
aw create test-agent --runtime claude-code --model sonnet
aw create test-agent --runtime codex
aw create test-agent --runtime cursor
aw create test-agent --runtime mock   # test without API keys

# 3. Send messages and observe behavior
aw send test-agent "Reply with exactly: HELLO_A2A_TEST"
aw read test-agent     # View responses
aw log --json          # View debug events
aw state test-agent    # View agent state

# 4. Clean up
aw rm test-agent       # Remove agent
aw down                # Stop daemon
```

## Test flow

For each runtime, verify in order:

1. **Preflight** — Daemon starts successfully (`aw up`), agent created (`aw create`)
2. **Simple prompt** — Send a trivial prompt, verify text response contains marker
3. **Event structure** — `aw log --json` entries have correct type/shape
4. **Result structure** — `run_end` has durationMs > 0, usage tracking (where supported)
5. **Status transitions** — `aw log -f` shows idle → processing → idle
6. **Cancel** — `aw rm` during processing terminates cleanly
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
