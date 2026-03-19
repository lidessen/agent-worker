---
name: workspace-debug
description: "Monitor, inspect, and interact with the agent workspace using the workspace-debug MCP tools. Use this skill when the user wants to check agent status, read workspace channels, send messages to agents, view event logs, inspect the instruction queue, or test how agents behave in the workspace. Trigger on phrases like 'check agents', 'workspace status', 'send message to agents', 'what are agents doing', 'test agent behavior', 'debug workspace', 'monitor agents', 'read channel', 'check queue'."
---

# Workspace Debug

The `workspace-debug` MCP endpoint is a **super-agent** — it has all 18 regular agent collaboration tools plus 5 debug-only inspection tools (23 total). This means you can both observe and participate in the workspace.

## Prerequisites

The daemon must be running for the MCP tools to work:

```bash
aw daemon start
```

The MCP endpoint is at `http://127.0.0.1:42424/mcp/_debug` and is configured in `.mcp.json`.

If tools return connection errors, the daemon likely isn't running. Start it first.

## Tool Reference

### Debug Tools (inspection)

These tools provide read-only visibility into the workspace state:

| Tool              | Purpose                                                      | Key Args                                 |
| ----------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `agents`          | List all agents with status, task, and channel subscriptions | —                                        |
| `agent_activity`  | Recent timeline events for one agent                         | `agent`, `limit?` (default 20)           |
| `activity_detail` | Full JSONL trace of a specific run                           | `agent`, `run_id`                        |
| `events`          | Workspace events across all agents                           | `agent?`, `kind?`, `limit?` (default 30) |
| `queue`           | Pending instructions grouped by priority                     | —                                        |
| `workspace_info`  | Workspace config: name, channels, agents, storage            | —                                        |
| `inbox_peek`      | Inspect any agent's inbox (not just your own)                | `agent`                                  |

### Agent Collaboration Tools

These are the same tools every agent has — you're acting as the `_debug` agent identity:

**Channels** — the shared communication layer:

- `channel_list` — see available channels and your subscriptions
- `channel_read` — read recent messages from a channel (`channel`, `limit?`)
- `channel_send` — send a message to a channel (`channel`, `content`, `to?` for DM)
- `channel_join` / `channel_leave` — manage channel membership

**Inbox** — @-mentions and notifications directed at you:

- `my_inbox` — check unread inbox items
- `my_inbox_ack` — acknowledge an inbox item (`id`)
- `my_inbox_defer` — defer an inbox item for later (`id`)
- `no_action` — explicitly skip an instruction (`reason`)

**Team** — shared state and documents:

- `team_members` — list all agents and their status
- `team_doc_create` / `team_doc_write` / `team_doc_append` / `team_doc_read` / `team_doc_list` — shared documents
- `my_status_set` — set your own status (`status`, `task?`)

**Resources** — large content storage:

- `resource_create` — store large content and get an ID (`content`)
- `resource_read` — retrieve content by ID (`id`)

## Common Workflows

### 1. Check what's happening

Start with a quick overview:

```
agents          → who's online, what are they doing?
events          → what happened recently?
queue           → anything waiting to be processed?
channel_read    → what are agents talking about?
```

### 2. Test agent responsiveness

Send a message mentioning an agent and watch if they respond:

```
channel_send(channel: "general", content: "@deepseek 简单回复一个ok就行")
```

Then check:

```
channel_read(channel: "general")     → did they respond?
agent_activity(agent: "deepseek")    → what did they do?
```

### 3. Broadcast to all agents

Send a message to a shared channel without @-mentioning anyone — all subscribed agents will see it:

```
channel_send(channel: "general", content: "All agents please report status")
```

### 4. Direct message a specific agent

Use the `to` parameter for a DM-style message that also goes to inbox:

```
channel_send(channel: "general", content: "Need you to review this", to: "claude-code")
```

### 5. Investigate an agent's behavior

Drill down into what a specific agent has been doing:

```
agent_activity(agent: "cursor", limit: 50)   → timeline of events
events(agent: "cursor", kind: "tool_call")   → just their tool calls
activity_detail(agent: "cursor", run_id: "...") → full trace of a run
```

### 6. Coordinate via shared documents

Create a shared document that all agents can reference:

```
team_doc_create(name: "review-plan", content: "Step 1: ...")
channel_send(channel: "general", content: "See team doc 'review-plan' for the plan")
```

## Tips

- The debug endpoint acts as the `_debug` agent — messages you send show as `@_debug`
- Use `events` with filters to narrow down: `events(agent: "alice", kind: "system", limit: 5)`
- Event kinds: `message`, `tool_call`, `system`, `output`, `debug`
- Agent statuses: `idle`, `running`, `paused`, `stopped`
- If `activity_detail` says "storageDir not configured", the daemon wasn't started with a data directory that stores run logs
- Channel messages over 1200 chars should use `resource_create` first, then reference the resource ID
