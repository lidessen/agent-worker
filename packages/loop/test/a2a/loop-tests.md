# A2A Test: Loop Runtimes

Interactive CLI-based tests for verifying loop implementations against real LLM backends.
Each runtime (AiSdkLoop, ClaudeCodeLoop, CodexLoop, CursorLoop) should be tested independently.

> A2A tests are manual/interactive. Each test case specifies:
> - **Input:** exact CLI commands
> - **Expected:** observable output pattern (grep-able)
> - **Timeout:** max wait before marking as fail
> - **Retry:** whether retrying is valid (flaky vs deterministic)

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

## Saving test artifacts

```sh
mkdir -p a2a-artifacts
TEST_ID="T1.2_aisdk_$(date +%Y%m%d_%H%M%S)"
aw log --json > "a2a-artifacts/${TEST_ID}_log.json"
aw recv --json > "a2a-artifacts/${TEST_ID}_recv.json"
```

---

## 1. AiSdkLoop Tests

### T1.1: Preflight — API key detection

| Field    | Value |
|----------|-------|
| Input    | `aw start --model anthropic:claude-haiku-4-5-20251001` |
| Expected | Daemon starts successfully; no API key errors |
| Timeout  | 5s |
| Retry    | No |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001
# verify daemon is running:
aw state | grep -i "state"
aw stop
```

**Negative case (no key):**

```sh
unset ANTHROPIC_API_KEY
aw start --model anthropic:claude-haiku-4-5-20251001 2>&1 | grep -i "error\|key\|not found"
```

**Pass criteria:**
- With key: daemon starts, `state` shows agent state
- Without key: error message about missing API key, daemon does not start

---

### T1.2: Simple prompt — text response with marker

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply with exactly: HELLO_A2A_TEST"` |
| Expected | `recv` output contains string `HELLO_A2A_TEST` |
| Timeout  | 10s |
| Retry    | Yes (LLM may not follow instructions exactly) |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send "Reply with exactly: HELLO_A2A_TEST"
aw recv --wait 10 | grep "HELLO_A2A_TEST"
aw stop
```

**Pass criteria:**
- `grep` exits 0 (marker found in response)

---

### T1.3: Event stream structure

| Field    | Value |
|----------|-------|
| Input    | `aw send "Say OK"` |
| Expected | All JSON log entries have valid `type` field |
| Timeout  | 10s |
| Retry    | No |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send "Say OK"
aw recv --wait 10
aw log --json > /tmp/a2a_t13_log.json
aw stop

# Validate: every entry has a type field
cat /tmp/a2a_t13_log.json | python3 -c "
import json, sys
for line in sys.stdin:
    if line.strip():
        e = json.loads(line)
        assert 'type' in e, f'Missing type: {e}'
        assert e['type'] in ('text','thinking','tool_call_start','tool_call_end','error','unknown',
                              'state_change','run_start','run_end','message_received','context_assembled')
print('OK: all events valid')
"
```

**Pass criteria:**
- Validation script prints `OK: all events valid`
- No events with missing `type`

---

### T1.4: Result structure — usage tracking

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply: OK"` |
| Expected | `run_end` log entry has `durationMs` > 0, non-zero usage |
| Timeout  | 10s |
| Retry    | No |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send "Reply: OK"
aw recv --wait 10
aw log --json | grep '"type":"run_end"'
aw stop
```

**Pass criteria (check `run_end` entry):**
- `durationMs` > 0
- `usage.inputTokens` > 0
- `usage.outputTokens` > 0

---

### T1.5: Status transitions

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply: hi"` with `log --follow` |
| Expected | Log shows state_change sequence ending in idle |
| Timeout  | 15s |
| Retry    | No |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw log --follow > /tmp/a2a_t15_log.txt &
LOG_PID=$!
sleep 1
aw send "Reply: hi"
aw recv --wait 15
kill $LOG_PID 2>/dev/null
aw stop

# Check sequence:
grep "state_change\|run_start\|run_end" /tmp/a2a_t15_log.txt
```

**Pass criteria:**
1. `run_start` appears in log
2. `run_end` appears after `run_start`
3. Final state_change shows `idle`
4. No `error` state in sequence

---

### T1.6: Cancel mid-run

| Field    | Value |
|----------|-------|
| Input    | Send long prompt, stop after 1s |
| Expected | Daemon stops within 5s, no orphan processes |
| Timeout  | 10s |
| Retry    | No |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send "Write a very long essay about the entire history of mathematics, covering every century in detail"
sleep 1
time aw stop    # should complete quickly
pgrep -f "aw.*start" | wc -l    # should be 0
```

**Pass criteria:**
- `aw stop` completes in < 5s
- No orphan `aw` processes

---

### T1.7: Cleanup idempotent

| Field    | Value |
|----------|-------|
| Input    | `aw stop` twice |
| Expected | Second stop doesn't crash |
| Timeout  | 5s |
| Retry    | No |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001
aw stop
aw stop 2>&1    # should not crash
echo "exit code: $?"
```

**Pass criteria:**
- Second `aw stop` prints "no daemon" or similar, no crash

---

### T1.8: OpenAI backend

| Field    | Value |
|----------|-------|
| Input    | Same as T1.2 with OpenAI model |
| Expected | `recv` contains marker |
| Timeout  | 15s |
| Retry    | Yes |

```sh
aw start --model openai:gpt-4.1-nano
aw send "Reply with exactly: HELLO_OPENAI_A2A"
aw recv --wait 15 | grep "HELLO_OPENAI_A2A"
aw stop
```

**Pass criteria:**
- `grep` exits 0

---

## 2. ClaudeCodeLoop Tests

### T2.1: CLI availability

| Field    | Value |
|----------|-------|
| Input    | `claude --version` |
| Expected | Prints version string |
| Timeout  | 5s |
| Retry    | No |

```sh
claude --version    # If fails, skip all T2.x tests
```

---

### T2.2: Simple prompt

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply with exactly: HELLO_A2A_TEST"` |
| Expected | `recv` contains `HELLO_A2A_TEST` |
| Timeout  | 20s |
| Retry    | Yes |

```sh
aw start --runtime claude-code --model sonnet
aw send "Reply with exactly: HELLO_A2A_TEST"
aw recv --wait 20 | grep "HELLO_A2A_TEST"
aw stop
```

---

### T2.3: Result structure

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply with: OK"` |
| Expected | `run_end` has `durationMs` > 0, non-zero usage |
| Timeout  | 20s |
| Retry    | No |

```sh
aw start --runtime claude-code --model sonnet
aw send "Reply with: OK"
aw recv --wait 20
aw log --json | grep '"type":"run_end"'
aw stop
```

**Pass criteria:**
- `run_end` has `durationMs` > 0
- `usage.inputTokens` > 0

---

### T2.4: Status transitions

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply: hi"` with `log --follow` |
| Expected | run_start → run_end → idle |
| Timeout  | 25s |
| Retry    | No |

```sh
aw start --runtime claude-code --model sonnet
aw log --follow > /tmp/a2a_t24_log.txt &
LOG_PID=$!
aw send "Reply: hi"
aw recv --wait 25
kill $LOG_PID 2>/dev/null
aw stop
grep "run_start\|run_end\|state_change" /tmp/a2a_t24_log.txt
```

---

### T2.5: Cancel

| Field    | Value |
|----------|-------|
| Input    | Long prompt, stop after 2s |
| Expected | Daemon stops cleanly |
| Timeout  | 10s |
| Retry    | No |

```sh
aw start --runtime claude-code --model sonnet
aw send "Write a 500-word essay about the history of computing"
sleep 2
time aw stop
```

---

### T2.6: Tool call events

| Field    | Value |
|----------|-------|
| Input    | Ask to run bash command |
| Expected | `log` has `tool_call_start` with name containing "bash" |
| Timeout  | 25s |
| Retry    | Yes (LLM may not call tool) |

```sh
aw start --runtime claude-code --model sonnet
aw send 'Run this bash command and tell me the result: echo "A2A_TOOL_TEST"'
aw recv --wait 25
aw log --json | grep -i '"tool_call_start".*bash\|bash.*"tool_call_start"'
aw stop
```

**Pass criteria:**
- At least one `tool_call_start` with name containing "bash" (case-insensitive)
- Matching `tool_call_end` exists

---

## 3. CodexLoop Tests

### T3.1: CLI availability

| Field    | Value |
|----------|-------|
| Input    | `codex --version` |
| Expected | Prints version |
| Timeout  | 5s |
| Retry    | No |

```sh
codex --version    # If fails, skip all T3.x tests
```

---

### T3.2: Simple prompt

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply with exactly: HELLO_A2A_TEST"` |
| Expected | `recv` contains text response |
| Timeout  | 20s |
| Retry    | Yes |

```sh
aw start --runtime codex
aw send "Reply with exactly: HELLO_A2A_TEST"
aw recv --wait 20
aw stop
```

> **Note:** Codex may not follow marker instructions exactly. Pass if any non-empty text response.

---

### T3.3: Result structure

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply with: OK"` |
| Expected | `run_end` has `durationMs` > 0 |
| Timeout  | 20s |
| Retry    | No |

```sh
aw start --runtime codex
aw send "Reply with: OK"
aw recv --wait 20
aw log --json | grep '"type":"run_end"'
aw stop
```

> **Note:** CodexLoop may report `usage` as all zeros. This is expected.

---

### T3.4: Status transitions

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply: hi"` with `log --follow` |
| Expected | run_start → run_end sequence |
| Timeout  | 25s |
| Retry    | No |

```sh
aw start --runtime codex
aw log --follow > /tmp/a2a_t34_log.txt &
LOG_PID=$!
aw send "Reply: hi"
aw recv --wait 25
kill $LOG_PID 2>/dev/null
aw stop
grep "run_start\|run_end" /tmp/a2a_t34_log.txt
```

---

### T3.5: Cancel

| Field    | Value |
|----------|-------|
| Input    | Long prompt, stop after 1s |
| Expected | Daemon stops cleanly |
| Timeout  | 10s |
| Retry    | No |

```sh
aw start --runtime codex
aw send "Write a detailed 2000-word analysis of every major war in human history"
sleep 1
time aw stop
```

---

## 4. CursorLoop Tests

### T4.1: CLI availability

| Field    | Value |
|----------|-------|
| Input    | `cursor --version` |
| Expected | Prints version |
| Timeout  | 5s |
| Retry    | No |

```sh
cursor --version    # If fails, skip all T4.x tests
```

---

### T4.2: Simple prompt

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply with exactly: HELLO_A2A_TEST"` |
| Expected | `recv` contains text response |
| Timeout  | 20s |
| Retry    | Yes |

```sh
aw start --runtime cursor
aw send "Reply with exactly: HELLO_A2A_TEST"
aw recv --wait 20
aw stop
```

---

### T4.3: Result structure

| Field    | Value |
|----------|-------|
| Input    | `aw send "Reply with: OK"` |
| Expected | `run_end` has `durationMs` > 0 |
| Timeout  | 20s |
| Retry    | No |

```sh
aw start --runtime cursor
aw send "Reply with: OK"
aw recv --wait 20
aw log --json | grep '"type":"run_end"'
aw stop
```

> **Note:** CursorLoop may not emit `tool_call_end` events. This is a known limitation.

---

### T4.4: Status transitions

| Field    | Value |
|----------|-------|
| Input    | Same as T3.4 with `--runtime cursor` |
| Expected | run_start → run_end sequence |
| Timeout  | 25s |
| Retry    | No |

```sh
aw start --runtime cursor
aw log --follow > /tmp/a2a_t44_log.txt &
LOG_PID=$!
aw send "Reply: hi"
aw recv --wait 25
kill $LOG_PID 2>/dev/null
aw stop
grep "run_start\|run_end" /tmp/a2a_t44_log.txt
```

---

### T4.5: Cancel

| Field    | Value |
|----------|-------|
| Input    | Long prompt, stop after 1s |
| Expected | Daemon stops cleanly |
| Timeout  | 10s |
| Retry    | No |

```sh
aw start --runtime cursor
aw send "Write a long essay about history"
sleep 1
time aw stop
```

---

## 5. DeepSeek Async Communication Tests

### T5.1: Preflight

| Field    | Value |
|----------|-------|
| Input    | `aw start --model deepseek:deepseek-chat` |
| Expected | Daemon starts if DEEPSEEK_API_KEY is set |
| Timeout  | 5s |
| Retry    | No |

```sh
echo "DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:+(set)}"
aw start --model deepseek:deepseek-chat
aw state
aw stop
```

---

### T5.2: Inbox → Reply → Ack cycle

| Field    | Value |
|----------|-------|
| Input    | `aw send "Check your inbox and respond to all pending messages"` |
| Expected | Log shows my_inbox → channel_send → my_inbox_ack tool calls in order |
| Timeout  | 30s |
| Retry    | Yes (LLM may call tools in different order) |

```sh
aw start --model deepseek:deepseek-chat
aw send "Check your inbox and respond to all pending messages"
aw recv --wait 30
aw log --json > /tmp/a2a_t52_log.json
aw stop

# Verify tool call ordering:
grep '"tool_call_start"' /tmp/a2a_t52_log.json | grep -o '"name":"[^"]*"'
```

**Pass criteria:**
- `my_inbox` appears before `channel_send`
- `channel_send` appears before `my_inbox_ack`
- All tool calls properly paired (start/end count equal)

---

### T5.3: Tool call pairing

| Field    | Value |
|----------|-------|
| Input    | `aw send "Check inbox."` |
| Expected | Equal count of `tool_call_start` and `tool_call_end` |
| Timeout  | 20s |
| Retry    | No |

```sh
aw start --model deepseek:deepseek-chat
aw send "Check inbox."
aw recv --wait 20
aw log --json > /tmp/a2a_t53_log.json
aw stop

STARTS=$(grep -c '"tool_call_start"' /tmp/a2a_t53_log.json)
ENDS=$(grep -c '"tool_call_end"' /tmp/a2a_t53_log.json)
echo "starts=$STARTS ends=$ENDS"
[ "$STARTS" = "$ENDS" ] && echo "PASS" || echo "FAIL: mismatched"
```

---

## 6. Runtime Capability Matrix

| Capability       | AiSdkLoop | ClaudeCodeLoop | CodexLoop | CursorLoop |
|------------------|-----------|----------------|-----------|------------|
| tool_call_end    | Yes       | Yes            | Yes       | No         |
| callId in events | Yes       | Yes            | No        | Yes        |
| thinking events  | Yes       | No             | No        | No         |
| usage tracking   | Yes       | Yes            | No        | No         |

## Timeout Reference

| Runtime     | Simple prompt | Tool call | Cancel |
|-------------|---------------|-----------|--------|
| ai-sdk      | 10s           | 20s       | 10s    |
| claude-code | 20s           | 25s       | 10s    |
| codex       | 20s           | 25s       | 10s    |
| cursor      | 20s           | 25s       | 10s    |

---

## Test Result Matrix

Record: pass (P), fail (F), skip (S), flaky (FL).
Include artifact path for failed/flaky results.

| Test  | ai-sdk (anthropic) | ai-sdk (openai) | claude-code | codex | cursor | deepseek | Artifact |
|-------|--------------------|-----------------|-------------|-------|--------|----------|----------|
| T*.1  |                    |                 |             |       |        |          |          |
| T*.2  |                    |                 |             |       |        |          |          |
| T*.3  |                    |                 |             |       |        |          |          |
| T*.4  |                    |                 |             |       |        |          |          |
| T*.5  |                    |                 |             |       |        |          |          |
| T*.6  |                    | N/A             |             | N/A   | N/A    | N/A      |          |
