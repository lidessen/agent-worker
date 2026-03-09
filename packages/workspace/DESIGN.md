# @agent-worker/workspace

Multi-agent workspace: message routing, channels, timeline, shared memory, and external connectors.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Workspace                              │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                     Timeline                              ││
│  │  (global append-only event log, cross-channel)            ││
│  └──────────────────────────┬───────────────────────────────┘│
│                              │ records                        │
│  ┌──────────────────────────┴───────────────────────────────┐│
│  │                    MessageBus                             ││
│  │  (route messages by @mention / #channel / @connector:)    ││
│  └──┬──────────┬──────────┬──────────────┬──────────────────┘│
│     │          │          │              │                    │
│  ┌──┴───┐  ┌──┴───┐  ┌──┴───┐   ┌──────┴───────┐           │
│  │Agent │  │Agent │  │Agent │   │  Connector    │           │
│  │  A   │  │  B   │  │  C   │   │  Manager      │           │
│  └──────┘  └──────┘  └──────┘   │ ┌───────────┐ │           │
│                                  │ │ Telegram  │ │           │
│  ┌──────────────────────────┐   │ │ Slack     │ │           │
│  │   ChannelManager         │   │ │ Webhook   │ │           │
│  │   #general  #design ...  │   │ │ ...       │ │           │
│  └──────────────────────────┘   │ └───────────┘ │           │
│                                  └───────────────┘           │
│  ┌──────────────────────────┐                                │
│  │     SharedMemory          │                                │
│  └──────────────────────────┘                                │
└──────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Workspace

Top-level container. Owns all agents, channels, timeline, shared memory, and connectors.
Handles lifecycle (`init` / `stop`) and wires everything together.

### MessageBus

Central message router. All messages flow through it, regardless of origin (agent send, connector inbound, direct push).

**Routing rules (MentionRouter):**

| Target syntax                  | Delivery                                     |
|--------------------------------|----------------------------------------------|
| `@agent-id`                    | Direct to agent inbox                        |
| `@role:xxx`                    | All agents with that role                    |
| `#channel-name`                | Broadcast to all channel members             |
| `@all`                         | Broadcast to every agent in workspace        |
| `@connector:platform:userId`   | Outbound via ConnectorManager                |

### Channels

Flat list of named channels. No sub-channels — keep it simple.

- Each workspace has a configurable `defaultChannel` (typically `"general"`)
- Agents auto-join the default channel on registration
- Agents can join/leave channels at any time via tools
- Channel history is queryable by members

### Timeline

Global, append-only event log. Workspace-unique, cross-channel.
All notable events are automatically recorded — agents don't write to it directly.

**Event types:**

| Type              | Description                            |
|-------------------|----------------------------------------|
| `message`         | Message delivered between agents       |
| `agent:state`     | Agent state change (idle→processing…)  |
| `agent:run:start` | Agent started an LLM run               |
| `agent:run:end`   | Agent finished an LLM run              |
| `agent:tool`      | Agent invoked a tool                   |
| `channel:join`    | Agent joined a channel                 |
| `channel:leave`   | Agent left a channel                   |
| `connector:in`    | External message entered workspace     |
| `connector:out`   | Workspace message sent to external     |
| `memory:write`    | Shared memory written                  |
| `error`           | Error event                            |

**How it gets fed:** Workspace wires event listeners on agents and connectors during `init()`.
Agents never write to timeline directly — it's passive and automatic.

**Agents can query it** via `workspace_timeline` tool to gain cross-channel awareness.

**Storage is pluggable:** Default in-memory with rolling window. Can swap to file/DB backend.

### SharedMemory

Key-value store shared across all agents. Any agent can read/write via tools.
Useful for sharing artifacts, decisions, or coordination state.

### Connectors

Bridge between workspace and external platforms (Telegram, Slack, webhooks, etc).
Connectors are **optional** — workspace works fine without them.

**Data flow:**

```
External → Connector.dispatch(InboundMessage)
         → ConnectorManager applies RouteRules
         → MessageBus.route()
         → Agent inbox or Channel broadcast
         → Agent processes, calls agent_send(@connector:telegram:user123, ...)
         → MentionRouter detects @connector: prefix
         → ConnectorManager.sendExternal()
         → Connector.send(OutboundMessage)
         → External
```

### Workspace Tools (injected into agents)

| Tool                     | Description                                  |
|--------------------------|----------------------------------------------|
| `workspace_members`      | List agents, roles, online status            |
| `workspace_channels`     | List/join/leave channels                     |
| `workspace_channel_history` | View channel message history              |
| `workspace_memory`       | Read/write shared memory                     |
| `workspace_timeline`     | Query global event log                       |
| `workspace_reply_external` | Reply to external user via connector       |

## File Structure

```
packages/workspace/
├── src/
│   ├── workspace.ts             # Main class, lifecycle, wiring
│   ├── message-bus.ts           # Message routing
│   ├── channel.ts               # Channel management
│   ├── mention-router.ts        # @mention / #channel / @connector: parsing
│   ├── timeline.ts              # Timeline implementation
│   ├── shared-memory.ts         # Shared key-value memory
│   ├── workspace-tools.ts       # Tool definitions for agents
│   ├── connector/
│   │   ├── types.ts             # Connector / ConnectorContext interfaces
│   │   ├── manager.ts           # ConnectorManager
│   │   ├── telegram.ts          # Telegram connector (example)
│   │   └── webhook.ts           # Generic webhook connector
│   ├── storage/
│   │   └── memory-timeline.ts   # In-memory timeline storage
│   ├── types.ts                 # All workspace-level type definitions
│   └── index.ts                 # Public API exports
├── test/
├── DESIGN.md
├── package.json
└── tsconfig.json
```

## Configuration

```ts
const workspace = new Workspace({
  agents: [
    { id: "designer", agent, role: "design" },
    { id: "reviewer", agent, role: "review" },
  ],
  channels: ["general", "design", "code-review"],
  defaultChannel: "general",
  connectors: [
    new TelegramConnector({ token: "..." }),
    new WebhookConnector({ id: "webhook", callbackUrl: "..." }),
  ],
  timeline: {
    maxEntries: 10_000,  // rolling window
  },
});

await workspace.init();
```

## Design Decisions

1. **Flat channels** — no sub-channels. A `defaultChannel` convention replaces the need for a "main" channel with special status. Simpler routing, no hierarchy ambiguity.

2. **Timeline is passive** — workspace auto-records events by wiring listeners. Agents query but never write. This keeps the event stream trustworthy.

3. **Connectors are opt-in** — pure multi-agent collaboration needs zero connector setup. External integrations are an additive layer.

4. **Unified routing** — agent-to-agent, agent-to-channel, and agent-to-external all flow through MessageBus → MentionRouter. One path, one set of rules.

5. **Tools over API** — agents interact with workspace via injected tools (`workspace_*`), not by importing workspace modules. This keeps agent code decoupled and works across all loop backends (SDK, CLI).
