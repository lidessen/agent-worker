# A2A Test: Loop Runtimes

Interactive tests for verifying individual loop implementations.
These test the loop layer directly (no Agent wrapper).

## Prerequisites

```sh
# Ensure API keys are set for the target provider:
# ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, etc.

# For CLI runtimes, ensure the CLI is installed:
# claude --version, codex --version, cursor --version
```

## Running existing automated tests

```sh
# All runtimes
bun packages/loop/test/a2a/run-all.ts

# Specific runtime
bun packages/loop/test/a2a/run-all.ts ai-sdk
bun packages/loop/test/a2a/run-all.ts claude-code
bun packages/loop/test/a2a/run-all.ts codex
bun packages/loop/test/a2a/run-all.ts cursor
```

---

## T1: Preflight check

Verify the runtime can detect whether it's configured correctly.

```sh
bun packages/loop/test/a2a/test-ai-sdk.ts
```

**Expected:** Preflight passes if API key is set, skips if not.

---

## T2: Simple prompt → text response

Verify the loop can send a prompt and receive a text response.

**Using aw CLI (mock):**
```sh
bun packages/agent/src/cli/aw.ts start --runtime mock
# In another terminal:
aw send "Reply with exactly: HELLO_TEST"
sleep 2
aw recv
aw stop
```

**Using aw CLI (real model):**
```sh
bun packages/agent/src/cli/aw.ts start --model anthropic:claude-haiku-4-5-20251001
# In another terminal:
aw send "Reply with exactly: HELLO_TEST"
aw recv --wait 10
aw stop
```

**Expected:** `recv` output contains "HELLO_TEST" (or mock response for mock runtime).

---

## T3: Event stream structure

Verify events have the correct shape.

```sh
bun packages/agent/src/cli/aw.ts start --model anthropic:claude-haiku-4-5-20251001
# In another terminal:
aw send "Say hi"
sleep 3
aw log --json
aw stop
```

**Expected:** Each log entry has:
- `ts` (number) — timestamp
- `type` (string) — event type
- Specific fields depending on type

Valid event types: `state_change`, `message_received`, `run_start`, `run_end`, `tool_call_start`, `tool_call_end`, `thinking`, `error`, `context_assembled`

---

## T4: Status transitions

Verify the loop goes through idle → running → completed.

```sh
bun packages/agent/src/cli/aw.ts start --model anthropic:claude-haiku-4-5-20251001
# In another terminal:
aw log --follow &
aw send "Say OK"
sleep 5
aw stop
```

**Expected log sequence:**
1. `[state_change] → waiting`
2. `[state_change] → processing` (or combined)
3. `[run_start]`
4. `[run_end]`
5. `[state_change] → idle`

---

## T5: Tool calls — workspace tools

Verify tool call start/end pairing and correct execution.

```sh
bun packages/agent/src/cli/aw.ts start --model anthropic:claude-sonnet-4-20250514
# In another terminal:
aw send 'Use the agent_notes tool to write a note with key="test" content="hello"'
aw recv --wait 10
aw log
aw stop
```

**Expected:**
- `log` shows `[tool_call_start] agent_notes(...)` before `[tool_call_end] agent_notes`
- Every `tool_call_start` has a matching `tool_call_end`
- `recv` shows confirmation text

---

## T6: Cancel mid-run

Verify cancellation works cleanly.

```sh
bun packages/agent/src/cli/aw.ts start --model anthropic:claude-sonnet-4-20250514
# In another terminal:
aw send "Write a very long essay about the history of mathematics covering every century"
sleep 2
aw stop
```

**Expected:**
- Daemon stops within a few seconds
- No orphan processes left

---

## T7: DeepSeek async communication model

Test inbox → reply → ack cycle with DeepSeek (requires DEEPSEEK_API_KEY).

```sh
bun packages/loop/test/a2a/test-deepseek.ts
```

**Expected:** All tests pass, including `async-comm-inbox-reply` and `async-comm-full-cycle`.

---

## Test Matrix

| Test | ai-sdk (anthropic) | ai-sdk (openai) | claude-code | codex | cursor | mock |
|------|-------------------|-----------------|-------------|-------|--------|------|
| T1   |                   |                 |             |       |        |      |
| T2   |                   |                 |             |       |        |      |
| T3   |                   |                 |             |       |        |      |
| T4   |                   |                 |             |       |        |      |
| T5   |                   |                 |             |       |        |      |
| T6   |                   |                 |             |       |        |      |
| T7   | N/A               | N/A             | N/A         | N/A   | N/A    | N/A  |
