# @agent-worker/workspace

Multi-agent workspace: single shared channel, @mention routing, priority inbox, resource system, and external platform bridges.

> Informed by moniro/workspace — battle-tested patterns adapted for agent-worker.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Workspace                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                     Channel (JSONL)                         │  │
│  │  append-only log — single source of truth for all messages  │  │
│  └──────┬──────────────────────────────┬──────────────────────┘  │
│         │ filtered view                │ emit("message")         │
│  ┌──────▼──────────────────┐    ┌──────▼──────────────────┐     │
│  │   InboxStore            │    │   ChannelBridge          │     │
│  │   per-agent cursors     │    │   anti-loop protection   │     │
│  │   (seen / ack)          │    │                          │     │
│  │   priority:             │    │  ┌────────┐ ┌────────┐  │     │
│  │   immediate > normal    │    │  │Telegram│ │Webhook │  │     │
│  │   > background          │    │  └────────┘ └────────┘  │     │
│  └──────┬──────────────────┘    └─────────────────────────┘     │
│         │ dequeue                                                │
│  ┌──────▼──────────────────┐    ┌─────────────────────────┐     │
│  │   InstructionQueue      │    │   ContextProvider        │     │
│  │   3-lane priority       │    │   (composite)            │     │
│  │   immediate│normal│bg   │    │                          │     │
│  └──────┬──────────────────┘    │  Channel ─ Inbox         │     │
│         │                       │  Document ─ Resource      │     │
│  ┌──────▼──────┐ ┌──────┐     │  Status ─ Timeline        │     │
│  │ AgentLoop A │ │Loop B│     └─────────────────────────┘     │
│  └─────────────┘ └──────┘                                       │
│                                                                  │
│  ┌─────────────────────────┐    ┌─────────────────────────┐     │
│  │   MCP Server (HTTP)     │    │   EventLog               │     │
│  │   workspace tools for   │    │   unified event entry    │     │
│  │   any backend           │    │   point                  │     │
│  └─────────────────────────┘    └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Workspace

Top-level container. Owns all agents, shared context, and optional platform bridges.
Handles lifecycle (`init` / `stop`) and wires everything together.

Two composable primitives (factory pattern):
1. `createWorkspace()` — context + MCP + event log (the shared infrastructure)
2. `createWiredLoop()` — backend + workspace dir + loop (per agent)

### Channel (Single, Append-only)

**One channel, not many.** All messages go into a single append-only JSONL log.
Routing is done via `@mention` and DM (`to` field), not via channel namespaces.

This is a deliberate simplification over the multi-channel design — moniro proved
that a single channel + @mention routing covers all real-world coordination patterns
while being drastically simpler to implement and reason about.

**Message structure:**

```ts
interface Message {
  id: string;              // nanoid
  timestamp: string;       // ISO
  from: string;            // agent name or "system"
  content: string;
  mentions: string[];      // extracted @mentions
  to?: string;             // DM recipient (private to sender + recipient)
  kind?: EventKind;        // "message" | "tool_call" | "system" | "output" | "debug"
  toolCall?: ToolCallData; // metadata when kind="tool_call"
}
```

**Visibility rules:**
- Public messages: visible to all agents
- DMs (`to` field): visible only to sender and recipient
- System/debug/output: filtered out of agent inbox (operational noise)

**SmartSend:** Messages longer than ~1200 chars are automatically stored as a
Resource, with only a short reference posted to the channel. Prevents channel bloat.

### Inbox (Filtered View of Channel)

The inbox is **not a separate store**. It's a filtered projection of the channel
with per-agent cursors.

**How it works:**
1. Channel has all messages (append-only)
2. InboxStore filters: `mentions.includes(agent) || to === agent`
3. Excludes: system, debug, output, tool_call, messages from self
4. Two cursor types per agent:
   - `seen` — loop picked it up, now processing
   - `ack` — successfully processed, won't appear again

**Run epoch:** On workspace init, `markRunStart()` records the current channel
position. Inbox ignores all messages before this point — prevents stale messages
from previous runs triggering work.

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
| `ChannelStore` | Append-only JSONL message log with EventEmitter | JSONL file      |
| `InboxStore`   | Filtered view of channel + per-agent cursors    | JSON cursor file|
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
| **Channel**   | `channel_send`, `channel_read`                     |
| **Inbox**     | `my_inbox`, `my_inbox_ack`, `my_status_set`        |
| **Team**      | `team_members`, `team_doc_read/write/append/list/create` |
| **Resource**  | `resource_create`, `resource_read`                 |
| **Proposal**  | `team_proposal_create`, `team_vote`, `team_proposal_status/cancel` |

**Agent identity:** Extracted from MCP session. Each agent gets its own session
with the same MCP server — the server knows who's calling.

**Direct tool injection** is also supported for SDK loops (directTools capability).

### ChannelBridge (External Platforms)

Event-driven layer over ChannelStore for external platform integration.

```
External Platform
    │
    ▼
ChannelAdapter.start(bridge)     ← adapter subscribes to bridge
    │
    ▼
ChannelBridge.send(from, content) ← injects external msg into channel
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
│   │   │   ├── channel.ts       # Append-only JSONL + EventEmitter
│   │   │   ├── inbox.ts         # Filtered channel view + cursors
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

// 4. Send kickoff
await workspace.contextProvider.smartSend("user", "@designer Please review this PR");

// 5. Shutdown
await designerLoop.stop();
await reviewerLoop.stop();
await workspace.shutdown();
```

## Design Decisions

1. **Single channel, not many** — all messages flow through one append-only log.
   Routing is via @mention and DM, not channel namespaces. moniro proved this
   covers all real coordination patterns while being drastically simpler. Multiple
   channels add complexity (which agent is in which channel? cross-channel awareness?)
   without meaningful benefit.

2. **Inbox is a filtered view** — not a separate store. The channel is the single
   source of truth. Inbox is just "channel messages that @mention me, filtered by
   my cursor position." This eliminates data duplication and sync issues.

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

Key changes based on reviewing moniro/workspace:

- ~~Multi-channel~~ → Single channel + @mention + DM
- ~~Independent inbox store~~ → Inbox as filtered view of channel
- ~~No priority~~ → Three-lane InstructionQueue with cooperative preemption
- ~~SharedMemory KV~~ → DocumentStore + ResourceStore (more structured)
- ~~MessageBus + MentionRouter~~ → Channel + InboxStore + MCP tools (simpler)
- ~~Connector abstraction~~ → ChannelBridge + ChannelAdapter (event-driven)
- ~~Monolithic Workspace class~~ → createWorkspace() + createWiredLoop() factory
- ~~Tool injection only~~ → MCP server (HTTP) as universal transport
