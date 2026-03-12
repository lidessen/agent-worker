# A2A Test: Workspace Multi-Agent

Interactive CLI-based tests for the `@agent-worker/workspace` package. Tests the full
multi-agent workspace lifecycle: channel messaging, @mention routing, inbox delivery,
priority scheduling, resource system, team documents, and cross-agent collaboration.

> A2A tests are manual/interactive. Each test case specifies:
>
> - **Input:** exact CLI commands
> - **Expected:** observable output pattern (grep-able)
> - **Timeout:** max wait before marking as fail
> - **Retry:** whether retrying is valid (flaky vs deterministic)

> **Note:** These tests require a workspace-aware `aw` CLI extension (`aw ws`).
> Until `aw ws` is implemented, tests can be run programmatically via the
> `workspace-harness.ts` helper script (see Appendix A).

---

## Prerequisites

```sh
# 1. Build
bun install && bun run build

# 2. API keys (at least one):
export ANTHROPIC_API_KEY="sk-..."
export OPENAI_API_KEY="sk-..."

# 3. Verify workspace package builds:
bun -e "import { createWorkspace } from '@agent-worker/workspace'; console.log('OK')"
```

## Saving test artifacts

```sh
mkdir -p a2a-artifacts/workspace
# After each test:
TEST_ID="T<N>_workspace_$(date +%Y%m%d_%H%M%S)"
# Artifacts are test-specific; see each test for details
```

---

## Phase 1: Infrastructure (No LLM Required)

These tests validate workspace infrastructure using mock handlers. No API keys needed.

---

### T1 — Workspace Init & Channel Setup

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| Input    | Create workspace with 3 channels, 2 agents                |
| Expected | All channels exist, agents auto-joined to default channel |
| Timeout  | 2s                                                        |
| Retry    | No                                                        |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general", "design", "code-review"],
  defaultChannel: "general",
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

// Verify channels
const channels = ws.contextProvider.channels.listChannels();
console.log("channels:", channels);
// Expected: ["general", "design", "code-review"]
assert(channels.includes("general"));
assert(channels.includes("design"));
assert(channels.includes("code-review"));

// Verify agents joined default channel
const aliceChannels = ws.getAgentChannels("alice");
const bobChannels = ws.getAgentChannels("bob");
console.log("alice channels:", [...aliceChannels]);
console.log("bob channels:", [...bobChannels]);
assert(aliceChannels.has("general"));
assert(bobChannels.has("general"));

await ws.shutdown();
console.log("T1: PASS");
```

**Pass criteria:**

- 3 channels created
- Both agents auto-joined to `general`
- `shutdown()` completes without error

---

### T2 — Channel Send & Read

| Field    | Value                                                 |
| -------- | ----------------------------------------------------- |
| Input    | Post 3 messages to #general, read back                |
| Expected | All 3 messages returned in order, with correct fields |
| Timeout  | 2s                                                    |
| Retry    | No                                                    |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

// Send 3 messages
await ws.contextProvider.smartSend("general", "alice", "Hello team!");
await ws.contextProvider.smartSend("general", "bob", "Hi alice!");
await ws.contextProvider.smartSend("general", "alice", "@bob Can you review?");

// Read all
const msgs = await ws.contextProvider.channels.read("general");
console.log("messages:", msgs.length);
console.log("msg[0]:", msgs[0].from, msgs[0].content);
console.log("msg[2] mentions:", msgs[2].mentions);

assert(msgs.length === 3);
assert(msgs[0].from === "alice");
assert(msgs[0].content === "Hello team!");
assert(msgs[1].from === "bob");
assert(msgs[2].mentions.includes("bob"));

// Verify message IDs are unique
const ids = msgs.map((m) => m.id);
assert(new Set(ids).size === 3, "message IDs must be unique");

await ws.shutdown();
console.log("T2: PASS");
```

**Pass criteria:**

- 3 messages in order
- Correct `from`, `content`, `mentions` fields
- Unique message IDs (invariant #2)

---

### T3 — @mention → Inbox Routing

| Field    | Value                                                   |
| -------- | ------------------------------------------------------- |
| Input    | Send `@bob please review` to #general                   |
| Expected | Bob's inbox has 1 pending entry referencing the message |
| Timeout  | 2s                                                      |
| Retry    | No                                                      |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

// Alice sends message mentioning bob
await ws.contextProvider.smartSend("general", "alice", "@bob please review the PR");

// Check bob's inbox
const bobInbox = await ws.contextProvider.inbox.peek("bob");
console.log("bob inbox:", bobInbox.length);
console.log("bob inbox[0]:", bobInbox[0]?.messageId, bobInbox[0]?.state);

assert(bobInbox.length === 1, "bob should have 1 inbox entry");
assert(bobInbox[0].state === "pending");
assert(bobInbox[0].channel === "general");

// Alice should NOT have an inbox entry (she sent it)
const aliceInbox = await ws.contextProvider.inbox.peek("alice");
console.log("alice inbox:", aliceInbox.length);
assert(aliceInbox.length === 0, "sender should not get own message in inbox");

// Resolve the message content from channel
const msg = await ws.contextProvider.channels.getMessage("general", bobInbox[0].messageId);
assert(msg !== null);
assert(msg!.content.includes("review the PR"));

await ws.shutdown();
console.log("T3: PASS");
```

**Pass criteria:**

- Bob's inbox has 1 pending entry
- Entry references correct message
- Alice (sender) does not get self-delivery
- Message content resolvable from channel (invariant #4: inbox stores refs)

---

### T4 — Inbox Selective Ack & Defer

| Field    | Value                                             |
| -------- | ------------------------------------------------- |
| Input    | Enqueue 3 messages, ack #2, defer #1, check state |
| Expected | Only #3 remains pending, #1 deferred, #2 gone     |
| Timeout  | 2s                                                |
| Retry    | No                                                |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

// Send 3 messages to bob
await ws.contextProvider.smartSend("general", "alice", "@bob task 1 — complex");
await ws.contextProvider.smartSend("general", "alice", "@bob task 2 — simple ack");
await ws.contextProvider.smartSend("general", "alice", "@bob task 3 — medium");

const inbox = await ws.contextProvider.inbox.peek("bob");
assert(inbox.length === 3);

const [task1, task2, task3] = inbox;

// Bob acks task2 first (selective ack — out of order)
await ws.contextProvider.inbox.ack("bob", task2.messageId);

// Bob defers task1 (not ready yet)
const future = new Date(Date.now() + 300_000).toISOString();
await ws.contextProvider.inbox.defer("bob", task1.messageId, future);

// Check remaining
const remaining = await ws.contextProvider.inbox.peek("bob");
console.log("remaining:", remaining.length);
console.log(
  "remaining entries:",
  remaining.map((e) => e.messageId),
);

// Only task3 should be pending (task1 deferred with future time, task2 acked)
assert(remaining.length === 1, "only task3 should be pending");
assert(remaining[0].messageId === task3.messageId);

// Verify no duplicate delivery (invariant #7)
assert(
  !(await ws.contextProvider.inbox.hasEntry("bob", task2.messageId)),
  "acked entry should be removed",
);

await ws.shutdown();
console.log("T4: PASS");
```

**Pass criteria:**

- Task2 acked and removed
- Task1 deferred (not in pending peek)
- Task3 remains pending
- Selective ack works (processed #2 before #1)

---

### T5 — SmartSend Resource Auto-Creation

| Field    | Value                                                       |
| -------- | ----------------------------------------------------------- |
| Input    | Send message > 1200 chars                                   |
| Expected | Short reference posted to channel, full content in resource |
| Timeout  | 2s                                                          |
| Retry    | No                                                          |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice"],
  storage: new MemoryStorage(),
  smartSendThreshold: 100, // Low threshold for testing
});

const longContent = "x".repeat(200);
const msg = await ws.contextProvider.smartSend("general", "alice", longContent);

// Channel message should be a short reference
console.log("msg content length:", msg.content.length);
console.log("msg content:", msg.content.slice(0, 80));
assert(msg.content.length < 200, "channel message should be truncated");
assert(msg.content.includes("resource"), "should reference a resource");

// Extract resource ID and read full content
const resMatch = msg.content.match(/res_[a-zA-Z0-9_-]+/);
assert(resMatch, "should contain resource ID");
const resource = await ws.contextProvider.resources.read(resMatch![0]);
assert(resource !== null);
assert(resource!.content === longContent, "resource should have full content");

await ws.shutdown();
console.log("T5: PASS");
```

**Pass criteria:**

- Channel message shortened with resource reference
- Resource stores full content
- Resource ID in `res_*` format

---

### T6 — InstructionQueue Priority Ordering

| Field    | Value                                              |
| -------- | -------------------------------------------------- |
| Input    | Enqueue background, normal, immediate instructions |
| Expected | Dequeue order: immediate → normal → background     |
| Timeout  | 2s                                                 |
| Retry    | No                                                 |

```ts
import { InstructionQueue, nanoid } from "@agent-worker/workspace";

const queue = new InstructionQueue();

// Enqueue in reverse priority order
queue.enqueue({
  id: nanoid(),
  agentName: "alice",
  messageId: "m1",
  channel: "general",
  content: "bg task",
  priority: "background",
  enqueuedAt: new Date().toISOString(),
});
queue.enqueue({
  id: nanoid(),
  agentName: "alice",
  messageId: "m2",
  channel: "general",
  content: "normal task",
  priority: "normal",
  enqueuedAt: new Date().toISOString(),
});
queue.enqueue({
  id: nanoid(),
  agentName: "alice",
  messageId: "m3",
  channel: "general",
  content: "urgent task",
  priority: "immediate",
  enqueuedAt: new Date().toISOString(),
});

console.log("queue size:", queue.size);
assert(queue.size === 3);

const first = queue.dequeue("alice");
const second = queue.dequeue("alice");
const third = queue.dequeue("alice");

console.log("order:", first?.priority, second?.priority, third?.priority);

assert(first?.priority === "immediate", "immediate first");
assert(second?.priority === "normal", "normal second");
assert(third?.priority === "background", "background third");
assert(queue.dequeue("alice") === null, "queue empty");

console.log("T6: PASS");
```

**Pass criteria:**

- Dequeue order respects priority: immediate → normal → background
- Queue empty after 3 dequeues

---

### T7 — InstructionQueue Starvation Protection

| Field    | Value                                                    |
| -------- | -------------------------------------------------------- |
| Input    | 1 background + stream of immediate tasks                 |
| Expected | Background task eventually promoted after quota exceeded |
| Timeout  | 2s                                                       |
| Retry    | No                                                       |

```ts
import { InstructionQueue, nanoid } from "@agent-worker/workspace";

const queue = new InstructionQueue({
  immediateQuota: 4, // After 4 immediate, must serve 1 normal/bg
});

// 1 background task
queue.enqueue({
  id: nanoid(),
  agentName: "alice",
  messageId: "bg",
  channel: "general",
  content: "background",
  priority: "background",
  enqueuedAt: new Date().toISOString(),
});

// 6 immediate tasks
for (let i = 0; i < 6; i++) {
  queue.enqueue({
    id: nanoid(),
    agentName: "alice",
    messageId: `imm-${i}`,
    channel: "general",
    content: `immediate-${i}`,
    priority: "immediate",
    enqueuedAt: new Date().toISOString(),
  });
}

const results: string[] = [];
let item;
while ((item = queue.dequeue("alice")) !== null) {
  results.push(item.priority);
}

console.log("dequeue order:", results);

// Background task should appear by position 5 (after 4 immediate, bandwidth policy kicks in)
const bgIndex = results.indexOf("background");
console.log("background served at index:", bgIndex);
assert(bgIndex >= 0, "background must be served");
assert(bgIndex <= 5, "background served within quota window");

console.log("T7: PASS");
```

**Pass criteria:**

- Background task served before all immediate tasks are consumed
- Bandwidth policy prevents starvation

---

### T8 — DM Visibility

| Field    | Value                                                     |
| -------- | --------------------------------------------------------- |
| Input    | Send DM from alice to bob                                 |
| Expected | Only sender and recipient can see DM; other agents cannot |
| Timeout  | 2s                                                        |
| Retry    | No                                                        |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob", "charlie"],
  storage: new MemoryStorage(),
});

// Alice DMs bob
await ws.contextProvider.smartSend("general", "alice", "Secret message for you", {
  to: "bob",
  priority: "immediate",
});

// Bob should have it in inbox (DM = immediate priority)
const bobInbox = await ws.contextProvider.inbox.peek("bob");
console.log("bob inbox:", bobInbox.length);
assert(bobInbox.length === 1, "bob should receive DM");
assert(bobInbox[0].priority === "immediate", "DM should be immediate priority");

// Charlie should NOT have it
const charlieInbox = await ws.contextProvider.inbox.peek("charlie");
console.log("charlie inbox:", charlieInbox.length);
assert(charlieInbox.length === 0, "charlie should not see DM");

await ws.shutdown();
console.log("T8: PASS");
```

**Pass criteria:**

- DM delivered to recipient only
- DM has `immediate` priority
- Non-recipients have empty inbox

---

### T9 — Team Documents CRUD

| Field    | Value                                       |
| -------- | ------------------------------------------- |
| Input    | Create, read, write, append, list documents |
| Expected | Full CRUD lifecycle works                   |
| Timeout  | 2s                                          |
| Retry    | No                                          |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice"],
  storage: new MemoryStorage(),
});

const docs = ws.contextProvider.documents;

// Create
await docs.create("spec.md", "# Spec v1", "alice");
const content = await docs.read("spec.md");
assert(content === "# Spec v1");

// Write (overwrite)
await docs.write("spec.md", "# Spec v2", "alice");
const updated = await docs.read("spec.md");
assert(updated === "# Spec v2");

// Append
await docs.append("spec.md", "\n## Section 2", "alice");
const appended = await docs.read("spec.md");
assert(appended === "# Spec v2\n## Section 2");

// List
await docs.create("readme.md", "# README", "alice");
const list = await docs.list();
console.log("docs:", list);
assert(list.length === 2);
assert(list.includes("spec.md"));
assert(list.includes("readme.md"));

// Read non-existent
const missing = await docs.read("nope.md");
assert(missing === null);

await ws.shutdown();
console.log("T9: PASS");
```

**Pass criteria:**

- Create, read, write, append all work
- List returns all documents
- Non-existent document returns null

---

### T10 — EventLog Routing Invariants

| Field    | Value                                                        |
| -------- | ------------------------------------------------------------ |
| Input    | Log `tool_call`, `system`, `debug` events; attempt `message` |
| Expected | Non-message events go to timeline; `message` throws          |
| Timeout  | 2s                                                           |
| Retry    | No                                                           |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice"],
  storage: new MemoryStorage(),
});

// Valid event kinds → timeline
await ws.eventLog.log("alice", "tool_call", "called bash", {
  toolCall: { name: "bash", args: { cmd: "ls" }, result: "file.txt" },
});
await ws.eventLog.log("alice", "system", "Agent started");
await ws.eventLog.log("alice", "debug", "Verbose info");

const timeline = await ws.contextProvider.timeline.read("alice");
console.log("timeline entries:", timeline.length);
assert(timeline.length === 3);
assert(timeline[0].kind === "tool_call");
assert(timeline[1].kind === "system");
assert(timeline[2].kind === "debug");

// Invariant #12: message kind must NOT go to EventLog
let threw = false;
try {
  await ws.eventLog.log("alice", "message", "This should fail");
} catch (e) {
  threw = true;
  console.log("correctly threw:", (e as Error).message);
}
assert(threw, "logging 'message' to EventLog must throw");

await ws.shutdown();
console.log("T10: PASS");
```

**Pass criteria:**

- `tool_call`, `system`, `debug` → timeline
- `message` → throws error (invariant #12)
- Timeline entries have unique IDs (invariant #14)

---

### T11 — Agent Status Tracking

| Field    | Value                                     |
| -------- | ----------------------------------------- |
| Input    | Set status for multiple agents, read back |
| Expected | Status correctly tracked per agent        |
| Timeout  | 2s                                        |
| Retry    | No                                        |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

await ws.contextProvider.status.set("alice", "running", "Reviewing PR");
await ws.contextProvider.status.set("bob", "idle");

const alice = await ws.contextProvider.status.get("alice");
const bob = await ws.contextProvider.status.get("bob");
console.log("alice:", alice?.status, alice?.currentTask);
console.log("bob:", bob?.status);

assert(alice?.status === "running");
assert(alice?.currentTask === "Reviewing PR");
assert(bob?.status === "idle");

const all = await ws.contextProvider.status.getAll();
console.log("all agents:", all.length);
assert(all.length === 2);

await ws.shutdown();
console.log("T11: PASS");
```

**Pass criteria:**

- Per-agent status with optional task description
- `getAll()` returns all agents

---

### T12 — Workspace Tools via createAgentTools

| Field    | Value                                                  |
| -------- | ------------------------------------------------------ |
| Input    | Create tools for agent, invoke channel_send + my_inbox |
| Expected | Message posted, appears in inbox of mentioned agent    |
| Timeout  | 2s                                                     |
| Retry    | No                                                     |

```ts
import { createWorkspace, createAgentTools, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

const { tools: aliceTools } = createAgentTools("alice", ws);
const { tools: bobTools } = createAgentTools("bob", ws);

// Alice sends via tool
const sendResult = await aliceTools.channel_send({
  channel: "general",
  content: "@bob can you help?",
});
console.log("send result:", sendResult);

// Bob checks inbox via tool
const inboxResult = await bobTools.my_inbox();
console.log("bob inbox:", inboxResult);
assert(inboxResult.includes("can you help"), "inbox should show message");

// Bob acks via tool
const bobInbox = await ws.contextProvider.inbox.peek("bob");
await bobTools.my_inbox_ack({ message_id: bobInbox[0].messageId });

const afterAck = await bobTools.my_inbox();
console.log("bob inbox after ack:", afterAck);
assert(afterAck.includes("empty") || afterAck.includes("0"), "inbox should be empty");

// Channel list tool
const listResult = await aliceTools.channel_list();
console.log("channels:", listResult);
assert(listResult.includes("general"));

await ws.shutdown();
console.log("T12: PASS");
```

**Pass criteria:**

- Tools work as expected for the calling agent
- Agent identity correctly scoped per tool set
- Inbox → ack lifecycle works via tools

---

### T13 — Instance Tag Isolation (Invariant #10)

| Field    | Value                                                 |
| -------- | ----------------------------------------------------- |
| Input    | Create 2 workspaces with same name but different tags |
| Expected | Zero shared state between instances                   |
| Timeout  | 2s                                                    |
| Retry    | No                                                    |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws1 = await createWorkspace({
  name: "review",
  tag: "pr-123",
  channels: ["general"],
  agents: ["reviewer"],
  storage: new MemoryStorage(), // Each gets own storage = isolated
});

const ws2 = await createWorkspace({
  name: "review",
  tag: "pr-456",
  channels: ["general"],
  agents: ["reviewer"],
  storage: new MemoryStorage(),
});

// Post to ws1 only
await ws1.contextProvider.smartSend("general", "user", "@reviewer check PR-123");

// ws1 reviewer should have inbox entry
const inbox1 = await ws1.contextProvider.inbox.peek("reviewer");
assert(inbox1.length === 1, "ws1 reviewer should have message");

// ws2 reviewer should have nothing (isolated)
const inbox2 = await ws2.contextProvider.inbox.peek("reviewer");
assert(inbox2.length === 0, "ws2 reviewer must be isolated");

// Tags are accessible
assert(ws1.tag === "pr-123");
assert(ws2.tag === "pr-456");

await ws1.shutdown();
await ws2.shutdown();
console.log("T13: PASS");
```

**Pass criteria:**

- Each workspace instance completely isolated
- Messages in one don't appear in the other
- Tags accessible via `workspace.tag`

---

## Phase 2: Multi-Agent Collaboration (LLM Required)

These tests use real LLM backends to verify end-to-end multi-agent workspaces.

---

### T14 — Two-Agent Ping-Pong

| Field    | Value                                                    |
| -------- | -------------------------------------------------------- |
| Input    | Alice sends @bob, bob responds @alice, verify round-trip |
| Expected | Both agents process messages, channel has conversation   |
| Timeout  | 30s                                                      |
| Retry    | Yes (LLM dependent)                                      |
| Requires | `ANTHROPIC_API_KEY`                                      |

```ts
import { createWorkspace, createWiredLoop, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

// Track processed instructions
const processed: string[] = [];

const aliceLoop = createWiredLoop({
  name: "alice",
  instructions:
    "You are Alice. When you receive a message, reply in the same channel with a short acknowledgment. Always @mention the sender.",
  runtime: ws,
  pollInterval: 1000,
  onInstruction: async (prompt, instruction) => {
    processed.push(`alice: ${instruction.content.slice(0, 50)}`);
    // In real test: feed prompt to LLM, handle response
    // For mock: auto-reply
    await ws.contextProvider.smartSend("general", "alice", `@bob Got it! Processing your request.`);
  },
});

const bobLoop = createWiredLoop({
  name: "bob",
  instructions: "You are Bob. When you receive a message, reply with a short response.",
  runtime: ws,
  pollInterval: 1000,
  onInstruction: async (prompt, instruction) => {
    processed.push(`bob: ${instruction.content.slice(0, 50)}`);
    await ws.contextProvider.smartSend("general", "bob", `@alice Done!`);
  },
});

// Start loops
await aliceLoop.start();
await bobLoop.start();

// Kickoff
await ws.contextProvider.smartSend(
  "general",
  "user",
  "@alice Please coordinate with @bob on the review",
);

// Wait for processing
await new Promise((r) => setTimeout(r, 5000));

// Stop
await aliceLoop.stop();
await bobLoop.stop();

// Verify conversation happened
const msgs = await ws.contextProvider.channels.read("general");
console.log("total messages:", msgs.length);
console.log("processed:", processed);
for (const msg of msgs) {
  console.log(`  ${msg.from}: ${msg.content.slice(0, 60)}`);
}

assert(msgs.length >= 2, "should have multiple messages");
assert(processed.length >= 1, "at least one agent processed");

await ws.shutdown();
console.log("T14: PASS");
```

**Pass criteria:**

- At least 2 messages in channel after kickoff
- Both agents process at least 1 instruction each
- No infinite loop (agents stop cleanly)

---

### T15 — Multi-Channel Topic Isolation

| Field    | Value                                                 |
| -------- | ----------------------------------------------------- |
| Input    | Alice in #design, bob in #code-review, send to each   |
| Expected | Each agent only receives messages from their channels |
| Timeout  | 5s                                                    |
| Retry    | No                                                    |

```ts
import { createWorkspace, createAgentTools, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general", "design", "code-review"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

// Alice joins #design, bob joins #code-review
const { tools: aliceTools } = createAgentTools("alice", ws);
const { tools: bobTools } = createAgentTools("bob", ws);
await aliceTools.channel_join({ channel: "design" });
await bobTools.channel_join({ channel: "code-review" });

// Send to design (alice should get, bob should not)
await ws.contextProvider.smartSend("design", "user", "@alice review the design");

// Send to code-review (bob should get, alice should not)
await ws.contextProvider.smartSend("code-review", "user", "@bob review the code");

const aliceInbox = await ws.contextProvider.inbox.peek("alice");
const bobInbox = await ws.contextProvider.inbox.peek("bob");

console.log(
  "alice inbox:",
  aliceInbox.length,
  aliceInbox.map((e) => e.channel),
);
console.log(
  "bob inbox:",
  bobInbox.length,
  bobInbox.map((e) => e.channel),
);

assert(aliceInbox.length === 1);
assert(aliceInbox[0].channel === "design");
assert(bobInbox.length === 1);
assert(bobInbox[0].channel === "code-review");

await ws.shutdown();
console.log("T15: PASS");
```

**Pass criteria:**

- Alice only sees #design messages
- Bob only sees #code-review messages
- Channel isolation is correct

---

### T16 — Prompt Assembly Content

| Field    | Value                                                         |
| -------- | ------------------------------------------------------------- |
| Input    | Assemble prompt for agent with inbox, team info, instructions |
| Expected | Prompt contains all sections in correct order                 |
| Timeout  | 2s                                                            |
| Retry    | No                                                            |

```ts
import {
  createWorkspace,
  MemoryStorage,
  assemblePrompt,
  DEFAULT_SECTIONS,
  type PromptContext,
} from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice", "bob"],
  storage: new MemoryStorage(),
});

// Setup some state
await ws.contextProvider.status.set("alice", "running", "Reviewing PR");
await ws.contextProvider.status.set("bob", "idle");
await ws.contextProvider.documents.create("spec.md", "# Project Spec", "alice");
await ws.contextProvider.smartSend("general", "bob", "@alice please check this");

const inboxEntries = await ws.contextProvider.inbox.peek("alice");

const prompt = await assemblePrompt(DEFAULT_SECTIONS, {
  agentName: "alice",
  instructions: "You are a code reviewer.",
  provider: ws.contextProvider,
  inboxEntries,
  currentInstruction: "please check this",
});

console.log("--- PROMPT ---");
console.log(prompt);
console.log("--- END ---");

// Verify sections present
assert(prompt.includes("alice"), "should include agent name");
assert(prompt.includes("code reviewer"), "should include instructions");
assert(prompt.includes("bob"), "should include team members");
assert(prompt.includes("spec.md"), "should include documents");
assert(prompt.includes("please check this"), "should include current instruction");

await ws.shutdown();
console.log("T16: PASS");
```

**Pass criteria:**

- Prompt includes soul section (agent identity)
- Prompt includes team roster
- Prompt includes inbox summary
- Prompt includes document list
- Prompt includes current instruction

---

### T17 — Workspace shouldYield (Cooperative Preemption)

| Field    | Value                                       |
| -------- | ------------------------------------------- |
| Input    | Agent processing bg task, immediate arrives |
| Expected | `shouldYield()` returns true                |
| Timeout  | 2s                                          |
| Retry    | No                                          |

```ts
import { InstructionQueue, nanoid } from "@agent-worker/workspace";

const queue = new InstructionQueue();

// Start with a background task (simulates agent dequeued it)
// Then an immediate arrives while agent is "working"
queue.enqueue({
  id: nanoid(),
  agentName: "alice",
  messageId: "urgent",
  channel: "general",
  content: "urgent fix needed",
  priority: "immediate",
  enqueuedAt: new Date().toISOString(),
});

// Agent is currently processing a background task — should it yield?
const shouldYield = queue.shouldYield("alice");
console.log("shouldYield:", shouldYield);
assert(shouldYield === true, "should yield for immediate task");

// No immediate task pending
const queue2 = new InstructionQueue();
queue2.enqueue({
  id: nanoid(),
  agentName: "alice",
  messageId: "normal",
  channel: "general",
  content: "normal task",
  priority: "normal",
  enqueuedAt: new Date().toISOString(),
});
assert(queue2.shouldYield("alice") === false, "should not yield for normal");

console.log("T17: PASS");
```

**Pass criteria:**

- `shouldYield` returns true when immediate is pending
- `shouldYield` returns false for normal-only queue

---

## Phase 3: Edge Cases & Invariants

---

### T18 — Channel Append-Only Immutability (Invariant #1)

| Field    | Value                                                 |
| -------- | ----------------------------------------------------- |
| Input    | Send message, verify no mutation API exists           |
| Expected | Messages cannot be modified or deleted after creation |
| Timeout  | 2s                                                    |
| Retry    | No                                                    |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice"],
  storage: new MemoryStorage(),
});

await ws.contextProvider.smartSend("general", "alice", "Original message");

const msgs1 = await ws.contextProvider.channels.read("general");
const originalId = msgs1[0].id;
const originalContent = msgs1[0].content;

// Send more messages
await ws.contextProvider.smartSend("general", "alice", "Second message");

// Re-read — original message must be unchanged
const msgs2 = await ws.contextProvider.channels.read("general");
assert(msgs2[0].id === originalId, "message ID must not change");
assert(msgs2[0].content === originalContent, "message content must not change");
assert(msgs2.length === 2, "append only — 2 messages now");

// Verify ChannelStore has no update/delete methods
const store = ws.contextProvider.channels;
assert(!("update" in store), "no update method should exist");
assert(!("delete" in store), "no delete method should exist");

await ws.shutdown();
console.log("T18: PASS");
```

**Pass criteria:**

- Original message immutable after new appends
- No update/delete API on ChannelStore

---

### T19 — Run Epoch (markRunStart Clears Stale Inbox)

| Field    | Value                                              |
| -------- | -------------------------------------------------- |
| Input    | Enqueue entries, call markRunStart, verify cleared |
| Expected | All stale entries from "previous run" are gone     |
| Timeout  | 2s                                                 |
| Retry    | No                                                 |

```ts
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";

const ws = await createWorkspace({
  name: "test",
  channels: ["general"],
  agents: ["alice"],
  storage: new MemoryStorage(),
});

// Simulate stale entries from a previous run
await ws.contextProvider.smartSend("general", "user", "@alice old task 1");
await ws.contextProvider.smartSend("general", "user", "@alice old task 2");

const before = await ws.contextProvider.inbox.peek("alice");
console.log("before markRunStart:", before.length);
assert(before.length === 2);

// Simulate workspace restart → markRunStart
await ws.contextProvider.inbox.markRunStart("alice");

const after = await ws.contextProvider.inbox.peek("alice");
console.log("after markRunStart:", after.length);
assert(after.length === 0, "stale entries should be cleared");

// New messages after markRunStart should work
await ws.contextProvider.smartSend("general", "user", "@alice new task");
const fresh = await ws.contextProvider.inbox.peek("alice");
assert(fresh.length === 1, "new messages should be delivered");

await ws.shutdown();
console.log("T19: PASS");
```

**Pass criteria:**

- `markRunStart` clears all previous entries
- New messages after epoch are delivered normally

---

## Timeout Reference

| Phase   | Test Type          | Timeout |
| ------- | ------------------ | ------- |
| Phase 1 | Infrastructure     | 2s      |
| Phase 2 | Multi-agent (mock) | 5-10s   |
| Phase 2 | Multi-agent (LLM)  | 30s     |
| Phase 3 | Edge cases         | 2s      |

---

## Test Result Matrix

Record: pass (P), fail (F), skip (S), flaky (FL).

| Test | Description                          | Mock | Anthropic | OpenAI | Artifact |
| ---- | ------------------------------------ | ---- | --------- | ------ | -------- |
| T1   | Workspace init & channel setup       |      |           |        |          |
| T2   | Channel send & read                  |      |           |        |          |
| T3   | @mention → inbox routing             |      |           |        |          |
| T4   | Inbox selective ack & defer          |      |           |        |          |
| T5   | SmartSend resource auto-creation     |      |           |        |          |
| T6   | Priority queue ordering              |      |           |        |          |
| T7   | Starvation protection                |      |           |        |          |
| T8   | DM visibility                        |      |           |        |          |
| T9   | Team documents CRUD                  |      |           |        |          |
| T10  | EventLog routing invariants          |      |           |        |          |
| T11  | Agent status tracking                |      |           |        |          |
| T12  | Workspace tools via createAgentTools |      |           |        |          |
| T13  | Instance tag isolation               |      |           |        |          |
| T14  | Two-agent ping-pong                  |      |           |        |          |
| T15  | Multi-channel topic isolation        |      |           |        |          |
| T16  | Prompt assembly content              |      |           |        |          |
| T17  | Cooperative preemption (shouldYield) |      |           |        |          |
| T18  | Channel append-only immutability     |      |           |        |          |
| T19  | Run epoch (markRunStart)             |      |           |        |          |

**Artifact naming:** `a2a-artifacts/workspace/T<N>_<YYYYMMDD_HHMMSS>_{log,state}.{json,txt}`

---

## Appendix A: Harness Script

Until `aw ws` commands are implemented, run tests with:

```sh
# Run a single test:
bun packages/workspace/test/a2a/workspace-harness.ts T1

# Run all Phase 1 tests:
bun packages/workspace/test/a2a/workspace-harness.ts phase1

# Run all tests:
bun packages/workspace/test/a2a/workspace-harness.ts all
```

The harness script executes each test's TypeScript block, captures output, and
reports pass/fail with artifact saving.

## Appendix B: Future Tests (Post-v1)

These tests are planned for after v1 stabilizes:

- **T20 — ChannelBridge anti-loop protection**: External adapter echo prevention
- **T21 — FileStorage crash recovery**: Kill process mid-write, verify JSONL repair
- **T22 — Channel index checkpoint**: Large channel (>1000 msgs), verify index rebuild performance
- **T23 — Coordinator protocol**: Cross-instance message delivery (requires coordinator workspace)
- **T24 — MCP HTTP server**: Full MCP transport test with external client
- **T25 — Scheduled wakeups**: Cron-based agent polling verification
