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
subscriptions, a copy is enqueued into their inbox.

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
3. If yes, enqueues a copy into agent X's inbox with priority classification
4. Agent loop calls `my_inbox` to peek pending, `my_inbox_ack(id)` to acknowledge

**Inbox entry lifecycle:**
```
pending → seen (loop picked it up) → acked (processed, removed)
                                   → deferred (explicitly postponed, returns to pending)
```

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

### ContextProvider (Composite)

The ContextProvider interface is satisfied by composing independent stores:

| Store          | Concern                                        | Storage         |
|----------------|------------------------------------------------|-----------------|
| `ChannelStore` | Per-channel append-only JSONL + EventEmitter    | JSONL file/ch   |
| `InboxStore`   | Independent per-agent message queue              | JSONL file/agent|
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

EventLog writes through ContextProvider so events are persisted alongside
channel messages. Agents never write to it directly.

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

## Changes from v1 Design

Key changes from v1 design, informed by reviewing moniro/workspace:

- Flat channel list retained, now with explicit join/leave + per-channel JSONL
- Instance tag from moniro retained — `--tag` for multi-instance isolation of same workflow
- Independent inbox (not moniro's cursor-based filtered view) — selective ack, defer, peek
- ~~No priority~~ → Three-lane InstructionQueue with cooperative preemption
- ~~SharedMemory KV~~ → DocumentStore + ResourceStore (more structured)
- ~~MessageBus + MentionRouter~~ → ChannelManager + InboxStore + MCP tools (simpler)
- ~~Connector abstraction~~ → ChannelBridge + ChannelAdapter (event-driven)
- ~~Monolithic Workspace class~~ → createWorkspace() + createWiredLoop() factory
- ~~Tool injection only~~ → MCP server (HTTP) as universal transport
