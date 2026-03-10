# A2A Test: Async Messaging

Interactive tests for the agent's async message processing pipeline.
Run these with the `aw` CLI tool against different runtimes and models.

## Prerequisites

```sh
# Terminal 1: Start daemon (pick one)
bun packages/agent/src/cli/aw.ts start --runtime mock --debounce 100
bun packages/agent/src/cli/aw.ts start --model anthropic:claude-sonnet-4-20250514
bun packages/agent/src/cli/aw.ts start --model openai:gpt-4.1
bun packages/agent/src/cli/aw.ts start --runtime claude-code --model sonnet

# Terminal 2: Run test commands below
```

---

## T1: Single message triggers processing

Send a single message and verify the agent processes it.

```sh
aw send "hello world"
sleep 2
aw state
aw recv
```

**Expected:**
- `state` shows `idle` (processing finished)
- `state` shows inbox with 1 message, status=read
- `recv` shows at least one text response

---

## T2: Burst messages batched into single run

Send multiple messages rapidly within the debounce window.

```sh
aw send "msg 1" "msg 2" "msg 3"
sleep 2
aw state
aw recv
aw log
```

**Expected:**
- `log` shows only 1 `run_start` entry (all 3 batched into one run)
- `state` shows all 3 messages in inbox, all read
- `recv` shows a single response that addresses all 3 messages

---

## T3: Message during processing triggers follow-up run

Send a second message while the agent is still processing the first.

```sh
aw send "first question: what is 2+2?"
sleep 1
aw send "second question: what is 3+3?"
sleep 5
aw log
aw recv
```

**Expected:**
- `log` shows 2 `run_start` entries (not 1)
- First run processes "first question", second run processes "second question"
- `recv` shows 2 separate response blocks

---

## T4: Multiple messages during processing batched in follow-up

Send several messages while the agent is processing.

```sh
aw send "initial request"
sleep 1
aw send "addendum 1" "addendum 2" "addendum 3"
sleep 5
aw log
aw recv
```

**Expected:**
- `log` shows 2 `run_start` entries
- First run handles "initial request"
- Second run handles all 3 addenda together
- `recv` shows 2 response blocks

---

## T5: Send with delays for precise interleaving

Use delay syntax to control exact timing of message injection.

```sh
aw send "step1" +2s "step2" +500ms "step3"
sleep 8
aw log
aw recv
```

**Expected:**
- `log` shows `message_received` events with ~2s gap between step1/step2 and ~500ms gap between step2/step3
- Multiple `run_start` entries (step2/step3 arrive during processing of earlier messages)
- `recv` shows response for each step

---

## T6: Messages from different senders

Verify sender attribution is preserved.

```sh
aw send --from alice "hello from alice"
aw send --from bob "hello from bob"
sleep 3
aw state
aw log
```

**Expected:**
- `state` inbox shows both messages with correct `from` fields
- `log` `message_received` entries show `from=alice` and `from=bob`

---

## T7: Rapid burst of 10 messages

Stress test the debounce batching.

```sh
for i in $(seq 1 10); do aw send "burst-$i"; done
sleep 5
aw log
aw recv
```

**Expected:**
- `log` shows at most 2 `run_start` entries (messages are batched)
- `recv` shows response(s) that reference all 10 messages
- `state` shows all 10 messages in inbox

---

## T8: State transitions are correct

Observe the full state machine cycle.

```sh
aw log --follow &
LOG_PID=$!
sleep 1
aw send "trigger state cycle"
sleep 3
kill $LOG_PID
```

**Expected log output sequence:**
1. `[state_change] → waiting`
2. `[state_change] → processing` (or directly to processing)
3. `[run_start] #1 trigger=next_message`
4. `[run_end] Nms, N tokens`
5. `[state_change] → idle`

---

## T9: History accumulates across cycles

Verify conversation history grows.

```sh
aw send "cycle A"
sleep 3
aw state  # Note history count
aw send "cycle B"
sleep 3
aw state  # History count should have increased
```

**Expected:**
- After cycle A: `History: 2 turns`
- After cycle B: `History: 4 turns`

---

## T10: Stop and restart

Verify graceful shutdown.

```sh
aw send "will be processed"
sleep 2
aw stop
aw state  # Should fail: no daemon
```

**Expected:**
- `stop` prints "Daemon stopped."
- `state` prints "No running daemon found."

---

## T11: Debug log shows tool calls

Verify `log` captures tool call details (requires real LLM with builtins).

```sh
# Start with real model + builtins
bun packages/agent/src/cli/aw.ts start --model anthropic:claude-sonnet-4-20250514
# In another terminal:
aw send 'Save a note with key="test" and content="hello"'
sleep 5
aw log
```

**Expected:**
- `log` shows `[tool_call_start] agent_notes(...)` with args
- `log` shows `[tool_call_end] agent_notes → Nms`

---

## T12: Log vs recv separation

Verify `log` shows debug events and `recv` shows only responses.

```sh
aw send "hello"
sleep 3
aw recv --json
aw log --json
```

**Expected:**
- `recv --json` entries have `type: "text"` or `type: "send"` only
- `log --json` entries have `type: "state_change"`, `"run_start"`, `"run_end"`, `"tool_call_start"`, etc.
- No overlap: responses don't appear in log, debug events don't appear in recv

---

## Test Matrix

Run the above tests against each runtime/model combination:

| Runtime    | Model                           | T1 | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 | T10 | T11 | T12 |
|------------|---------------------------------|----|----|----|----|----|----|----|----|----|-----|-----|-----|
| mock       | (default)                       |    |    |    |    |    |    |    |    |    |     | N/A |     |
| ai-sdk     | anthropic:claude-sonnet-4-20250514 |    |    |    |    |    |    |    |    |    |     |     |     |
| ai-sdk     | openai:gpt-4.1                  |    |    |    |    |    |    |    |    |    |     |     |     |
| claude-code | sonnet                         |    |    |    |    |    |    |    |    |    |     |     |     |
| codex      | (default)                       |    |    |    |    |    |    |    |    |    |     |     |     |
| cursor     | (default)                       |    |    |    |    |    |    |    |    |    |     |     |     |
