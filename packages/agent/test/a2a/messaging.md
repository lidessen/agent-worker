# A2A Test: Async Messaging

Interactive tests for the agent's async message processing pipeline.
Run these with the `aw` CLI tool against different runtimes and models.

> A2A tests are manual/interactive. Each test case specifies:
>
> - **Input:** exact CLI commands
> - **Expected:** observable output pattern (grep-able)
> - **Timeout:** max wait before marking as fail
> - **Retry:** whether retrying is valid (flaky vs deterministic)

---

## Prerequisites

```sh
# Terminal 1: Create an agent (daemon auto-starts; pick one)
aw add test-agent --runtime mock
aw add test-agent --runtime ai-sdk --model anthropic:claude-sonnet-4-20250514
aw add test-agent --runtime ai-sdk --model openai:gpt-4.1
aw add test-agent --runtime claude-code --model sonnet

# Terminal 2: Run test commands below
```

## Saving test artifacts

After each test, persist results for traceability.

> **Important:** `aw read test-agent` uses a persistent cursor — once messages are consumed,
> a second `aw read test-agent` returns only _new_ messages. To save artifacts, use `tee`
> during the first `read` call (shown below). Do NOT run a separate `aw read test-agent`
> after the test, as it will likely be empty.

```sh
mkdir -p a2a-artifacts
TEST_ID="T1_$(date +%Y%m%d_%H%M%S)"

# Capture read output during the test itself (via tee):
aw read test-agent --wait 10 --json | tee "a2a-artifacts/${TEST_ID}_recv.json"

# After the test, save log + state:
aw log --json > "a2a-artifacts/${TEST_ID}_log.json"
aw state test-agent > "a2a-artifacts/${TEST_ID}_state.txt"
```

---

## T1: Single message triggers processing

| Field    | Value                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------- |
| Input    | `aw send test-agent "hello world"`                                                                 |
| Expected | `read` contains at least one text block; `state` shows `idle` + inbox with 1 message (status=read) |
| Timeout  | 10s (mock: 2s)                                                                                     |
| Retry    | Yes (network flake)                                                                                |

```sh
aw send test-agent "hello world"
aw read test-agent --wait 10
aw state test-agent
```

**Pass criteria:**

- `aw read test-agent` returns non-empty text output
- `aw state test-agent` shows `State: idle`
- `aw state test-agent` shows inbox count >= 1

---

## T2: Burst messages batched into single run

| Field    | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| Input    | `aw send test-agent "msg 1" "msg 2" "msg 3"`                      |
| Expected | `log` shows exactly 1 `run_start`; all 3 messages appear in inbox |
| Timeout  | 15s (mock: 3s)                                                    |
| Retry    | No (deterministic batching)                                       |

```sh
aw send test-agent "msg 1" "msg 2" "msg 3"
aw read test-agent --wait 15
aw log --json | grep -c '"type":"run_start"'    # should print: 1
aw state test-agent                              # inbox count: 3
```

**Pass criteria:**

- `run_start` count == 1
- `state` inbox shows 3 messages, all read

---

## T3: Message during processing triggers follow-up run

| Field    | Value                                    |
| -------- | ---------------------------------------- |
| Input    | Send first message, wait 1s, send second |
| Expected | `log` shows 2 `run_start` entries        |
| Timeout  | 20s (mock: 5s, CLI runtimes: 30s)        |
| Retry    | Yes (timing-sensitive)                   |

```sh
aw send test-agent "first question: what is 2+2?"
sleep 1
aw send test-agent "second question: what is 3+3?"
aw read test-agent --wait 20
aw log --json | grep -c '"type":"run_start"'    # should print: 2
```

**Pass criteria:**

- `run_start` count == 2
- `read` shows 2 separate response blocks

---

## T4: Multiple messages during processing batched in follow-up

| Field    | Value                                |
| -------- | ------------------------------------ |
| Input    | Send 1 message, wait 1s, send 3 more |
| Expected | `log` shows 2 `run_start` (not 4)    |
| Timeout  | 20s                                  |
| Retry    | Yes (timing-sensitive)               |

```sh
aw send test-agent "initial request"
sleep 1
aw send test-agent "addendum 1" "addendum 2" "addendum 3"
aw read test-agent --wait 20
aw log --json | grep -c '"type":"run_start"'    # should print: 2
```

**Pass criteria:**

- `run_start` count == 2 (second run batches all 3 addenda)

---

## T5: Send with delays for precise interleaving

| Field    | Value                                                   |
| -------- | ------------------------------------------------------- |
| Input    | `aw send test-agent "step1" +2s "step2" +500ms "step3"` |
| Expected | `message_received` timestamps show ~2s and ~500ms gaps  |
| Timeout  | 30s                                                     |
| Retry    | Yes (timing-sensitive)                                  |

```sh
aw send test-agent "step1" +2s "step2" +500ms "step3"
aw read test-agent --wait 30
aw log --json | grep '"type":"message_received"'
```

**Pass criteria:**

- 3 `message_received` entries
- Timestamp gaps approximately match delay spec (2s ± 500ms, 500ms ± 200ms)

---

## T6: Messages from different senders

| Field    | Value                                                       |
| -------- | ----------------------------------------------------------- |
| Input    | Two messages with `--from alice` and `--from bob`           |
| Expected | `state` inbox shows both senders; `log` shows `from` fields |
| Timeout  | 15s                                                         |
| Retry    | No (deterministic)                                          |

```sh
aw send test-agent "hello from alice" --from alice
aw send test-agent "hello from bob" --from bob
aw read test-agent --wait 15
aw state test-agent
aw log --json | grep '"from"'
```

**Pass criteria:**

- `state` inbox lists `from=alice` and `from=bob`
- `log` `message_received` entries have correct `from` fields

---

## T7: Rapid burst of 10 messages

| Field    | Value                                                   |
| -------- | ------------------------------------------------------- |
| Input    | 10 messages in tight loop                               |
| Expected | At most 2 `run_start` entries (debounce batching works) |
| Timeout  | 30s (CLI runtimes: 60s)                                 |
| Retry    | Yes (timing-sensitive)                                  |

```sh
for i in $(seq 1 10); do aw send test-agent "burst-$i"; done
aw read test-agent --wait 30
aw log --json | grep -c '"type":"run_start"'    # should print: 1 or 2
aw state test-agent                              # inbox count: 10
```

**Pass criteria:**

- `run_start` count <= 2
- `state` inbox shows 10 messages

---

## T8: State transitions are correct

| Field    | Value                                                       |
| -------- | ----------------------------------------------------------- |
| Input    | Single message with `log --follow`                          |
| Expected | Log shows waiting → processing → run_start → run_end → idle |
| Timeout  | 15s                                                         |
| Retry    | No (deterministic)                                          |

```sh
aw log --follow > /tmp/a2a_t8_log.txt &
LOG_PID=$!
sleep 1
aw send test-agent "trigger state cycle"
aw read test-agent --wait 15
kill $LOG_PID 2>/dev/null
cat /tmp/a2a_t8_log.txt
```

**Pass criteria (check log file):**

1. Contains `→ waiting` or `→ processing`
2. Contains `run_start`
3. Contains `run_end`
4. Contains `→ idle` (after run_end)
5. Does NOT contain `→ error`

---

## T9: History accumulates across cycles

| Field    | Value                                         |
| -------- | --------------------------------------------- |
| Input    | Two messages in sequence                      |
| Expected | History turn count increases between messages |
| Timeout  | 15s per cycle                                 |
| Retry    | No (deterministic)                            |

```sh
aw send test-agent "cycle A"
aw read test-agent --wait 15
aw state test-agent | grep "History"             # Note turn count

aw send test-agent "cycle B"
aw read test-agent --wait 15
aw state test-agent | grep "History"             # Should be higher
```

**Pass criteria:**

- History count after cycle B > history count after cycle A

---

## T10: Stop and restart

| Field    | Value                                                      |
| -------- | ---------------------------------------------------------- |
| Input    | Send message, wait, daemon stop                            |
| Expected | `daemon stop` succeeds; `state` after stop shows no daemon |
| Timeout  | 10s                                                        |
| Retry    | No (deterministic)                                         |

```sh
aw send test-agent "will be processed"
aw read test-agent --wait 10
aw daemon stop
aw state test-agent 2>&1 | grep -i "no.*daemon\|not running"
```

**Pass criteria:**

- `daemon stop` exits 0
- `state` indicates no running daemon

---

## T11: Debug log shows tool calls

| Field    | Value                                                             |
| -------- | ----------------------------------------------------------------- |
| Input    | Ask agent to use agent_notes tool                                 |
| Expected | `log` shows `tool_call_start` and `tool_call_end` for agent_notes |
| Timeout  | 20s                                                               |
| Retry    | Yes (LLM may not call tool)                                       |
| Requires | Real LLM with builtins (not mock)                                 |

```sh
# Create agent with real model + builtins
aw add test-agent --runtime ai-sdk --model anthropic:claude-sonnet-4-20250514

# In another terminal:
aw send test-agent 'Save a note with key="test" and content="hello"'
aw read test-agent --wait 20
aw log --json | grep 'agent_notes'
aw daemon stop
```

**Pass criteria:**

- At least one `tool_call_start` with `name` containing `agent_notes`
- Matching `tool_call_end` exists

---

## T12: Log vs recv separation

| Field    | Value                                                                         |
| -------- | ----------------------------------------------------------------------------- |
| Input    | Single message                                                                |
| Expected | `read` only has text/send types; `log` only has debug event types; no overlap |
| Timeout  | 10s                                                                           |
| Retry    | No (deterministic)                                                            |

```sh
aw send test-agent "hello"
aw read test-agent --wait 10 --json > /tmp/a2a_t12_recv.json
aw log --json > /tmp/a2a_t12_log.json
aw daemon stop
```

**Pass criteria:**

- `read` JSON entries: only `type: "text"` or `type: "send"`
- `log` JSON entries: `type` is one of `state_change`, `run_start`, `run_end`, `tool_call_start`, `tool_call_end`, `message_received`, `context_assembled`, `thinking`, `error`
- No text responses in log; no debug events in read

---

## Timeout Reference

Default timeout recommendations per runtime:

| Runtime     | Simple prompt | Tool call | Burst (10 msgs) |
| ----------- | ------------- | --------- | --------------- |
| mock        | 2s            | N/A       | 5s              |
| ai-sdk      | 10s           | 20s       | 30s             |
| claude-code | 15s           | 25s       | 45s             |
| codex       | 15s           | 25s       | 45s             |
| cursor      | 15s           | 25s       | 45s             |

---

## Test Matrix

Run the above tests against each runtime/model combination.
Record pass (P), fail (F), skip (S), or flaky (FL) with artifact path.

| Runtime     | Model                              | T1  | T2  | T3  | T4  | T5  | T6  | T7  | T8  | T9  | T10 | T11 | T12 |
| ----------- | ---------------------------------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mock        | (default)                          |     |     |     |     |     |     |     |     |     |     | N/A |     |
| ai-sdk      | anthropic:claude-sonnet-4-20250514 |     |     |     |     |     |     |     |     |     |     |     |     |
| ai-sdk      | openai:gpt-4.1                     |     |     |     |     |     |     |     |     |     |     |     |     |
| claude-code | sonnet                             |     |     |     |     |     |     |     |     |     |     |     |     |
| codex       | (default)                          |     |     |     |     |     |     |     |     |     |     |     |     |
| cursor      | (default)                          |     |     |     |     |     |     |     |     |     |     |     |     |

**Artifact naming:** `a2a-artifacts/<TEST_ID>_<runtime>_<YYYYMMDD_HHMMSS>_{log,recv,state}.{json,txt}`
