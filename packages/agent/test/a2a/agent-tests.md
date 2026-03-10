# A2A Test: Agent End-to-End

Interactive CLI-based tests for the full Agent lifecycle across all available providers.
Tests the Agent wrapper (not just the loop): init → push message → process → verify state → stop.

> **Note:** A2A tests are manual/interactive — run commands in the terminal and verify output visually.
> Do NOT run `.ts` files directly. Use the `aw` CLI for all testing.

---

## Prerequisites

```sh
# 1. Build
bun install && bun run build

# 2. API keys (set whichever providers you want to test):
export ANTHROPIC_API_KEY="sk-..."
export OPENAI_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."
export KIMI_CODE_API_KEY="sk-..."
export BIGMODEL_API_KEY_CN="sk-..."
export MINIMAX_CODE_API_KEY_CN="sk-..."

# 3. CLI tools (optional):
claude --version
codex --version
cursor --version
```

---

## 1. Preflight — Provider Availability

For each provider, verify the daemon starts:

```sh
# Anthropic (AI SDK)
aw start --model anthropic:claude-haiku-4-5-20251001
aw stop

# OpenAI (AI SDK)
aw start --model openai:gpt-4.1-nano
aw stop

# DeepSeek (AI SDK)
aw start --model deepseek:deepseek-chat
aw stop

# Claude Code (CLI)
aw start --runtime claude-code --model haiku
aw stop

# Codex (CLI)
aw start --runtime codex
aw stop

# Cursor (CLI)
aw start --runtime cursor
aw stop
```

**Expected:** Each `start` succeeds if the API key / CLI is available. Prints error and exits if not.

---

## 2. Simple Message → LLM Response

Test basic message → response flow.

```sh
# Terminal 1 (pick one provider):
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send "Reply with exactly: AGENT_A2A_OK"
sleep 5
aw recv
aw stop
```

**Expected:**
- `recv` output contains the string `AGENT_A2A_OK`
- At least one text response block

**Repeat with each provider.** For CLI runtimes, adjust wait time to ~10s.

---

## 3. State Transitions

Verify the Agent state machine: idle → waiting → processing → idle.

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw log --follow &
LOG_PID=$!
sleep 1
aw send "Say hi"
sleep 5
kill $LOG_PID
aw stop
```

**Expected log sequence:**
1. `[state_change] → waiting`
2. `[state_change] → processing`
3. `[run_start] #1`
4. `[run_end] Nms`
5. `[state_change] → idle`

**Key verification:**
- `processing` state appears after message is sent
- Terminal state (`idle`) appears after run completes
- No `error` state in the sequence

---

## 4. Tool Call — agent_notes

Test that the Agent can call built-in tools and produce side effects.

```sh
# Terminal 1:
aw start --model anthropic:claude-sonnet-4-20250514

# Terminal 2:
aw send 'Save a note: key="ping" content="pong"'
sleep 8
aw log --json
aw recv
aw stop
```

**Expected:**
- `log --json` contains `tool_call_start` with name `agent_notes` (or ending in `__agent_notes`)
- `log --json` contains matching `tool_call_end`
- `recv` shows confirmation text from the agent

> **Note:** Skip this test for providers with `toolSupport: false`.

---

## 5. Context Assembly — Custom Instructions

Verify that custom instructions appear in the system prompt.

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001 --instructions "CUSTOM_INSTRUCTION_MARKER_12345"

# Terminal 2:
aw send "Say OK"
sleep 5
aw log --json
aw stop
```

**Expected:** `log --json` shows a `context_assembled` entry where the `system` field contains `CUSTOM_INSTRUCTION_MARKER_12345`.

---

## 6. History Persistence Across Runs

Verify conversation history grows across multiple message cycles.

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send "Say exactly: FIRST"
sleep 5
aw state          # Note "History: N turns"

aw send "Say exactly: SECOND"
sleep 5
aw state          # History count should have increased
aw stop
```

**Expected:**
- After first message: `History: 2 turns` (1 user + 1 assistant)
- After second message: `History: 4 turns` (grew by 2)

---

## 7. Stop During Processing

Verify graceful shutdown during active processing.

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send "Write a very long essay about the history of computing"
sleep 2
aw stop
aw state
```

**Expected:**
- `stop` completes within a few seconds
- `state` shows "No running daemon" (not stuck in processing)
- No orphan processes

---

## 8. Inbox Message Tracking

Verify sender attribution is preserved in messages.

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send --from test-user "Hello from user"
sleep 5
aw state
aw log --json
aw stop
```

**Expected:**
- `state` shows inbox with message `from=test-user`
- `log --json` has `message_received` event with `from: "test-user"` and `content: "Hello from user"`

---

## 9. Multi-Provider Cross-Verification

Run the same test (T2: simple message) across all available providers to verify consistent behavior:

```sh
for provider in \
  "anthropic:claude-haiku-4-5-20251001" \
  "openai:gpt-4.1-nano" \
  "deepseek:deepseek-chat"; do
  echo "=== Testing $provider ==="
  aw start --model "$provider"
  sleep 2
  aw send "Reply with exactly: CROSS_CHECK_OK"
  sleep 5
  aw recv
  aw stop
  sleep 1
done
```

For CLI runtimes:

```sh
for runtime in claude-code codex cursor; do
  echo "=== Testing $runtime ==="
  aw start --runtime "$runtime"
  sleep 2
  aw send "Reply with exactly: CROSS_CHECK_OK"
  sleep 10
  aw recv
  aw stop
  sleep 1
done
```

**Expected:** Each provider returns text containing `CROSS_CHECK_OK` (or reasonable response).

---

## Test Result Matrix

Fill in pass/fail/skip per provider:

| Test | Anthropic | OpenAI | DeepSeek | KimiCode | BigModel | MiniMax | ClaudeCode | Codex | Cursor |
|------|-----------|--------|----------|----------|----------|---------|------------|-------|--------|
| T1   |           |        |          |          |          |         |            |       |        |
| T2   |           |        |          |          |          |         |            |       |        |
| T3   |           |        |          |          |          |         |            |       |        |
| T4   |           |        |          |          |          |         |            |       |        |
| T5   |           |        |          |          |          |         |            |       |        |
| T6   |           |        |          |          |          |         |            |       |        |
| T7   |           |        |          |          |          |         |            |       |        |
| T8   |           |        |          |          |          |         |            |       |        |
| T9   |           |        |          |          |          |         |            |       |        |
