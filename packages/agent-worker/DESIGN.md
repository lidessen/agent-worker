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
| `alice` | alice | — | — |
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

## Storage Model

Each agent and workspace gets isolated output streams for cursor-based incremental reads. Stored under the daemon's data directory.

```
~/.agent-worker/
  daemon.json                          # discovery file (pid, port, token)
  events.jsonl                         # global daemon event log

  agents/
    alice/
      responses.jsonl                  # text output + send events
      events.jsonl                     # agent-level events (state, run, tool, thinking)

  workspaces/
    review/                            # or review:pr-42/ for tagged instances
      events.jsonl                     # workspace-level events
      channels/
        general.jsonl                  # channel message log
        design.jsonl
```

### What goes where

| Stream | Content | Written by |
|--------|---------|-----------|
| `agents/<name>/responses.jsonl` | text output, send-to-other-agent events | ManagedAgent event handler |
| `agents/<name>/events.jsonl` | state_change, run_start, run_end, tool_call_*, thinking, error | ManagedAgent event handler |
| `workspaces/<key>/events.jsonl` | workspace lifecycle, agent join/leave, routing | ManagedWorkspace |
| `workspaces/<key>/channels/<ch>.jsonl` | channel messages (from, content, ts) | Workspace channel router |
| `events.jsonl` | everything (global, for daemon-level `/events`) | EventBus subscriber |

All files are append-only JSONL. Cursor = byte offset. Survives daemon restart (files persist, daemon re-reads on startup).

### Global vs scoped

The HTTP API exposes **scoped** reads:
- `/agents/:name/responses?cursor=N` — that agent's responses only
- `/agents/:name/events?cursor=N` — that agent's events only
- `/workspaces/:key/events?cursor=N` — that workspace's events only
- `/events?cursor=N` — global (all events, for dashboard/debug)

### Polling vs SSE

Each cursor-based endpoint has a corresponding SSE stream endpoint for real-time push:

| Polling (cursor) | SSE (stream) |
|-------------------|-------------|
| `GET /agents/:name/responses?cursor=N` | `GET /agents/:name/responses/stream` |
| `GET /agents/:name/events?cursor=N` | `GET /agents/:name/events/stream` |
| `GET /workspaces/:key/events?cursor=N` | `GET /workspaces/:key/events/stream` |
| `GET /events?cursor=N` | `GET /events/stream` |

SSE endpoints return `text/event-stream`. Each event is a JSON-encoded line:

```
data: {"ts":1710000000,"type":"text","text":"Hello"}

data: {"ts":1710000001,"type":"run_end","durationMs":1200,"tokens":150}
```

Clients can pass `?cursor=N` to replay from a byte offset before switching to live push. Without `cursor`, only new events are streamed.

The CLI prefers SSE when available:
- `aw recv --wait` → SSE on `/agents/:name/responses/stream`, close on first response batch
- `aw log --follow` → SSE on the appropriate `/stream` endpoint
- Falls back to cursor polling if SSE connection fails

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

### Routing rules

The workspace `send` API resolves the target to a concrete action:

| Target | Action |
|--------|--------|
| `{ agent: "alice" }` | Push to alice's inbox directly |
| `{ channel: "general" }` | Post to #general channel; all agents subscribed to #general see it |
| `{ agent: "alice", channel: "design" }` | Post to #design channel with `from` set, addressed to alice (alice gets inbox notification) |
| `{ workspace only }` | Post to default channel |

### HTTP API

```
POST /workspaces/:key/send
body: {
  content: string;
  from?: string;        // sender name (default: "user")
  agent?: string;       // direct to specific agent's inbox
  channel?: string;     // post to channel (default: default_channel)
}
```

- If only `channel`: broadcast to channel, all subscribed agents see it in their next context assembly.
- If only `agent`: direct inbox push, no channel involvement.
- If both `agent` and `channel`: post to channel AND push notification to agent's inbox.

### CLI mapping

```bash
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

aw start <config.yaml>        # Start workspace from YAML
  --tag <tag>                 #   instance tag (e.g. pr-42)
  --var KEY=VALUE             #   template variables (repeatable)

aw ls                         # List all agents + workspaces
aw info <target>              # Details (alice / @review:pr-42 / alice@review)
aw rm <target>                # Remove agent or stop workspace
```

### Messaging

```bash
aw send <target> "message" [+Ns "message2" ...]
  --from <name>               # sender name

aw recv <target> [options]    # CLI-only: poll for responses
  --wait <seconds>            # poll until response (default: 0)
  --json                      # raw JSONL output

aw run <target> "prompt"      # send + wait for response (synchronous)
```

`recv` and `run --wait` use SSE streams when available, falling back to cursor polling. The HTTP API does not block on non-SSE endpoints.

### Inspection

```bash
aw state <target>             # Agent state, inbox, todos
aw peek <target>              # Conversation / channel history
aw log [<target>] [options]   # Event log (filtered by target if given)
  --follow, -f                # tail mode (CLI-level polling)
  --json                      # raw JSONL
```

### Shared documents (workspace)

```bash
aw doc ls [@workspace]
aw doc read <name> [@workspace]
aw doc write <name> [@workspace] --content "..."
aw doc append <name> [@workspace] --content "..."
```

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

GET    /agents/:name/responses?cursor=N   → { entries: ResponseEntry[], cursor: number }
GET    /agents/:name/responses/stream    → SSE: real-time responses
GET    /agents/:name/events?cursor=N     → { entries: AgentEvent[], cursor: number }
GET    /agents/:name/events/stream       → SSE: real-time agent events
GET    /agents/:name/state               → { state, inbox, todos, history }

```

### Workspaces

```
GET    /workspaces                   → { workspaces: WorkspaceInfo[] }
POST   /workspaces                   → start workspace
         body: { source: string, tag?: string, vars?: Record<string, string> }
GET    /workspaces/:key              → WorkspaceInfo (key = name or name:tag)
DELETE /workspaces/:key              → { removed: true }

POST   /workspaces/:key/send        → send to workspace
         body: { content, from?, agent?, channel? }
         → { sent: true, routed_to: string }

GET    /workspaces/:key/peek         → conversation history
         query: ?channel=<name>&cursor=N
         → { entries: ChannelMessage[], cursor: number }

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
  readResponses(name: string, cursor?: number): Promise<ResponsesResult>;
  readAgentEvents(name: string, cursor?: number): Promise<EventsResult>;
  getAgentState(name: string): Promise<AgentStateResult>;
  // SSE streams (return AsyncIterable that yields parsed events)
  streamResponses(name: string, cursor?: number): AsyncIterable<ResponseEntry>;
  streamAgentEvents(name: string, cursor?: number): AsyncIterable<AgentEvent>;
  streamEvents(cursor?: number): AsyncIterable<DaemonEvent>;

  // Workspaces
  listWorkspaces(): Promise<WorkspaceInfo[]>;
  startWorkspace(source: string, opts?: { tag?: string; vars?: Record<string, string> }): Promise<WorkspaceInfo>;
  getWorkspace(key: string): Promise<WorkspaceInfo>;
  stopWorkspace(key: string): Promise<void>;
  sendToWorkspace(key: string, opts: { content: string; from?: string; agent?: string; channel?: string }): Promise<SendResult>;
  peekWorkspace(key: string, channel?: string, cursor?: number): Promise<PeekResult>;
  readWorkspaceEvents(key: string, cursor?: number): Promise<EventsResult>;

  // Documents
  listDocs(workspace: string): Promise<DocInfo[]>;
  readDoc(workspace: string, name: string): Promise<string>;
  writeDoc(workspace: string, name: string, content: string): Promise<void>;
  appendDoc(workspace: string, name: string, content: string): Promise<void>;
}
```

The CLI resolves `Target` to the correct `AwClient` method:
- `alice` (standalone agent) → `sendToAgent("alice", ...)`
- `alice@review` → `sendToWorkspace("review", { agent: "alice", ... })`
- `@review#design` → `sendToWorkspace("review", { channel: "design", ... })`
- `alice@review:pr-42#design` → `sendToWorkspace("review:pr-42", { agent: "alice", channel: "design", ... })`

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
      recv.ts               # aw recv (CLI polling loop)
      run.ts                # aw run (= send + recv)
      state.ts              # aw state
      peek.ts               # aw peek
      log.ts                # aw log (CLI polling for --follow)
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
