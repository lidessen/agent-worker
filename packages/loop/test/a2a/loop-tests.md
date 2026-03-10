# A2A Test: Loop Runtimes

Interactive CLI-based tests for verifying loop implementations against real LLM backends.
Each runtime (AiSdkLoop, ClaudeCodeLoop, CodexLoop, CursorLoop) should be tested independently.

> **Note:** A2A tests are manual/interactive — run commands in the terminal and verify output visually.
> Do NOT run `.ts` files directly. Use the `aw` CLI for all testing.

---

## Prerequisites

```sh
# 1. Build the project
bun install && bun run build

# 2. Set API keys for the providers you want to test:
export ANTHROPIC_API_KEY="sk-..."
export OPENAI_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."

# 3. For CLI runtimes, verify the CLI is installed:
claude --version    # ClaudeCodeLoop
codex --version     # CodexLoop
cursor --version    # CursorLoop (agent CLI)
```

---

## 1. AiSdkLoop Tests

### T1.1: Preflight — API key detection

```sh
# Terminal 1: Start with Anthropic backend
aw start --model anthropic:claude-haiku-4-5-20251001
```

**Expected:** Daemon starts successfully, no errors about missing API key.

```sh
# Without API key — should fail gracefully
unset ANTHROPIC_API_KEY
aw start --model anthropic:claude-haiku-4-5-20251001
```

**Expected:** Error message about missing API key, daemon does not start.

---

### T1.2: Simple prompt — text response with marker

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send "Reply with exactly: HELLO_A2A_TEST"
sleep 3
aw recv
aw stop
```

**Expected:**
- `recv` output contains the string `HELLO_A2A_TEST`
- At least one text response block

---

### T1.3: Event stream structure

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send "Say OK"
sleep 3
aw log --json
aw stop
```

**Expected:** Each JSON log entry has:
- `type` field (string) — one of: `text`, `thinking`, `tool_call_start`, `tool_call_end`, `error`, `unknown`
- `text` events have a `text` (string) field
- `tool_call_start` events have a `name` (string) field
- `tool_call_end` events have a `name` (string) field
- No events with missing `type`

---

### T1.4: Result structure — usage tracking

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send "Reply: OK"
sleep 3
aw log --json
aw stop
```

**Expected:** `run_end` entry in the log contains:
- `durationMs` > 0
- `usage.inputTokens` > 0
- `usage.outputTokens` > 0
- `usage.totalTokens` >= `inputTokens + outputTokens`

---

### T1.5: Status transitions — idle → running → completed

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw log --follow &
LOG_PID=$!
sleep 1
aw send "Reply: hi"
sleep 5
kill $LOG_PID
aw stop
```

**Expected log sequence:**
1. `[state_change] → waiting` or `→ processing`
2. `[run_start]`
3. `[run_end]`
4. `[state_change] → idle`

---

### T1.6: Cancel mid-run

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw send "Write a very long essay about the entire history of mathematics, covering every century in detail"
sleep 1
aw stop
```

**Expected:**
- Daemon stops within a few seconds (not waiting for full response)
- No orphan processes

---

### T1.7: Cleanup idempotent

```sh
# Terminal 1:
aw start --model anthropic:claude-haiku-4-5-20251001

# Terminal 2:
aw stop
aw stop  # second stop should not error
```

**Expected:** Second `aw stop` prints "No running daemon" or similar, no crash.

---

### T1.8: OpenAI backend

Repeat T1.2 and T1.3 with OpenAI:

```sh
aw start --model openai:gpt-4.1-nano
aw send "Reply with exactly: HELLO_OPENAI_A2A"
sleep 3
aw recv
aw log --json
aw stop
```

**Expected:** Same as T1.2/T1.3 but with OpenAI model.

---

## 2. ClaudeCodeLoop Tests

### T2.1: CLI availability

```sh
claude --version
```

**Expected:** Prints version string (e.g., `1.x.x`). If not installed, skip all T2.x tests.

---

### T2.2: Simple prompt

```sh
# Terminal 1:
aw start --runtime claude-code --model sonnet

# Terminal 2:
aw send "Reply with exactly: HELLO_A2A_TEST"
sleep 5
aw recv
aw stop
```

**Expected:** `recv` output contains `HELLO_A2A_TEST`.

---

### T2.3: Result structure

```sh
# Terminal 1:
aw start --runtime claude-code --model sonnet

# Terminal 2:
aw send "Reply with: OK"
sleep 5
aw log --json
aw stop
```

**Expected:** `run_end` entry has `durationMs` > 0, `usage.inputTokens` > 0, `usage.outputTokens` > 0.

---

### T2.4: Status transitions

```sh
# Terminal 1:
aw start --runtime claude-code --model sonnet

# Terminal 2:
aw log --follow &
LOG_PID=$!
aw send "Reply: hi"
sleep 8
kill $LOG_PID
aw stop
```

**Expected:** Log shows `run_start` → (events) → `run_end`, state goes to `idle`.

---

### T2.5: Cancel

```sh
# Terminal 1:
aw start --runtime claude-code --model sonnet

# Terminal 2:
aw send "Write a 500-word essay about the history of computing"
sleep 2
aw stop
```

**Expected:** Daemon stops cleanly within a few seconds.

---

### T2.6: Tool call events

```sh
# Terminal 1:
aw start --runtime claude-code --model sonnet

# Terminal 2:
aw send 'Run this bash command and tell me the result: echo "A2A_TOOL_TEST"'
sleep 8
aw log --json
aw stop
```

**Expected:**
- Log has at least one `tool_call_start` entry with `name` containing "Bash" or "bash"
- Each `tool_call_start` has a matching `tool_call_end`
- `tool_call_start.name` is a non-empty string

---

## 3. CodexLoop Tests

### T3.1: CLI availability

```sh
codex --version
```

**Expected:** Prints version. If not installed, skip all T3.x tests.

---

### T3.2: Simple prompt

```sh
# Terminal 1:
aw start --runtime codex

# Terminal 2:
aw send "Reply with exactly: HELLO_A2A_TEST"
sleep 5
aw recv
aw stop
```

**Expected:** `recv` output contains text response (marker may vary for Codex).

---

### T3.3: Result structure

```sh
# Terminal 1:
aw start --runtime codex

# Terminal 2:
aw send "Reply with: OK"
sleep 5
aw log --json
aw stop
```

**Expected:** `run_end` entry has `durationMs` > 0, events array is non-empty.

> **Note:** CodexLoop may not report token usage — `usage` fields may be 0. This is expected.

---

### T3.4: Status transitions

```sh
# Terminal 1:
aw start --runtime codex

# Terminal 2:
aw log --follow &
LOG_PID=$!
aw send "Reply: hi"
sleep 8
kill $LOG_PID
aw stop
```

**Expected:** Log shows idle → running → completed sequence.

---

### T3.5: Cancel

```sh
# Terminal 1:
aw start --runtime codex

# Terminal 2:
aw send "Write a detailed 2000-word analysis of every major war in human history"
sleep 1
aw stop
```

**Expected:** Daemon stops cleanly.

---

## 4. CursorLoop Tests

### T4.1: CLI availability

```sh
cursor --version
```

**Expected:** Prints version. If not installed, skip all T4.x tests.

---

### T4.2: Simple prompt

```sh
# Terminal 1:
aw start --runtime cursor

# Terminal 2:
aw send "Reply with exactly: HELLO_A2A_TEST"
sleep 5
aw recv
aw stop
```

**Expected:** `recv` output contains text response.

---

### T4.3: Result structure

```sh
# Terminal 1:
aw start --runtime cursor

# Terminal 2:
aw send "Reply with: OK"
sleep 5
aw log --json
aw stop
```

**Expected:** `run_end` entry has `durationMs` > 0, events array non-empty.

> **Note:** CursorLoop may not emit `tool_call_end` events. This is a known limitation.

---

### T4.4: Status transitions

Same pattern as T3.4 but with `--runtime cursor`.

---

### T4.5: Cancel

```sh
# Terminal 1:
aw start --runtime cursor

# Terminal 2:
aw send "Write a long essay about history"
sleep 1
aw stop
```

**Expected:** Daemon stops cleanly.

---

## 5. DeepSeek Async Communication Tests

These test the inbox → reply → ack workflow using DeepSeek as the backend.

### T5.1: Preflight

```sh
echo $DEEPSEEK_API_KEY  # should be non-empty
aw start --model deepseek:deepseek-chat
```

**Expected:** Daemon starts if key is set.

---

### T5.2: Inbox → Reply → Ack cycle

```sh
# Terminal 1:
aw start --model deepseek:deepseek-chat

# Terminal 2:
aw send "Check your inbox and respond to all pending messages"
sleep 10
aw log --json
aw stop
```

**Expected log contains:**
- `tool_call_start` with `name: "my_inbox"`
- `tool_call_start` with `name: "channel_send"` (after my_inbox)
- `tool_call_start` with `name: "my_inbox_ack"` (after channel_send)
- All tool calls properly paired (start/end)
- Ordering: inbox before send, send before ack

---

### T5.3: Tool call pairing

```sh
# Terminal 1:
aw start --model deepseek:deepseek-chat

# Terminal 2:
aw send "Check inbox."
sleep 8
aw log --json
aw stop
```

**Expected:**
- Count of `tool_call_start` entries equals count of `tool_call_end` entries
- Each `tool_call_end` has a preceding `tool_call_start` with the same `name`

---

## 6. Runtime Capability Matrix

Reference for what each runtime supports:

| Capability       | AiSdkLoop | ClaudeCodeLoop | CodexLoop | CursorLoop |
|------------------|-----------|----------------|-----------|------------|
| tool_call_end    | Yes       | Yes            | Yes       | No         |
| callId in events | Yes       | Yes            | No        | Yes        |
| thinking events  | Yes       | No             | No        | No         |
| usage tracking   | Yes       | Yes            | No        | No         |

---

## Test Result Matrix

Fill in pass/fail/skip for each test:

| Test  | ai-sdk (anthropic) | ai-sdk (openai) | claude-code | codex | cursor | deepseek |
|-------|--------------------|-----------------|-------------|-------|--------|----------|
| T*.1  |                    |                 |             |       |        |          |
| T*.2  |                    |                 |             |       |        |          |
| T*.3  |                    |                 |             |       |        |          |
| T*.4  |                    |                 |             |       |        |          |
| T*.5  |                    |                 |             |       |        |          |
| T*.6  |                    | N/A             |             | N/A   | N/A    | N/A      |
