# ADR-0002: Workspace MCP Decoupling

- **Status:** Accepted
- **Date:** 2026-03-17

## Context

The current architecture tightly couples workspace and agent at the code level. Workspace directly imports agent/loop types, creates agent loops, and injects workspace tools via function calls (`createAgentTools()` → `loop.setTools(tools)`). This means:

1. Only agents built with `@agent-worker/agent` + `@agent-worker/loop` can participate in a workspace.
2. External tools (Claude Code, Cursor, custom MCP clients) cannot join an existing workspace.
3. The `@agent-worker/workspace` package depends on `@agent-worker/agent` and `@agent-worker/loop`, creating a circular conceptual dependency — workspace knows how to drive agents, agents know workspace tool schemas.

We want any MCP-capable client to connect to a workspace and collaborate with other agents, without changes to the config format or CLI.

## Decision

### Workspace becomes a standalone MCP server

Each workspace instance exposes an HTTP MCP server. Agents connect as MCP clients and discover tools dynamically. The config.yml format and CLI commands remain unchanged — only the internal wiring changes.

### Before / After

```
Before:
  config.yml → WorkspaceRegistry → createWorkspace() → createAgentTools() → loop.setTools(tools)
                                                         ↑ direct function call, compile-time coupling

After:
  config.yml → WorkspaceRegistry → createWorkspace() → workspace.startMcpServer()
                                                         ↑ MCP server (HTTP)
                                 → createAgentLoop()  → agent connects via MCP
                                                         ↑ MCP client
```

### Package dependency graph

```
Before:
  agent-worker → workspace → agent → loop → shared

After:
  agent-worker (orchestration — only package that knows all others)
  ├── workspace (MCP server, no agent/loop dependency)
  │   └── shared
  ├── agent (MCP client, no workspace dependency)
  │   ├── loop
  │   └── shared
  └── shared
```

**Core change: workspace and agent no longer depend on each other.**

### Package responsibilities

#### `@agent-worker/shared` — unchanged

Process-level utilities shared by all packages.

- EventBus — in-process event pub/sub
- JSONL utilities — file I/O
- CLI colors — terminal formatting

#### `@agent-worker/loop` — unchanged

Pure LLM execution abstraction. Does not know about agent or workspace.

- `AgentLoop` interface — `run()`, `cancel()`, `setTools()`, `setMcpConfig()`
- Implementations — `AiSdkLoop`, `ClaudeCodeLoop`, `CursorLoop`, `CodexLoop`, `MockLoop`
- Loop tools — `grep`, `web_fetch`, `web_search`, `web_browse`
- `ToolRelevanceEngine` — dynamic per-step tool filtering

#### `@agent-worker/workspace` — **pure collaboration infrastructure MCP server**

Provides channels, documents, inboxes, and message routing as an MCP server. Does not know what an "agent loop" is, does not import `@agent-worker/agent` or `@agent-worker/loop`.

Keeps:

- `Workspace` class — manages channels, stores, message routing
- All stores — `ChannelStore`, `InboxStore`, `DocumentStore`, `ResourceStore`, `StatusStore`, `TimelineStore`
- `CompositeContextProvider` — unified store access
- `ChannelBridge` — external adapters (Telegram, etc.)
- `InstructionQueue` — priority-based message routing
- Config loading — YAML parsing (workspace portion only)
- Secrets management

Adds:

- `startMcpServer(workspace, opts)` — starts HTTP MCP server exposing all workspace tools
- Agent registration via MCP — `agent_register` / `agent_unregister` tools, or implicit on connect/disconnect
- Prompt sections exposed as MCP prompts/resources (instead of direct function return)

Removes (moves to `agent-worker`):

- `WorkspaceAgentLoop` — polling/activation logic is orchestration, not infrastructure
- `createWiredLoop()` — orchestration
- `createAgentTools()` — replaced by MCP dynamic discovery
- All imports of `@agent-worker/agent` and `@agent-worker/loop`
- Model resolution (`resolveRuntime`, `detectAiSdkModel`) — agent configuration, not workspace concern

Exports after change:

```
workspace
├── Workspace, createWorkspace()
├── startMcpServer()                    — new
├── All stores (Channel, Inbox, Document, Resource, Status, Timeline)
├── CompositeContextProvider
├── ChannelBridge
├── InstructionQueue
├── Config loading (loadWorkspaceDef, toWorkspaceConfig)
├── Secrets (loadSecrets, saveSecret)
├── Prompt sections (as data, for MCP prompts/resources)
└── WORKSPACE_TOOL_DEFS (schema metadata)
```

#### `@agent-worker/agent` — **autonomous agent, connects to external world via MCP**

Manages agent subsystems and loop execution. Connects to workspace(s) as an MCP client.

Keeps:

- `Agent` class — state machine + subsystem orchestration
- All subsystems — `Inbox`, `TodoManager`, `NotesStorage`, `MemoryManager`, `ReminderManager`, `SendGuard`, `ContextEngine`, `RunCoordinator`
- Built-in tools — `agent_todo`, `agent_notes`, `agent_reminder`, `agent_memory`
- `LoopWiring` — injects tools into loop (directTools / prepareStep / MCP)
- `AgentMcpServer` — exposes agent built-in tools to CLI loops

Changes:

- `agent_inbox` and `agent_send` removed from built-in tools — these are now workspace MCP tools (`my_inbox`, `channel_send`)
- `LoopWiring` merges two tool sources: agent built-in tools + workspace MCP tools (discovered dynamically)

Adds:

- `WorkspaceClient` — MCP client that connects to a workspace MCP server, discovers tools, manages connection lifecycle

Exports after change:

```
agent
├── Agent, AgentConfig, AgentState
├── Subsystems (Inbox, TodoManager, NotesStorage, MemoryManager, etc.)
├── RunCoordinator
├── Built-in tools (agent_todo, agent_notes, agent_reminder, agent_memory)
├── LoopWiring, AgentMcpServer
├── WorkspaceClient                     — new (MCP client for workspace)
└── createToolHandlers, mergeTools
```

#### `agent-worker` (daemon + CLI) — **orchestrator, only package that knows all others**

Reads config.yml, starts workspace MCP servers, creates agent loops, connects agents to workspaces, manages lifecycle.

Keeps:

- `Daemon` — HTTP server, event bus
- `WorkspaceRegistry` — workspace lifecycle management
- `AgentRegistry` — agent lifecycle management
- `ManagedWorkspace`, `ManagedAgent` — lifecycle wrappers
- Loop factory — `RuntimeConfig` → loop instance
- CLI commands — `aw run`, `aw send`, `aw status`, etc.
- `AwClient` — HTTP client for daemon API

Absorbs (from workspace):

- `WorkspaceAgentLoop` logic — polling, prompt assembly, instruction dispatch
- `createWiredLoop()` equivalent — now orchestrated here
- Model/runtime resolution — resolves agent config to concrete loop instances

Orchestration flow:

```
1. Parse config.yml (agents + workspace definition)
2. createWorkspace() → Workspace instance
3. workspace.startMcpServer() → MCP server URL
4. For each agent in config:
   a. Create loop (via loop factory)
   b. Create Agent instance
   c. Agent connects to workspace MCP server
   d. LoopWiring merges agent tools + workspace tools → inject into loop
5. Start polling / activation loop (moved from WorkspaceAgentLoop)
6. Send kickoff message
```

### MCP workspace tools

The workspace MCP server exposes these tools (unchanged from current tool set):

```
Channel tools:
  channel_send, channel_read, channel_list, channel_join, channel_leave

Inbox tools (agent-scoped, identified by MCP session):
  my_inbox, my_inbox_ack, my_inbox_defer, no_action, my_status_set

Team tools:
  team_members, team_doc_read, team_doc_write, team_doc_append, team_doc_list, team_doc_create

Resource tools:
  resource_create, resource_read
```

Agent identity is established on MCP connection (via session metadata or an `agent_register` tool call).

### External agent access

After a workspace MCP server is running, any MCP client can connect:

```bash
# Claude Code connects to a running workspace
claude mcp add my-workspace http://localhost:<port>/mcp

# Now Claude Code has channel_send, my_inbox, etc. as tools
```

The daemon exposes workspace MCP endpoints at:

```
http://localhost:<daemon-port>/workspace/<name>/mcp
```

### Config format — unchanged

```yaml
name: my-team
agents:
  designer:
    model: claude-sonnet-4-5
    instructions: "..."
  coder:
    model: claude-sonnet-4-5
    instructions: "..."
channels:
  - general
  - design
connections:
  - type: telegram
    token: ${TELEGRAM_BOT_TOKEN}
kickoff: "开始工作"
```

The daemon interprets this the same way — it just wires things differently internally.

### CLI — unchanged

```bash
aw run config.yml                    # one-shot task
aw create config.yml                 # long-running service
aw send @workspace general "hello"   # send message
aw status                            # check status
```

## Consequences

### Benefits

- **Any MCP client can collaborate** — Claude Code, Cursor, custom agents, non-TypeScript implementations
- **Clean dependency graph** — workspace and agent are independent, only the orchestrator knows both
- **Testable in isolation** — workspace MCP server can be tested without agent/loop; agent can be tested with a mock MCP server
- **Future flexibility** — workspace could run as a separate process, remote service, or shared across multiple daemon instances

### Trade-offs

- **MCP overhead** — HTTP round-trips instead of in-process function calls. Acceptable for the message frequencies we deal with (not hot-path).
- **Agent identity** — Need a convention for how agents identify themselves on MCP connect (session metadata or explicit registration tool).
- **Prompt assembly** — Currently workspace assembles the full prompt (soul + context sections). After decoupling, prompt sections are exposed as MCP resources/prompts; the orchestrator or agent assembles them. This is more flexible but slightly more complex.

### Migration path

1. Add `startMcpServer()` to workspace — expose existing tools via HTTP MCP
2. Add `WorkspaceClient` to agent — MCP client for workspace connection
3. Move `WorkspaceAgentLoop` logic to agent-worker orchestrator
4. Remove workspace → agent/loop dependency
5. Update LoopWiring to merge agent tools + workspace MCP tools
6. Verify all existing tests pass with new wiring
7. Add integration test: external MCP client connects to workspace

Steps 1-2 can be done in parallel. Steps 3-4 are the breaking change. Steps 5-7 validate.
