# A2A Test: Agent End-to-End

Interactive CLI-based tests for the full Agent lifecycle across all available providers.
Tests the Agent wrapper (not just the loop): init → push message → process → verify state → stop.

> A2A tests are manual/interactive. Each test case specifies:
>
> - **Input:** exact CLI commands
> - **Expected:** observable output pattern (grep-able)
> - **Timeout:** max wait before marking as fail
> - **Retry:** whether retrying is valid (flaky vs deterministic)

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

## Saving test artifacts

> **Important:** `aw recv` uses a persistent cursor — once messages are consumed,
> a second `aw recv` returns only _new_ messages. To save artifacts, use `tee`
> during the first `recv` call (shown below). Do NOT run a separate `aw recv`
> after the test, as it will likely be empty.

```sh
mkdir -p a2a-artifacts
TEST_ID="T2_anthropic_$(date +%Y%m%d_%H%M%S)"

# Capture recv output during the test itself (via tee):
aw recv --wait 10 --json | tee "a2a-artifacts/${TEST_ID}_recv.json"

# After the test, save log + state:
aw log --json > "a2a-artifacts/${TEST_ID}_log.json"
aw state > "a2a-artifacts/${TEST_ID}_state.txt"
```

---

## 1. Preflight — Provider Availability

| Field    | Value                                       |
| -------- | ------------------------------------------- |
| Input    | `aw start` + `aw stop` per provider         |
| Expected | Daemon starts if API key / CLI is available |
| Timeout  | 5s per provider                             |
| Retry    | No                                          |

```sh
# Test each provider (skip if key/CLI not available):
for cfg in \
  "--model anthropic:claude-haiku-4-5-20251001" \
  "--model openai:gpt-4.1-nano" \
  "--model deepseek:deepseek-chat" \
  "--runtime claude-code --model haiku" \
  "--runtime codex" \
  "--runtime cursor"; do
  echo "=== $cfg ==="
  aw start $cfg 2>&1 && echo "PASS: started" || echo "SKIP: not available"
  aw stop 2>/dev/null
done
```

**Pass criteria:** Each provider either starts successfully or prints clear error about missing key/CLI.

---

## 2. Simple Message → LLM Response

| Field    | Value                                         |
| -------- | --------------------------------------------- |
| Input    | `aw send "Reply with exactly: AGENT_A2A_OK"`  |
| Expected | `recv` output contains string `AGENT_A2A_OK`  |
| Timeout  | 10s (ai-sdk), 20s (CLI runtimes)              |
| Retry    | Yes (LLM may not follow instructions exactly) |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send "Reply with exactly: AGENT_A2A_OK"
aw recv --wait 10 | grep "AGENT_A2A_OK"
echo "exit: $?"    # 0 = PASS
aw stop
```

**Pass criteria:**

- `grep` exits 0 (marker found)
- At least one text response block in `recv`

**Repeat with each provider** (adjust timeout per runtime).

---

## 3. State Transitions

| Field    | Value                                                       |
| -------- | ----------------------------------------------------------- |
| Input    | `aw send "Say hi"` with `log --follow`                      |
| Expected | Log shows waiting → processing → run_start → run_end → idle |
| Timeout  | 15s (ai-sdk), 25s (CLI)                                     |
| Retry    | No                                                          |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw log --follow > /tmp/a2a_t3_log.txt &
LOG_PID=$!
sleep 1
aw send "Say hi"
aw recv --wait 15
kill $LOG_PID 2>/dev/null
aw stop

# Verify sequence:
grep "state_change\|run_start\|run_end" /tmp/a2a_t3_log.txt
```

**Pass criteria:**

1. `processing` state appears after message
2. `run_start` appears
3. `run_end` appears after `run_start`
4. Final state is `idle`
5. No `error` state in sequence

---

## 4. Tool Call — agent_notes

| Field    | Value                                                           |
| -------- | --------------------------------------------------------------- |
| Input    | `aw send 'Save a note: key="ping" content="pong"'`              |
| Expected | `log` shows `tool_call_start` + `tool_call_end` for agent_notes |
| Timeout  | 20s                                                             |
| Retry    | Yes (LLM may not call tool)                                     |
| Requires | Real LLM with tool support                                      |

```sh
aw start --model anthropic:claude-sonnet-4-20250514

aw send 'Save a note: key="ping" content="pong"'
aw recv --wait 20
aw log --json > /tmp/a2a_t4_log.json
aw stop

# Check tool calls:
grep "agent_notes" /tmp/a2a_t4_log.json
STARTS=$(grep -c '"tool_call_start".*agent_notes\|agent_notes.*"tool_call_start"' /tmp/a2a_t4_log.json || echo 0)
echo "agent_notes calls: $STARTS"
```

**Pass criteria:**

- At least one `tool_call_start` with name containing `agent_notes`
- Matching `tool_call_end` exists
- `recv` shows confirmation text

> Skip for providers with `toolSupport: false`.

---

## 5. Context Assembly — Custom Instructions

| Field    | Value                                                           |
| -------- | --------------------------------------------------------------- |
| Input    | Start with `--instructions "CUSTOM_MARKER_12345"`, send message |
| Expected | `context_assembled` log entry contains marker in `system` field |
| Timeout  | 15s                                                             |
| Retry    | No                                                              |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001 --instructions "CUSTOM_MARKER_12345"

aw send "Say OK"
aw recv --wait 15
aw log --json > /tmp/a2a_t5_log.json
aw stop

grep "CUSTOM_MARKER_12345" /tmp/a2a_t5_log.json
echo "exit: $?"    # 0 = PASS
```

**Pass criteria:**

- `grep` exits 0 (marker found in `context_assembled` entry's `system` field)

---

## 6. History Persistence Across Runs

| Field    | Value                                                      |
| -------- | ---------------------------------------------------------- |
| Input    | Two messages in sequence, check history count between them |
| Expected | History turn count increases                               |
| Timeout  | 15s per cycle                                              |
| Retry    | No                                                         |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send "Say exactly: FIRST"
aw recv --wait 15
H1=$(aw state | grep -o 'History: [0-9]*' | grep -o '[0-9]*')

aw send "Say exactly: SECOND"
aw recv --wait 15
H2=$(aw state | grep -o 'History: [0-9]*' | grep -o '[0-9]*')
aw stop

echo "History: $H1 → $H2"
[ "$H2" -gt "$H1" ] && echo "PASS" || echo "FAIL: history didn't grow"
```

**Pass criteria:**

- H2 > H1

---

## 7. Stop During Processing

| Field    | Value                                           |
| -------- | ----------------------------------------------- |
| Input    | Send long prompt, stop after 2s                 |
| Expected | `stop` completes within 5s, no orphan processes |
| Timeout  | 10s                                             |
| Retry    | No                                              |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send "Write a very long essay about the history of computing"
sleep 2
time aw stop
aw state 2>&1 | grep -i "no.*daemon\|not running"
pgrep -f "aw.*start" | wc -l    # should be 0
```

**Pass criteria:**

- `stop` completes in < 5s
- `state` shows no running daemon
- No orphan processes

---

## 8. Inbox Message Tracking

| Field    | Value                                                                                  |
| -------- | -------------------------------------------------------------------------------------- |
| Input    | `aw send --from test-user "Hello from user"`                                           |
| Expected | `state` inbox shows `from=test-user`; `log` has `message_received` with correct fields |
| Timeout  | 15s                                                                                    |
| Retry    | No                                                                                     |

```sh
aw start --model anthropic:claude-haiku-4-5-20251001

aw send --from test-user "Hello from user"
aw recv --wait 15
aw state | grep "test-user"
aw log --json | grep '"message_received"' | grep '"test-user"'
echo "exit: $?"    # 0 = PASS
aw stop
```

**Pass criteria:**

- `state` shows message with `from=test-user`
- `log` has `message_received` event with `from: "test-user"`

---

## 9. Multi-Provider Cross-Verification

| Field    | Value                                      |
| -------- | ------------------------------------------ |
| Input    | Same prompt across all available providers |
| Expected | Each returns non-empty text response       |
| Timeout  | 15s (ai-sdk), 25s (CLI)                    |
| Retry    | Yes (per provider)                         |

```sh
# AI SDK providers:
for provider in \
  "anthropic:claude-haiku-4-5-20251001" \
  "openai:gpt-4.1-nano" \
  "deepseek:deepseek-chat"; do
  echo "=== $provider ==="
  aw start --model "$provider" 2>/dev/null || { echo "SKIP"; continue; }
  aw send "Reply with exactly: CROSS_CHECK_OK"
  aw recv --wait 15 | grep "CROSS_CHECK_OK" && echo "PASS" || echo "FAIL"
  aw stop
done

# CLI runtimes:
for runtime in claude-code codex cursor; do
  echo "=== $runtime ==="
  aw start --runtime "$runtime" 2>/dev/null || { echo "SKIP"; continue; }
  aw send "Reply with exactly: CROSS_CHECK_OK"
  aw recv --wait 25 | head -5    # verify non-empty response
  aw stop
done
```

---

## Timeout Reference

| Runtime     | Simple prompt | Tool call | Cancel |
| ----------- | ------------- | --------- | ------ |
| ai-sdk      | 10s           | 20s       | 10s    |
| claude-code | 20s           | 25s       | 10s    |
| codex       | 20s           | 25s       | 10s    |
| cursor      | 20s           | 25s       | 10s    |

---

## Test Result Matrix

Record: pass (P), fail (F), skip (S), flaky (FL).
Include artifact path for failed/flaky results.

| Test | Anthropic | OpenAI | DeepSeek | KimiCode | BigModel | MiniMax | ClaudeCode | Codex | Cursor | Artifact |
| ---- | --------- | ------ | -------- | -------- | -------- | ------- | ---------- | ----- | ------ | -------- |
| T1   |           |        |          |          |          |         |            |       |        |          |
| T2   |           |        |          |          |          |         |            |       |        |          |
| T3   |           |        |          |          |          |         |            |       |        |          |
| T4   |           |        |          |          |          |         |            |       |        |          |
| T5   |           |        |          |          |          |         |            |       |        |          |
| T6   |           |        |          |          |          |         |            |       |        |          |
| T7   |           |        |          |          |          |         |            |       |        |          |
| T8   |           |        |          |          |          |         |            |       |        |          |
| T9   |           |        |          |          |          |         |            |       |        |          |

**Artifact naming:** `a2a-artifacts/T<N>_<provider>_<YYYYMMDD_HHMMSS>_{log,recv,state}.{json,txt}`
