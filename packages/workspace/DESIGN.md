# @agent-worker/workspace

Multi-agent workspace: named channels, @mention routing, independent inbox with selective ack, resource system, and external platform bridges.

> Informed by moniro/workspace — battle-tested patterns adapted for agent-worker.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          Workspace                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │               ChannelManager                                │   │
│  │  #general (default)  #design  #code-review  ...             │   │
│  │  each channel = independent append-only JSONL               │   │
│  └──────┬──────────────────────────────┬──────────────────────┘   │
│         │ new message event            │ emit("message")          │
│  ┌──────▼──────────────────┐    ┌──────▼──────────────────┐      │
│  │   InboxStore            │    │   ChannelBridge          │      │
│  │   independent per-agent │    │   anti-loop protection   │      │
│  │   message queue         │    │                          │      │
│  │   • selective ack       │    │  ┌────────┐ ┌────────┐  │      │
│  │   • peek all pending    │    │  │Telegram│ │Webhook │  │      │
│  │   • skip / defer        │    │  └────────┘ └────────┘  │      │
│  │   • priority tagging    │    └─────────────────────────┘      │
│  └──────┬──────────────────┘                                      │
│         │ dequeue                                                  │
│  ┌──────▼──────────────────┐    ┌─────────────────────────┐      │
│  │   InstructionQueue      │    │   ContextProvider        │      │
│  │   3-lane priority       │    │   (composite)            │      │
│  │   immediate│normal│bg   │    │                          │      │
│  └──────┬──────────────────┘    │  Channels ─ Inbox        │      │
│         │                       │  Document ─ Resource      │      │
│  ┌──────▼──────┐ ┌──────┐     │  Status ─ Timeline        │      │
│  │ AgentLoop A │ │Loop B│     └─────────────────────────┘      │
│  └─────────────┘ └──────┘                                        │
│                                                                   │
│  ┌─────────────────────────┐    ┌─────────────────────────┐      │
│  │   MCP Server (HTTP)     │    │   EventLog               │      │
│  │   workspace tools for   │    │   unified event entry    │      │
│  │   any backend           │    │   point                  │      │
│  └─────────────────────────┘    └─────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Workspace

Top-level container. Owns all agents, shared context, and optional platform bridges.
Handles lifecycle (`init` / `stop`) and wires everything together.

Two composable primitives (factory pattern):
1. `createWorkspace()` — context + MCP + event log (the shared infrastructure)
2. `createWiredLoop()` — backend + workspace dir + loop (per agent)

### Instance Tag (Multi-Instance Isolation)

A workspace can be instantiated multiple times from the same workflow definition
using `--tag`. Each tag creates a fully isolated workspace instance.

```
aw run review.yaml --tag pr-123    # instance 1: /tmp/agent-worker-review-pr-123/
aw run review.yaml --tag pr-456    # instance 2: /tmp/agent-worker-review-pr-456/
aw run review.yaml                 # instance 3: /tmp/agent-worker-review/
```

**What tag isolates:** Everything — channels, inbox, documents, resources, status,
timeline. Two instances of the same workflow share nothing at runtime.

**Tag in templates:** Available as `${{ workspace.tag }}` for interpolation in
kickoff messages, setup commands, agent instructions, etc.

```yaml
kickoff: "@reviewer Please review PR ${{ workspace.tag }}"
```

**Tag in factory:**

```ts
const workspace = await createWorkspace({
  name: "review",
  tag: "pr-123",  // → contextDir: /tmp/agent-worker-review-pr-123/
  // ...
});
```

**Use cases:**
- Same review workflow running on multiple PRs simultaneously
- Same deploy workflow for different environments (`--tag staging`, `--tag prod`)
- Testing: spin up isolated instances without interference

### Channels (Named, Append-only)

Multiple named channels, each an independent append-only JSONL log. Agents join
channels to receive messages posted there. Channels provide natural topic isolation
with built-in subscription semantics.

**Default behavior:**
- Every workspace has a `defaultChannel` (typically `"general"`)
- Agents auto-join the default channel on registration
- Agents can join/leave channels at any time via tools
- Each channel is independently queryable

**Why multi-channel:**
- Channels serve as topic namespaces (`#design`, `#code-review`, `#ops`)
- Agents only receive messages from channels they've joined — natural noise filtering
- Channel history is isolated — querying `#design` doesn't require filtering through unrelated messages
- Complexity is modest: each channel is just a JSONL file, routing is `channel → subscribers`

**Message structure:**

```ts
interface Message {
  id: string;              // nanoid
  timestamp: string;       // ISO
  from: string;            // agent name or "system"
  channel: string;         // which channel this was posted to
  content: string;
  mentions: string[];      // extracted @mentions
  to?: string;             // DM recipient (private to sender + recipient)
  kind?: EventKind;        // "message" | "tool_call" | "system" | "output" | "debug"
  toolCall?: ToolCallData; // metadata when kind="tool_call"
}
```

**Visibility rules:**
- Channel messages: visible to all agents who have joined that channel
- DMs (`to` field): visible only to sender and recipient (channel-independent)
- System/debug/output: filtered out of agent inbox (operational noise)

**SmartSend:** Messages longer than ~1200 chars are automatically stored as a
Resource, with only a short reference posted to the channel. Prevents channel bloat.

### Inbox (Independent Per-Agent Store)

The inbox is an **independent message queue per agent**, not a cursor-based filtered
view of the channel. When a channel message @mentions an agent or matches their
subscriptions, a reference is enqueued into their inbox.

**Why independent inbox over cursor-based:**
- **Selective ack:** Agent can process message #3 before message #1 — not forced
  into sequential order. A simple confirmation doesn't have to wait behind a complex task.
- **Peek all pending:** Agent can see everything waiting and make its own scheduling
  decisions, not just "next in line."
- **Skip / defer:** Agent can explicitly defer a message for later without blocking
  the queue. Useful for "I need more info before I can handle this."
- **Priority tagging:** Each inbox entry carries a priority (immediate/normal/background)
  that the InstructionQueue uses for scheduling. With cursors, priority must be
  inferred from channel position.

**How it works:**
1. Channel emits a `"message"` event on append
2. InboxStore listens, checks: does this message @mention agent X? Is agent X
   a member of this channel?
3. If yes, enqueues a **reference** (messageId + channel + priority + state) into
   agent X's inbox — not a full copy of the message content
4. Agent loop calls `my_inbox` to peek pending (resolves content from channel),
   `my_inbox_ack(id)` to acknowledge

**Inbox entry structure:**

```ts
interface InboxEntry {
  messageId: string;       // references Message.id in channel
  channel: string;         // which channel the message lives in
  priority: Priority;      // immediate | normal | background
  state: InboxState;       // pending | seen | deferred
  enqueuedAt: string;      // ISO timestamp
  deferredUntil?: string;  // optional: defer expiry
}
```

**Inbox entry lifecycle:**
```
pending → seen (loop picked it up) → acked (removed from inbox)
                                   → deferred (returns to pending, optional expiry)
```

**GC rules:**
- `acked` entries are removed immediately
- `deferred` entries return to `pending` after optional expiry (or on next poll if no expiry)
- On workspace init, `markRunStart()` clears all stale entries from previous runs

**Run epoch:** On workspace init, `markRunStart()` clears stale inbox entries from
previous runs. Only new messages trigger work.

### InstructionQueue (Priority Routing)

Three-lane priority queue inspired by React Fiber lanes:

| Priority      | Source                     | Behavior                    |
|---------------|----------------------------|-----------------------------|
| `immediate`   | DM, @mention (high)        | Process next, preempt bg    |
| `normal`      | @mention (normal), direct  | FIFO within lane            |
| `background`  | Channel broadcast, wakeup  | Yield to higher priority    |

**Cooperative preemption:** A running background task checks `shouldYield()` —
if a higher-priority instruction arrives, the current task saves progress and
re-queues itself. The higher-priority instruction runs first.

**Preempted instructions** carry progress state so they resume where they left off.

**Starvation protection:**
- Background instructions that have waited longer than `maxBackgroundWait` (default: 5min)
  are promoted to `normal` priority
- After N consecutive preemptions (default: 3), a background task is promoted to
  `normal` to guarantee forward progress
- Retry after failure: priority stays the same on first retry, degrades one level
  on subsequent retries (immediate→normal→background)

**Lane bandwidth policy:**
- After every 4 consecutive `immediate` dispatches, the queue MUST dispatch
  1 `normal` task if any are pending (prevents normal starvation under immediate storm)
- After every 8 consecutive `immediate + normal` dispatches, the queue MUST dispatch
  1 `background` task if any are pending
- These ratios are configurable: `{ immediateQuota: 4, normalQuota: 8 }`
- Per-agent fairness: within the same lane, round-robin across agents (no single
  agent monopolizes a lane by flooding messages)

**SLO metrics (for monitoring and testing):**

| Metric                        | Target          | Description                          |
|-------------------------------|-----------------|--------------------------------------|
| `immediate_wait_p95`          | < 2s            | Time from enqueue to processing      |
| `normal_wait_p95`             | < 30s           | Time from enqueue to processing      |
| `background_wait_p95`         | < 5min          | Time from enqueue to processing      |
| `background_starvation_count` | 0               | Tasks exceeding maxBackgroundWait     |
| `preemption_count`            | tracked         | Frequency of cooperative preemptions  |

### ContextProvider (Composite)

The ContextProvider interface is satisfied by composing independent stores:

| Store          | Concern                                        | Storage         |
|----------------|------------------------------------------------|-----------------|
| `ChannelStore` | Per-channel append-only JSONL + EventEmitter    | JSONL file/ch   |
| `InboxStore`   | Per-agent refs (messageId+state), not content    | JSONL file/agent|
| `DocumentStore`| Shared team documents (read/write/append)       | Raw text files  |
| `ResourceStore`| Content-addressed blobs for large content       | Per-resource file|
| `StatusStore`  | Agent state tracking (idle/running/stopped)     | JSON file       |
| `TimelineStore`| Per-agent JSONL event log                       | JSONL file      |

Each store owns its own concern and persistence. `smartSend` is the only
cross-store orchestration (channel + resource).

**Storage backend is pluggable:** `MemoryStorage` for tests, `FileStorage` for production.

### Resource System

Large content (>1200 chars) gets stored as a Resource and referenced via `resource:<id>`.

```
Agent sends long message
  → smartSend detects length > threshold
  → Creates resource (res_xxxxx) with full content
  → Posts short reference to channel: "Read the full content: resource_read("res_xxxxx")"
  → Debug log gets the full content for observability
```

**Why:** Without this, one long message (a full code file, a diff, etc.) bloats
the channel and wastes context window for every agent that reads the channel.

### MCP Server (HTTP Transport)

Workspace tools are exposed as an MCP server over HTTP. Every agent loop connects
to the same MCP endpoint. This works with any backend — SDK, Claude CLI, Codex CLI.

**Tool categories:**

| Category      | Tools                                              |
|---------------|----------------------------------------------------|
| **Channel**   | `channel_send`, `channel_read`, `channel_list`, `channel_join`, `channel_leave` |
| **Inbox**     | `my_inbox`, `my_inbox_ack`, `my_inbox_defer`, `my_status_set` |
| **Team**      | `team_members`, `team_doc_read/write/append/list/create` |
| **Resource**  | `resource_create`, `resource_read`                 |
| **Proposal**  | `team_proposal_create`, `team_vote`, `team_proposal_status/cancel` |

**Agent identity:** Extracted from MCP session. Each agent gets its own session
with the same MCP server — the server knows who's calling.

**Direct tool injection** is also supported for SDK loops (directTools capability).

### ChannelBridge (External Platforms)

Event-driven layer over ChannelManager for external platform integration.

```
External Platform
    │
    ▼
ChannelAdapter.start(bridge)     ← adapter subscribes to bridge
    │
    ▼
ChannelBridge.send(channel, from, content) ← injects external msg into channel
    │
    ▼
ChannelStore.append()            ← emits "message" event
    │
    ▼
ChannelBridge.dispatch()         ← pushes to all subscribers
    │                               (with anti-loop filtering)
    ▼
Other adapters receive the message
```

**Anti-loop protection:** Messages from a platform (e.g. `telegram:*`) are not
pushed back to subscribers matching that platform. Prevents infinite echo loops.

**Adapter interface:**

```ts
interface ChannelAdapter {
  readonly platform: string;
  start(bridge: ChannelBridge): Promise<void>;
  shutdown(): Promise<void>;
}
```

### AgentLoop

The loop owns the full orchestration:

```
poll inbox → classify priority → dequeue instruction
→ build prompt → configure workspace → backend.send() → handle result
→ ack inbox → idle (wait for poll or wake)
```

**Features:**
- Polling with configurable interval (default: 5s)
- `wake()` — interrupt poll wait for immediate processing
- `sendDirect()` — synchronous request-response (bypasses poll loop)
- `enqueue()` — inject instruction with explicit priority
- Retry with exponential backoff (configurable attempts, backoff)
- Scheduled wakeups (interval or cron)
- Cooperative preemption via `shouldYield()`

**Prompt assembly** uses composable sections — each section is an independent
function returning content or null. Sections can be added/removed/reordered.

### EventLog

Unified event entry point. Records all notable events across the workspace:

| Kind          | Description                                   |
|---------------|-----------------------------------------------|
| `message`     | Agent-to-agent communication                  |
| `tool_call`   | Tool invocation (MCP, SDK, or backend native) |
| `system`      | Operational log (lifecycle, warnings)          |
| `output`      | Backend streaming text                         |
| `debug`       | Debug-level detail (only shown with --debug)   |

EventLog writes to TimelineStore only — never to channels. Channels are
exclusively for agent-to-agent `message` kind events (see Invariants #12-14
for the full routing table). Agents never write to EventLog directly.

## File Structure

```
packages/workspace/
├── src/
│   ├── workspace.ts             # Main class, lifecycle, wiring
│   ├── factory.ts               # createWorkspace(), createWiredLoop()
│   ├── context/
│   │   ├── provider.ts          # ContextProvider interface + composite impl
│   │   ├── storage.ts           # StorageBackend (Memory, File)
│   │   ├── stores/
│   │   │   ├── channel.ts       # Per-channel append-only JSONL + EventEmitter
│   │   │   ├── inbox.ts         # Independent per-agent message queue
│   │   │   ├── document.ts      # Shared team documents
│   │   │   ├── resource.ts      # Content-addressed blobs
│   │   │   ├── status.ts        # Agent status tracking
│   │   │   └── timeline.ts      # Per-agent JSONL event log
│   │   ├── bridge.ts            # ChannelBridge + ChannelAdapter interface
│   │   ├── event-log.ts         # Unified event entry point
│   │   └── mcp/
│   │       ├── server.ts        # MCP server factory
│   │       ├── channel.ts       # channel_send, channel_read
│   │       ├── inbox.ts         # my_inbox, my_inbox_ack, my_status_set
│   │       ├── team.ts          # team_members, team_doc_*
│   │       └── resource.ts      # resource_create, resource_read
│   ├── loop/
│   │   ├── loop.ts              # createAgentLoop()
│   │   ├── priority-queue.ts    # Three-lane InstructionQueue
│   │   ├── prompt.ts            # Composable prompt sections
│   │   └── types.ts             # AgentLoop, AgentRunContext, etc.
│   ├── adapters/
│   │   ├── telegram.ts          # Telegram adapter
│   │   └── webhook.ts           # Generic webhook adapter
│   ├── types.ts                 # All workspace-level type definitions
│   └── index.ts                 # Public API exports
├── test/
├── DESIGN.md
├── package.json
└── tsconfig.json
```

## Configuration

```ts
import { createWorkspace, createWiredLoop } from "@agent-worker/workspace";

// 1. Create shared infrastructure
const workspace = await createWorkspace({
  name: "code-review",
  tag: "pr-123",  // optional: isolates this instance from other runs of the same workflow
  channels: ["general", "design", "code-review"],
  defaultChannel: "general",
  agents: ["designer", "reviewer"],
  adapters: [
    new TelegramAdapter({ botToken: "...", chatId: "..." }),
  ],
});

// 2. Create per-agent loops
const designerLoop = createWiredLoop({
  name: "designer",
  agent: designerDef,
  runtime: workspace,
  backend: getBackendForModel("claude-sonnet-4-6"),
});

const reviewerLoop = createWiredLoop({
  name: "reviewer",
  agent: reviewerDef,
  runtime: workspace,
  backend: getBackendForModel("claude-sonnet-4-6"),
});

// 3. Start loops
await designerLoop.start();
await reviewerLoop.start();

// 4. Send kickoff (to #general by default)
await workspace.contextProvider.smartSend("general", "user", "@designer Please review this PR");

// 5. Shutdown
await designerLoop.stop();
await reviewerLoop.stop();
await workspace.shutdown();
```

## Design Decisions

1. **Named channels for topic isolation** — multiple channels (`#design`, `#code-review`)
   give agents natural noise filtering via join/leave. Each channel is independently
   queryable. Implementation cost is low (each channel = one JSONL file). Note: channels
   are orthogonal to instance tags — channels organize topics *within* a workspace,
   tags isolate entire workspace *instances* of the same workflow.

2. **Independent inbox with selective ack** — the inbox is its own per-agent queue,
   not a cursor-based filtered view of the channel. This lets agents peek all pending
   messages, process them in any order, and defer messages they're not ready for.
   The cursor approach (moniro) forces strict sequential processing — an agent can't
   skip a complex task to handle a simple confirmation first.

3. **Priority queue with preemption** — not all messages are equal. A DM or direct
   @mention should interrupt a low-priority background task. Three lanes
   (immediate/normal/background) with cooperative preemption give agents proper
   scheduling semantics.

4. **Resource system for long content** — channel messages should be short references.
   Large artifacts (code, diffs, documents) are stored as resources and referenced
   via `resource:<id>`. This keeps the channel lean and avoids wasting context window
   for every agent that reads the channel.

5. **MCP as the universal tool transport** — exposing workspace tools via HTTP MCP
   means any backend (SDK, Claude CLI, Codex CLI, Cursor) can connect. Direct tool
   injection is also supported for SDK loops, but MCP is the default because it
   works everywhere.

6. **ChannelBridge with anti-loop** — external platform integration uses an event-driven
   bridge over ChannelStore. The key insight from moniro: you need anti-loop protection
   (messages from Telegram don't echo back to Telegram) and the bridge pattern handles
   this cleanly.

7. **Composable factory, not monolithic class** — `createWorkspace()` + `createWiredLoop()`
   are independent primitives. The daemon can create workspace infrastructure for both
   standalone and multi-agent workflows. A test can create just a workspace without loops.

8. **Composable prompt sections** — each prompt section (soul, memory, inbox, instructions)
   is an independent function returning content or null. Sections can be added/removed/reordered
   without touching other sections.

9. **StorageBackend abstraction** — `MemoryStorage` for tests, `FileStorage` for production.
   All stores use the same interface, so swapping persistence is a one-line change.

## Invariants

System-wide constraints that all implementations must respect.

### Channel Invariants

1. **Append-only, immutable** — once a message is written to a channel JSONL,
   it is never modified or deleted. No update-in-place, no tombstones.
2. **Message ID is globally unique** — nanoid, no collisions across channels.
3. **Ordering is per-channel** — messages within a channel are strictly ordered
   by append position. No global ordering guarantee across channels.

### Inbox Invariants

4. **Inbox stores references, not content** — each inbox entry contains
   `{ messageId, channel, priority, state, enqueuedAt }`. Full message content
   is resolved from the channel at read time.
5. **Inbox → Channel referential integrity** — an inbox entry's `messageId`
   always points to an existing message (guaranteed by channel append-only).
6. **State transitions are one-directional** (with one exception):
   ```
   pending → seen → acked (terminal, entry removed)
   pending → seen → deferred → pending (the one cycle allowed)
   ```
   No other transitions are valid. `acked` is terminal and irreversible.
7. **One inbox entry per (agent, messageId)** — no duplicate delivery.

### Resource Invariants

8. **Resources are immutable** — once created, content never changes.
   Resource IDs are content-addressed (or at minimum unique and stable).
9. **Resources are never garbage collected while referenced** — a resource
   referenced by a channel message lives as long as the workspace.

### Workspace Invariants

10. **Instance tag is an isolation boundary** — two workspace instances with
    different tags share zero runtime state. No cross-tag reads or writes.
11. **Agent identity is 1:1 with loop** — one agent name = one AgentLoop instance
    = one context window. No agent multiplexing across tasks.

### Event Routing Invariants

12. **Channel is for agent-to-agent communication only** — messages with
    `kind: "message"` go into channels. This is the only kind that enters channels.
13. **Timeline/EventLog is for operational events** — `tool_call`, `system`,
    `output`, `debug` go to TimelineStore/EventLog only. Never to channels.
14. **Canonical event ID** — every event (channel message or timeline entry)
    has a globally unique `id` (nanoid). This is the dedup/idempotency key
    across all stores. No event is written to both channel and timeline.

**Routing table:**

| Event kind   | → Channel | → Timeline/EventLog | Notes                           |
|--------------|-----------|--------------------|---------------------------------|
| `message`    | YES       | NO                 | Agent-to-agent, the core data   |
| `tool_call`  | NO        | YES                | Operational, per-agent timeline  |
| `system`     | NO        | YES                | Lifecycle, warnings              |
| `output`     | NO        | YES                | Backend streaming text           |
| `debug`      | NO        | YES                | Only with --debug flag           |

## Crash Recovery

**Priority data source:** Channel is always the source of truth. Inbox is
rebuildable from channel. All other stores are either append-only (timeline)
or independently recoverable.

### Write Semantics

All JSONL stores use **append-with-fsync**: write full line + `\n`, then fsync.
A partial line (crash mid-write) is detected on startup and truncated.

**Write order for message delivery:**
1. Append message to channel JSONL (fsync)
2. Append inbox entry to agent's inbox JSONL (fsync)

If crash between step 1 and 2: message is in channel but inbox entry is missing.
Recovery will detect and repair this (see below).

### Startup Recovery Algorithm

On `workspace.init()`, before any agent loop starts:

```
1. For each JSONL file (channel, inbox, timeline):
   - Read file, detect and truncate any incomplete trailing line
   - Log warning if truncation occurred

2. For each agent's inbox:
   - Scan inbox entries, collect all messageIds
   - Scan channel messages since run epoch that @mention this agent
   - For any channel message missing from inbox → re-enqueue as pending
   - For any inbox entry whose messageId doesn't exist in channel → remove
     (should not happen given write order, but defensive)

3. Clear all `seen` states → reset to `pending`
   (crash during processing means the task didn't complete;
    agent will re-process on restart)
```

**Idempotency:** Invariant #7 (one inbox entry per agent+messageId) ensures
that re-enqueuing an already-present message is a no-op.

**Non-goal:** We do NOT attempt to recover partial agent processing state.
If an agent was mid-run when crash occurred, the entire instruction is
re-processed from scratch. Agent tools should be idempotent where possible.

## Channel Index (Performance)

For `my_inbox` reads, inbox entries reference `messageId` which must be resolved
to actual message content from the channel. Naively scanning the full channel
JSONL for each lookup would degrade as channels grow.

**In-memory index:** `Map<messageId, fileOffset>` built on startup by scanning
the channel JSONL once. Maintained incrementally on each append.

**Checkpoint:** Periodically persist `{ lastOffset, indexSnapshot }` so that
startup doesn't require full rescan of large channels. On recovery, scan only
from `lastOffset` forward.

**Bounds:** Index is per-channel, lives in memory only (checkpoint is optimization,
not requirement). Memory cost: ~100 bytes per message × N messages. A channel
with 100K messages ≈ 10MB index — acceptable for workspace lifetimes.

## Open Decisions

### OD-1: Multi-Instance Isolation — tag vs channel vs scoped-channel [RESOLVED → A]

**决策：方案 A（--tag 实例隔离）作为 v1 默认路径。方案 C（coordinator）作为后续可选增强，不在 v1 实现。**

**理由：** 设计的核心价值之一是"实例级强隔离 + 生命周期简单"，A 正好匹配，复杂度最低、故障域最清晰。
B（channel=instance）会把 scope 复杂度渗透到几乎所有 store/tool 语义里，代价太高。
若需要跨实例编排，走 C 的 coordinator 路径，不改实例边界语义。

同一个 workflow 需要跑多个实例（如同时 review PR-123 和 PR-456）。三种方案：

#### 方案 A：Instance Tag（moniro 方式，当前设计）

每个实例是完全独立的 workspace 进程。

```
aw run review.yaml --tag pr-123  → /tmp/aw-review-pr-123/ (独立进程)
aw run review.yaml --tag pr-456  → /tmp/aw-review-pr-456/ (独立进程)
```

**模型：** 1 tag = 1 workspace 进程 = 完全隔离（channels, inbox, documents, resources 全部独立）

```
┌─ workspace (tag=pr-123) ──┐    ┌─ workspace (tag=pr-456) ──┐
│  #general  #code-review   │    │  #general  #code-review   │
│  designer ←→ reviewer     │    │  designer ←→ reviewer     │
│  documents, resources     │    │  documents, resources     │
└───────────────────────────┘    └───────────────────────────┘
         完全隔离，互不感知
```

**优点：**
- 最简单 — 隔离靠文件系统目录，零额外抽象
- 故障隔离 — 一个实例挂了不影响其他
- Agent 身份清晰 — 每个实例有自己的 "designer"，独立 context window
- 生命周期简单 — 关掉一个实例 = kill 一个进程

**缺点：**
- 跨实例协调不可能 — pr-123 的 agent 无法感知 pr-456 的存在
- 资源重复 — 每个实例独立加载模型、启动 MCP server
- 无法共享知识 — 团队规范、代码风格等每个实例各存一份
- 需要外部机制（supervisor workspace + IPC）才能做跨实例编排

---

#### 方案 B：Channel 替代 Tag（channel = instance boundary）

一个 workspace 进程，每个 "实例" 是一个 channel。Context 分为 workspace-level 和 channel-level。

```
aw run review.yaml --instances pr-123,pr-456
# 一个 workspace 进程
# 自动创建 #pr-123, #pr-456 channels
```

**模型：** 1 workspace + N channels。Workspace-level context 共享，channel-level context 隔离。

```
┌─ workspace ──────────────────────────────────────┐
│                                                   │
│  workspace-level (shared):                        │
│    team roster, code standards, shared memory      │
│                                                   │
│  ┌─ #pr-123 ──────────┐  ┌─ #pr-456 ──────────┐ │
│  │ messages            │  │ messages            │ │
│  │ channel documents   │  │ channel documents   │ │
│  │ channel resources   │  │ channel resources   │ │
│  └────────────────────┘  └────────────────────┘ │
│                                                   │
│  designer (joins #pr-123)                         │
│  reviewer (joins #pr-456)                         │
│  supervisor (joins both)    ← 跨实例协调          │
└──────────────────────────────────────────────────┘
```

**优点：**
- 跨实例协调原生支持 — supervisor 加入多个 channel 即可
- 共享知识不重复 — workspace-level documents 所有 channel 可见
- 资源效率 — 一个进程、一个 MCP server
- 概念更少 — channel 统一了"话题"和"实例"两个概念

**缺点：**
- **Agent 身份问题** — "designer" 是一个 agent 还是多个？
  - 如果一个 agent 加入多个 channel → LLM context window 是单线程的，无法同时思考两个 PR，context 互相污染
  - 如果每个 channel 独立启一个 agent loop → 本质上就是方案 A 换了个名字，但更复杂
- **Store 双层化** — 每个 store 操作都要区分 scope：
  - `team_doc_read("spec.md")` → workspace-level 还是 channel-level？
  - `resource_create(content)` → 归哪个 channel？
  - `my_status_set("busy")` → 在哪个 channel 里 busy？
  - 这是 pervasive complexity，渗透到每个 context 操作
- **生命周期模糊** — "关掉 pr-123 实例" = 删 channel？agent 还在跑。channel-scoped 资源怎么 GC？
- **故障不隔离** — 共享进程，一个 channel 出问题可能影响所有

---

#### 方案 C：Scoped Channel（混合方案）

保留 --tag 做进程级隔离，但允许 workspace 内 channel 携带 scope metadata。
跨实例协调通过独立的 "coordinator workspace" 实现。

```
# 独立实例（进程隔离）
aw run review.yaml --tag pr-123
aw run review.yaml --tag pr-456

# 独立的协调器 workspace，通过文件系统读取各实例状态
aw run coordinator.yaml --watch /tmp/aw-review-*/
```

**模型：** Tag 做隔离 + 外部协调层做跨实例感知。

```
┌─ coordinator workspace ────────────┐
│  supervisor agent                   │
│  reads: /tmp/aw-review-*/status    │
│  can send messages to instances     │
└─────────────────────────────────────┘
        │ file watch / API
┌───────▼───────┐  ┌────────────────┐
│ tag=pr-123    │  │ tag=pr-456     │
│ (isolated)    │  │ (isolated)     │
└───────────────┘  └────────────────┘
```

**优点：**
- 保留方案 A 的简单性和隔离性
- 跨实例协调可选（不需要时零开销）
- 不需要 store 双层化
- 协调器本身也是一个 workspace，复用全部基础设施

**缺点：**
- 跨实例协调是"外挂"的，不如方案 B 自然
- 协调器和实例之间的通信需要额外协议（文件、HTTP、IPC）
- 对简单场景（"只是想让 supervisor 看看两个 PR"）过于重型

---

#### 决策维度

| 维度 | 方案 A (tag) | 方案 B (channel=instance) | 方案 C (tag+coordinator) |
|------|-------------|--------------------------|--------------------------|
| 实现复杂度 | 低 | 高（store 双层化） | 中（需要协调协议） |
| 隔离性 | 强（进程级） | 弱（共享进程） | 强 |
| 跨实例协调 | 不支持 | 原生 | 可选外挂 |
| Agent 身份 | 清晰（1:1） | 模糊（1:N?） | 清晰 |
| 资源效率 | 低（N 个进程） | 高（1 个进程） | 低 |
| 概念数量 | tag + channel | channel only | tag + channel + coordinator |
| 生命周期管理 | 简单 | 复杂 | 简单 |

**已决定 → A。** 若需跨实例编排，走 C 的 coordinator 路径（future enhancement）。

#### Appendix: Coordinator Protocol Draft (non-v1)

最小协议草案，防止后续实现分叉。标记为 non-v1，仅做方向约束。

**Instance discovery:**
```
# 每个 workspace 实例在 contextDir 下暴露 instance.json
{
  "workflowName": "review",
  "tag": "pr-123",
  "contextDir": "/tmp/aw-review-pr-123",
  "pid": 12345,
  "startedAt": "2026-03-09T10:00:00Z",
  "status": "running",         // running | stopped | crashed
  "mcpEndpoint": "http://localhost:3001/mcp"  // optional
}

# Coordinator 通过 glob /tmp/aw-review-*/instance.json 发现实例
# 或通过 daemon API: GET /api/instances?workflow=review
```

**Message envelope (coordinator → instance):**
```ts
interface CoordinatorMessage {
  id: string;              // nanoid, 幂等键
  from: "coordinator";
  targetTag: string;       // which instance
  targetChannel: string;   // which channel within instance
  content: string;
  idempotencyKey: string;  // = id, 重复投递不产生副作用
}
```

**Delivery:** Coordinator appends to target instance's channel JSONL directly
(file-based), or POST to instance's MCP endpoint (HTTP-based). File-based is
simpler and sufficient for single-machine; HTTP-based needed for distributed.

**Ack/retry:**
- Coordinator 维护 sent log: `{ messageId, targetTag, sentAt, acked: boolean }`
- Instance 处理后通过 StatusStore 暴露 ack（或 coordinator 轮询 channel 看到回复）
- Retry: 指数退避，最多 3 次，基于 idempotencyKey 去重

**Non-goals for coordinator protocol:**
- 不做分布式事务
- 不保证跨实例消息顺序
- 不做实例健康检查（依赖 OS 进程状态）

---

### OD-2: Inbox — independent queue vs cursor-based filtered view [RESOLVED → A]

**决策：方案 A（独立 inbox queue），配合三条工程约束：**
1. Channel message 不可变（append-only，见 Invariants #1）
2. Inbox 保存 messageId + state，不复制正文（见 Invariants #4）
3. defer/ack 的状态机和 GC 规则已明确（见 Invariants #6，Inbox 节的 GC rules）

**理由：** 已引入三层优先级和 cooperative preemption，意味着 agent 需要"按任务价值动态调度"。
Cursor 模型天然是顺序化的，会和这个目标冲突。独立 inbox 提供 selective ack / defer / peek all，
和调度系统天然配套。通过存引用而非正文副本，消除了数据冗余和一致性风险。

Agent 从 channel 收到消息后，如何管理待处理队列？

#### 方案 A：独立 inbox queue（当前设计）

Channel 消息触发 copy 到 agent 独立的 inbox 队列。Agent 可以 peek all、selective ack、defer。

```
Channel: [msg1, msg2, msg3, msg4, msg5]
                ↓ filter (@mentions me)
Agent inbox: [msg2, msg4]  ← 独立队列，可以先处理 msg4 再处理 msg2
```

**优点：**
- 灵活 — agent 自主决定处理顺序
- Selective ack — 跳过复杂任务先处理简单确认
- Defer — "现在不处理，稍后再看"

**缺点：**
- 数据冗余 — 消息在 channel 和 inbox 中各存一份
- 一致性风险 — channel 消息被修改/删除后 inbox 副本怎么办？（虽然 channel 是 append-only 的，但仍是两份数据）
- 实现复杂度 — inbox 是独立的 JSONL 文件，需要自己的写入/读取/GC 逻辑

#### 方案 B：Cursor-based filtered view（moniro 方式）

Inbox 不是独立存储，是 channel 的 filtered view + cursor。

```
Channel: [msg1, msg2, msg3, msg4, msg5]
                    ↑ cursor (已处理到 msg2)
Agent sees: [msg3, msg4, msg5] filtered by @mention
```

**优点：**
- 单一数据源 — channel 是唯一真相，零冗余
- 实现简单 — 只需维护一个 cursor position
- 一致性保证 — 不存在两份数据不同步的问题

**缺点：**
- 严格顺序 — 不能跳过 msg3 先处理 msg5
- 无法 defer — cursor 只能前进不能后退
- 阻塞 — 一条复杂消息堵住后面所有简单消息

#### 方案 C：Cursor + skip list

Cursor-based，但额外维护一个 skip set。

```
Channel: [msg1, msg2, msg3, msg4, msg5]
                    ↑ cursor=msg2
Skip set: {msg3}   ← 标记为跳过，稍后回来
Agent sees: [msg4, msg5]，msg3 在 deferred 列表里
```

**优点：**
- 单一数据源（同 B）
- 支持 skip/defer（部分解决 B 的刚性问题）
- 实现比方案 A 简单（不需要独立 store）

**缺点：**
- 仍然不能自由排序（只能 skip，不能"先处理 msg5 再处理 msg4"）
- Skip set 需要持久化和 GC

**已决定 → A。** Inbox 存引用不存正文，状态机和 GC 规则见 Invariants 和 Inbox 节。

---

## Changes from v1 Design

Key changes from v1 design, informed by reviewing moniro/workspace:

- Flat channel list retained, now with explicit join/leave + per-channel JSONL
- Instance tag from moniro retained — `--tag` for multi-instance isolation of same workflow
- ~~No priority~~ → Three-lane InstructionQueue with cooperative preemption
- ~~SharedMemory KV~~ → DocumentStore + ResourceStore (more structured)
- ~~MessageBus + MentionRouter~~ → ChannelManager + InboxStore + MCP tools (simpler)
- ~~Connector abstraction~~ → ChannelBridge + ChannelAdapter (event-driven)
- ~~Monolithic Workspace class~~ → createWorkspace() + createWiredLoop() factory
- ~~Tool injection only~~ → MCP server (HTTP) as universal transport
