# agent-worker: Unified CLI Design

## Overview

One CLI (`aw`), one daemon, one target syntax. The CLI is a pure HTTP client — all logic lives in the daemon.

```
 Interfaces                         Core
┌──────────┐ ┌──────────┐ ┌─────┐
│  aw CLI  │ │  Web UI  │ │ MCP │  ← all use AwClient (HTTP)
└────┬─────┘ └────┬─────┘ └──┬──┘
     │            │           │
     └──────┬─────┘───────┬───┘
            ▼             ▼
      ┌───────────────────────┐
      │  agent-worker daemon  │
      │  (Bun.serve HTTP)     │
      ├───────────────────────┤
      │ AgentRegistry         │
      │ WorkspaceRegistry     │
      │ EventBus / EventLog   │
      └───────────────────────┘
```

## Target Syntax

All commands that operate on a target use the same addressing scheme:

```
[agent] [@workspace[:tag]] [#channel]
```

At least one part is required.

| Input | Agent | Workspace (key) | Channel |
|-------|-------|-----------------|---------|
| `alice` | alice | global (implicit) | — |
| `alice@review` | alice | review | (default) |
| `alice@review:pr-42` | alice | review:pr-42 | (default) |
| `@review` | — | review | (default) |
| `@review:pr-42` | — | review:pr-42 | (default) |
| `@review#design` | — | review | design |
| `@review:pr-42#design` | — | review:pr-42 | design |
| `alice@review#design` | alice | review | design |

### Workspace key

A workspace key is `name` or `name:tag`. Tags disambiguate multiple instances of the same workspace definition.

- `aw start review.yaml` → key = `review`
- `aw start review.yaml --tag pr-42` → key = `review:pr-42`
- `aw start review.yaml --tag pr-99` → key = `review:pr-99`

If a bare `@review` is used when multiple tagged instances exist, the daemon returns a 409 Conflict listing the available instances.

### Rules

- `#` mid-word is not a shell comment — no quoting needed for `@review#design`
- Standalone `#channel` requires quotes — always use `@workspace#channel` instead
- When workspace has a `default_channel`, `@review` routes to it
- `:` in workspace part separates name from tag

### Parsing

```typescript
interface Target {
  agent?: string;
  workspace?: string;   // "review" or "review:pr-42"
  channel?: string;
}

function parseTarget(raw: string): Target {
  // alice@review:pr-42#design → { agent: "alice", workspace: "review:pr-42", channel: "design" }
  const match = raw.match(/^([^@#]+)?(?:@([^#]+))?(?:#(.+))?$/);
  return {
    agent: match?.[1] || undefined,
    workspace: match?.[2] || undefined,
    channel: match?.[3] || undefined,
  };
}
```

## Global Workspace

The daemon has a **global default workspace** (key: `global`) that always exists. Standalone agents created via `aw create` live in this workspace.

Declarative workspaces (created via `aw start` / `aw run` from YAML) define their own agents inline — they **cannot** dynamically create new agents. However, they **can** reference agents from the global workspace by name.

The global workspace is addressable as `@global` in target syntax. When `@workspace` is omitted, it implicitly resolves to `@global`.

```
┌─────────────────────────────────────────────┐
│  Global Workspace (implicit, always exists)  │
│                                              │
│  alice ──────────────────────────┐           │
│  bob                             │ reference │
│  ...                             ▼           │
│              ┌──────────────────────────┐    │
│              │  @review:pr-42 (decl.)   │    │
│              │  agents: [reviewer, ci]  │    │
│              │  refs:   [alice]  ←──────│────│
│              └──────────────────────────┘    │
└─────────────────────────────────────────────┘
```

| Scope | Create agents | Reference global agents |
|-------|:------------:|:----------------------:|
| Global workspace | yes (`aw create`) | — |
| Declarative workspace | no (YAML-defined only) | yes |

When a bare agent name is used (e.g. `alice`), it resolves to the global workspace. When qualified with `@workspace` (e.g. `alice@review`), it resolves within that workspace.

**Name resolution rule:** workspace-local agents take priority over global references. A workspace cannot define a local agent with the same name as a global reference — the daemon rejects this at workspace creation time (400 Bad Request). This ensures all target resolution is unambiguous.

## Storage Model

All daemon state lives under a single data directory (`~/.agent-worker/` by default). Everything is scoped — global agents and workspace-scoped agents never mix, and each workspace is a self-contained directory.

```
~/.agent-worker/
  daemon.json                          # discovery file (pid, port, token)
  events.jsonl                         # global daemon event log

  agents/                              # ── global agents only ──
    alice/
      responses.jsonl                  # text output + send events
      events.jsonl                     # agent-level events (state, run, tool, thinking)

  workspaces/
    global/                            # implicit workspace for standalone agents
      channels/
        general.jsonl
      inbox/
        alice.jsonl

    review/                            # untagged declarative workspace
      agents/                          # ── workspace-scoped agents ──
        reviewer/
          responses.jsonl
          events.jsonl
      channels/
        general.jsonl                  # channel message log
        design.jsonl
      inbox/
        reviewer.jsonl                 # per-agent inbox
      timeline/
        reviewer.jsonl                 # per-agent event log

    review--pr-42/                     # tagged: ":" encoded as "--" on disk
      agents/
        reviewer/
          responses.jsonl
          events.jsonl
      channels/
        general.jsonl
      inbox/
        reviewer.jsonl
```

### What goes where

| Stream | Content | Written by |
|--------|---------|-----------|
| `agents/<name>/responses.jsonl` | text output, send events — **global agents only** | ManagedAgent event handler |
| `agents/<name>/events.jsonl` | state_change, run_start, run_end, tool_call_*, thinking, error — **global agents only** | ManagedAgent event handler |
| `workspaces/<key>/agents/<name>/responses.jsonl` | text output, send events — **workspace-scoped agents** | ManagedAgent event handler |
| `workspaces/<key>/agents/<name>/events.jsonl` | state_change, run_start, run_end, tool_call_*, thinking, error — **workspace-scoped agents** | ManagedAgent event handler |
| `workspaces/<key>/channels/<ch>.jsonl` | channel messages (from, content, ts) | Workspace channel store |
| `workspaces/<key>/inbox/<name>.jsonl` | per-agent inbox entries | Workspace inbox store |
| `workspaces/<key>/timeline/<name>.jsonl` | per-agent timeline events | Workspace timeline store |
| `events.jsonl` | everything (global, for daemon-level `/events`) | EventBus subscriber |

All files are append-only JSONL. Cursor = byte offset. Survives daemon restart (files persist, daemon re-reads on startup).

When a workspace YAML explicitly specifies `storage_dir`, that path is used instead of `workspaces/<key>/`. This allows workspaces to opt out of the daemon's directory tree (e.g. for project-local storage).

### Polling vs SSE

Each cursor-based endpoint has a corresponding SSE stream endpoint for real-time push:

| Polling (cursor) | SSE (stream) |
|-------------------|-------------|
| `GET /agents/:name/responses?cursor=N` | `GET /agents/:name/responses/stream` |
| `GET /agents/:name/events?cursor=N` | `GET /agents/:name/events/stream` |
| `GET /workspaces/:key/channels/:ch?cursor=N` | `GET /workspaces/:key/channels/:ch/stream` |
| `GET /workspaces/:key/events?cursor=N` | `GET /workspaces/:key/events/stream` |
| `GET /events?cursor=N` | `GET /events/stream` |

SSE endpoints return `text/event-stream`. Each event is a JSON-encoded line:

```
data: {"ts":1710000000,"type":"text","text":"Hello"}

data: {"ts":1710000001,"type":"run_end","durationMs":1200,"tokens":150}
```

Clients can pass `?cursor=N` to replay from a byte offset before switching to live push. Without `cursor`, only new events are streamed. CLI falls back to cursor polling if SSE connection fails.

## Runtime Configuration

### The problem

Different loop backends need different configuration beyond just `model`:

| Runtime | Needs |
|---------|-------|
| ai-sdk | provider + model ID, optional API key override |
| claude-code | `claude` binary path, model name (sonnet/opus/haiku) |
| codex | `codex` binary path, model name |
| cursor | `cursor` binary path, model name |
| mock | delay, response text (for testing) |

CLI runtimes also need execution context: `cwd`, `env` overrides, runner kind (host/sandbox).

### RuntimeConfig type

```typescript
/** Full runtime configuration for creating an agent via HTTP API. */
interface RuntimeConfig {
  type: "ai-sdk" | "claude-code" | "codex" | "cursor" | "mock";

  /** Model identifier. Meaning depends on type:
   *  - ai-sdk: "provider:model" (e.g. "anthropic:claude-sonnet-4-20250514")
   *  - claude-code: model name (e.g. "sonnet", "opus")
   *  - codex/cursor: model name
   *  - mock: ignored */
  model?: string;

  /** System instructions for the agent. */
  instructions?: string;

  /** Working directory for CLI-based runtimes. Default: daemon cwd. */
  cwd?: string;

  /** Environment variable overrides (e.g. API keys). */
  env?: Record<string, string>;

  /** Runner kind. Default: "host". */
  runner?: "host" | "sandbox";

  /** Mock-specific: response delay in ms. */
  mockDelay?: number;

  /** Mock-specific: fixed response text. */
  mockResponse?: string;
}
```

### HTTP Create Agent

```
POST /agents
body: {
  name: string;
  runtime: RuntimeConfig;
}
```

The daemon validates the config, creates the loop, and initializes the agent. If the runtime CLI is not found, returns 422 with a diagnostic message.

### CLI mapping

```bash
aw create alice \
  --runtime ai-sdk \
  --model anthropic:claude-sonnet-4-20250514 \
  --instructions "You are a code reviewer." \
  --cwd /path/to/repo
```

Maps directly to `POST /agents` with the corresponding `RuntimeConfig`.

## Workspace Send Semantics

The workspace `send` route (`POST /workspaces/:key/send`) resolves the target fields to a concrete action:

- Only `channel` → broadcast to channel, all subscribed agents see it.
- Only `agent` → direct inbox push, no channel involvement.
- Both `agent` and `channel` → post to channel AND push notification to agent's inbox.
- Neither → post to `default_channel`.

```bash
aw send alice "hello"                # → sendToAgent("alice", ...) — global workspace
aw send @review "hello"              # → channel: default_channel
aw send @review#design "hello"       # → channel: design
aw send alice@review "hello"         # → agent: alice (inbox)
aw send alice@review#design "hello"  # → channel: design + notify alice
```

## CLI Commands

### Daemon lifecycle

```bash
aw up [-p PORT]       # Start daemon (foreground)
aw down               # Stop daemon
aw status             # Daemon health + summary
```

### Resource management

```bash
aw create <name> [options]    # Create standalone agent
  --runtime <type>            #   ai-sdk | claude-code | codex | cursor | mock
  --model <provider:model>    #   e.g. anthropic:claude-sonnet-4-20250514
  --instructions <text>       #   system prompt
  --cwd <path>                #   working directory for CLI runtimes
  --env KEY=VALUE             #   env overrides (repeatable)
  --runner host|sandbox       #   execution environment

aw run <config.yaml>          # Run workspace as task (exits when done)
  --tag <tag>                 #   instance tag
  --var KEY=VALUE             #   template variables (repeatable)
  --wait <duration>           #   max wait time (default: 5m)

aw start <config.yaml>        # Start workspace (mode: service)
  --tag <tag>                 #   instance tag (e.g. pr-42)
  --var KEY=VALUE             #   template variables (repeatable)

aw ls                         # List all agents + workspaces
aw info <target>              # Details (alice / @review:pr-42 / alice@review)
aw rm <target>                # Remove agent or stop workspace
```

**`aw run` lifecycle:** `POST /workspaces` with `mode: "task"` → `GET /workspaces/:key/wait?timeout=<wait>` → daemon auto-removes workspace on completion. All logic is daemon-side; the CLI just creates then waits.

**`aw info` resolution:** For compound targets like `alice@review`, the CLI calls both `GET /agents/alice` and `GET /workspaces/review` and merges the results. This is presentation logic, not business logic — acceptable for the CLI layer.

### Messaging

```bash
aw send <target> "message" [+Ns "message2" ...]
  --from <name>               # sender name

aw read <target> [N]          # Read N messages from a stream (default: 1)
  --wait <duration>           # max total wait time, e.g. 30s, 5m (default: 60s)
  --json                      # one JSON object per line (JSONL)

```

`read` consumes N messages from a shared SSE connection, prints each as it arrives, then returns. The target determines which stream:

| Target | Stream |
|--------|--------|
| `alice` | All of alice's responses (`/agents/alice/responses/stream`) |
| `alice@review` | Alice's responses scoped to @review (`/agents/alice/responses/stream?workspace=review`) |
| `@review` | Default channel (`/workspaces/review/channels/<default>/stream`) |
| `@review#design` | Named channel (`/workspaces/review/channels/design/stream`) |

`--wait` caps the total wait time across all N messages.

Response entries include a `workspace` field indicating which workspace context triggered the run. `read alice` returns all responses; `read alice@review` filters to `workspace=review` only. This ensures workspace-scoped reads are isolated even when agents are shared.

### Inspection

```bash
aw state <target>             # Agent state, inbox, todos
aw peek <target>              # Read history (cursor=0 on existing endpoints)
aw log [<target>] [options]   # Event log (filtered by target if given)
  --follow, -f                # tail mode (SSE stream)
  --json                      # raw JSONL
```

`peek` is CLI sugar — it reads history from cursor=0 on existing endpoints:

| Target | API call |
|--------|----------|
| `alice` | `GET /agents/alice/responses?cursor=0` |
| `alice@review` | `GET /agents/alice/responses?cursor=0&workspace=review` |
| `@review` | `GET /workspaces/review/channels/<default>?cursor=0` |
| `@review#design` | `GET /workspaces/review/channels/design?cursor=0` |
| `alice@review#design` | `GET /workspaces/review/channels/design?cursor=0&agent=alice` |

### Shared documents (workspace)

```bash
aw doc ls [@workspace]           # List docs (default: @global)
aw doc read <name> [@workspace]
aw doc write <name> [@workspace] --content "..."
aw doc append <name> [@workspace] --content "..."
```

`@workspace` is optional — defaults to `@global` when omitted. Maps to `/workspaces/:key/docs/...` routes.

## HTTP API

All routes under daemon. CLI calls these via `AwClient`.

### Daemon

```
GET  /health                         → { status, pid, uptime, agents, workspaces }
POST /shutdown                       → { shutting_down: true }
GET  /events?cursor=N                → { entries: DaemonEvent[], cursor: number }
GET  /events/stream                  → SSE: all daemon events
```

### Agents

```
GET    /agents                       → { agents: AgentInfo[] }
POST   /agents                       → create agent
         body: { name: string, runtime: RuntimeConfig }
GET    /agents/:name                 → AgentInfo
DELETE /agents/:name                 → { removed: true }

POST   /agents/:name/send           → send message(s)
         body: { messages: [{ content, from?, delayMs? }] }
         → { sent: number, state: string }

GET    /agents/:name/responses?cursor=N&workspace=<key>
         → { entries: ResponseEntry[], cursor: number }
         workspace: optional filter (scope to responses from that workspace context)
GET    /agents/:name/responses/stream?workspace=<key>
         → SSE: real-time responses (optionally filtered by workspace)
GET    /agents/:name/events?cursor=N     → { entries: AgentEvent[], cursor: number }
GET    /agents/:name/events/stream       → SSE: real-time agent events
GET    /agents/:name/state               → { state, inbox, todos, history }

```

### Workspaces

```
GET    /workspaces                   → { workspaces: WorkspaceInfo[] }
POST   /workspaces                   → create workspace
         body: { source: string, tag?: string, vars?: Record<string, string>, mode?: "service" | "task" }
         mode "service" (default): long-running workspace, stopped via DELETE
         mode "task": run to completion, daemon auto-removes workspace when done.
           Completion = all workspace-local agents idle with empty inboxes.
           Referenced global agents are NOT considered (they are external dependencies).
           Failed = any local agent in error state.
         → WorkspaceInfo (includes `status: "running" | "completed" | "failed"`)

GET    /workspaces/:key              → WorkspaceInfo (key = name or name:tag)
         If bare name matches multiple tagged instances → 409 Conflict with list
GET    /workspaces/:key/wait         → block until workspace completes (for mode "task")
         query: ?timeout=60s
         → { status: "completed" | "failed" | "timeout", result?: WorkspaceResult }
DELETE /workspaces/:key              → { removed: true }
         For mode "task" workspaces: force-stops all agents, then removes.

POST   /workspaces/:key/send        → send to workspace
         body: { content, from?, agent?, channel? }
         → { sent: true, routed_to: string }

GET    /workspaces/:key/channels/:ch?cursor=N&agent=<name>
         → { entries: ChannelMessage[], cursor: number }
         agent: optional filter (messages from/to agent)
GET    /workspaces/:key/channels/:ch/stream?agent=<name>
         → SSE: real-time channel messages (optionally filtered)

GET    /workspaces/:key/events?cursor=N   → { entries: WorkspaceEvent[], cursor: number }
GET    /workspaces/:key/events/stream    → SSE: real-time workspace events
```

### Shared documents

```
GET    /workspaces/:key/docs         → { docs: DocInfo[] }
GET    /workspaces/:key/docs/:name   → { name, content }
PUT    /workspaces/:key/docs/:name   → write document
         body: { content: string }
PATCH  /workspaces/:key/docs/:name   → append to document
         body: { content: string }
```

## AwClient

Shared HTTP client used by CLI, Web UI, MCP, and tests.

```typescript
export class AwClient {
  constructor(opts: { baseUrl: string; token: string });

  /** Connect using daemon discovery file (~/.agent-worker/daemon.json). */
  static async discover(dataDir?: string): Promise<AwClient>;

  // Daemon
  health(): Promise<HealthInfo>;
  shutdown(): Promise<void>;
  readEvents(cursor?: number): Promise<EventsResult>;

  // Agents
  listAgents(): Promise<AgentInfo[]>;
  createAgent(name: string, runtime: RuntimeConfig): Promise<AgentInfo>;
  getAgent(name: string): Promise<AgentInfo>;
  removeAgent(name: string): Promise<void>;
  sendToAgent(name: string, messages: SendMessage[]): Promise<SendResult>;
  readResponses(name: string, opts?: { cursor?: number; workspace?: string }): Promise<ResponsesResult>;
  readAgentEvents(name: string, cursor?: number): Promise<EventsResult>;
  getAgentState(name: string): Promise<AgentStateResult>;
  // SSE streams (return AsyncIterable that yields parsed events)
  streamResponses(name: string, opts?: { cursor?: number; workspace?: string }): AsyncIterable<ResponseEntry>;
  streamAgentEvents(name: string, cursor?: number): AsyncIterable<AgentEvent>;
  streamEvents(cursor?: number): AsyncIterable<DaemonEvent>;

  // Workspaces
  listWorkspaces(): Promise<WorkspaceInfo[]>;
  startWorkspace(source: string, opts?: { tag?: string; vars?: Record<string, string>; mode?: "service" | "task" }): Promise<WorkspaceInfo>;
  waitWorkspace(key: string, timeout?: string): Promise<{ status: string; result?: WorkspaceResult }>;
  getWorkspace(key: string): Promise<WorkspaceInfo>;
  stopWorkspace(key: string): Promise<void>;
  sendToWorkspace(key: string, opts: { content: string; from?: string; agent?: string; channel?: string }): Promise<SendResult>;
  readChannel(key: string, channel: string, opts?: { cursor?: number; agent?: string }): Promise<ChannelResult>;
  streamChannel(key: string, channel: string, opts?: { cursor?: number; agent?: string }): AsyncIterable<ChannelMessage>;
  readWorkspaceEvents(key: string, cursor?: number): Promise<EventsResult>;
  streamWorkspaceEvents(key: string, cursor?: number): AsyncIterable<WorkspaceEvent>;

  // Documents
  listDocs(workspace: string): Promise<DocInfo[]>;
  readDoc(workspace: string, name: string): Promise<string>;
  writeDoc(workspace: string, name: string, content: string): Promise<void>;
  appendDoc(workspace: string, name: string, content: string): Promise<void>;
}
```

## File Structure

```
packages/agent-worker/src/
  daemon.ts                 # HTTP server (expanded API)
  client.ts                 # AwClient class

  cli/
    index.ts                # Entry point, command routing
    target.ts               # parseTarget()
    output.ts               # Formatting helpers (colors, tables)
    commands/
      up.ts                 # aw up
      down.ts               # aw down
      status.ts             # aw status
      create.ts             # aw create
      start.ts              # aw start
      ls.ts                 # aw ls
      info.ts               # aw info
      rm.ts                 # aw rm
      send.ts               # aw send
      read.ts               # aw read (SSE / polling)
      run.ts                # aw run (task workspace)
      state.ts              # aw state
      peek.ts               # aw peek
      log.ts                # aw log (SSE for --follow, cursor for history)
      doc.ts                # aw doc *

  # existing files
  agent-registry.ts
  workspace-registry.ts
  managed-agent.ts
  managed-workspace.ts
  event-log.ts
  discovery.ts
  runner.ts
  types.ts
  index.ts
```

## Migration Plan

### Phase 1: Foundation
1. `parseTarget()` in `cli/target.ts`
2. Per-agent/workspace storage directories and JSONL writers
3. `RuntimeConfig` type and loop factory (expand existing `workspace-registry.ts` pattern)
4. Expand daemon API routes

### Phase 2: Client + CLI
5. `AwClient` in `client.ts`
6. CLI commands as AwClient consumers under `cli/commands/`
7. Wire up `cli/index.ts`, update `package.json` bin

### Phase 3: Consolidate
8. Merge `agent/src/cli/daemon.ts` (AwDaemon) capabilities into daemon
9. Merge `workspace/src/cli/daemon.ts` (WsDaemon) capabilities into daemon
10. Delete old CLIs (`agent/src/cli/`, `workspace/src/cli/`)
11. Update a2a-test skill to use new `aw` commands

### Phase 4: Other Interfaces
12. Web UI using AwClient
13. MCP server using AwClient
