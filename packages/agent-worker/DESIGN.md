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
[agent] [@workspace] [#channel]
```

At least one part is required.

| Input | Agent | Workspace | Channel |
|-------|-------|-----------|---------|
| `alice` | alice | — | — |
| `alice@review` | alice | review | (default) |
| `@review` | — | review | (default) |
| `@review#design` | — | review | design |
| `alice@review#design` | alice | review | design |

Rules:
- `#` mid-word is not a shell comment — no quoting needed for `@review#design`
- Standalone `#channel` requires quotes — always use `@workspace#channel` instead
- When workspace has a `default_channel`, `@review` routes to it

### Parsing

```typescript
interface Target {
  agent?: string;
  workspace?: string;
  channel?: string;
}

function parseTarget(raw: string): Target {
  // alice@review#design → { agent: "alice", workspace: "review", channel: "design" }
  const match = raw.match(/^([^@#]+)?(?:@([^#]+))?(?:#(.+))?$/);
  return {
    agent: match?.[1] || undefined,
    workspace: match?.[2] || undefined,
    channel: match?.[3] || undefined,
  };
}
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

aw start <config.yaml>        # Start workspace from YAML
  --tag <tag>                 #   instance tag (e.g. pr-123)
  --var KEY=VALUE             #   template variables

aw ls                         # List all agents + workspaces
aw info <target>              # Details (alice / @review / alice@review)
aw rm <target>                # Remove agent or stop workspace
```

### Messaging

```bash
aw send <target> "message" [+Ns "message2" ...]
  --from <name>               # sender name

aw recv <target> [options]
  --wait <seconds>            # poll until response (default: 0)
  --json                      # raw JSONL output

aw run <target> "prompt"      # send + recv --wait 30 (convenience)
  --wait <seconds>            # override wait time (default: 30)
```

### Inspection

```bash
aw state <target>             # Agent state, inbox, todos
aw peek <target>              # Conversation history
aw log [<target>] [options]   # Event log (filtered by target if given)
  --follow, -f                # tail mode
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

All routes under daemon, CLI calls these via `AwClient`.

### Existing (keep)

```
GET  /health
POST /shutdown
GET  /events?cursor=N
```

### Agents

```
GET    /agents                       → { agents: AgentInfo[] }
POST   /agents                       → create agent (with runtime config)
         body: { name, runtime, model, instructions }
GET    /agents/:name                 → AgentInfo
DELETE /agents/:name                 → remove

POST   /agents/:name/send           → send message(s)
         body: { messages: [{ content, from?, delayMs? }] }
GET    /agents/:name/recv?cursor=N   → incremental responses
GET    /agents/:name/state           → { state, inbox, todos, history }
GET    /agents/:name/log?cursor=N    → per-agent events
POST   /agents/:name/run             → send + wait for response
         body: { message, from? }
```

### Workspaces

```
GET    /workspaces                   → { workspaces: WorkspaceInfo[] }
POST   /workspaces                   → start workspace
         body: { source, tag?, vars? }
GET    /workspaces/:key              → WorkspaceInfo
DELETE /workspaces/:key              → stop + remove

POST   /workspaces/:key/send        → send to channel/agent
         body: { target, content, from? }
GET    /workspaces/:key/peek         → conversation history
         query: ?target=<agent|channel>&cursor=N
GET    /workspaces/:key/log?cursor=N → workspace events
```

### Shared documents

```
GET    /workspaces/:key/docs         → list documents
GET    /workspaces/:key/docs/:name   → read document
PUT    /workspaces/:key/docs/:name   → write document
PATCH  /workspaces/:key/docs/:name   → append to document
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

  // Agents
  listAgents(): Promise<AgentInfo[]>;
  createAgent(opts: CreateAgentOpts): Promise<AgentInfo>;
  getAgent(name: string): Promise<AgentInfo>;
  removeAgent(name: string): Promise<void>;

  // Messaging (resolves target to correct API route)
  send(target: Target, messages: SendMessage[]): Promise<SendResult>;
  recv(target: Target, cursor?: number): Promise<RecvResult>;
  run(target: Target, message: string): Promise<RunResult>;
  getState(target: Target): Promise<StateResult>;
  peek(target: Target, cursor?: number): Promise<PeekResult>;

  // Workspaces
  listWorkspaces(): Promise<WorkspaceInfo[]>;
  startWorkspace(opts: StartWorkspaceOpts): Promise<WorkspaceInfo>;
  getWorkspace(key: string): Promise<WorkspaceInfo>;
  stopWorkspace(key: string): Promise<void>;

  // Documents
  listDocs(workspace: string): Promise<DocInfo[]>;
  readDoc(workspace: string, name: string): Promise<string>;
  writeDoc(workspace: string, name: string, content: string): Promise<void>;
  appendDoc(workspace: string, name: string, content: string): Promise<void>;

  // Events
  readEvents(cursor?: number, target?: Target): Promise<EventsResult>;
}
```

The client resolves `Target` to the correct API route:
- `{ agent: "alice" }` → `POST /agents/alice/send`
- `{ agent: "alice", workspace: "review" }` → `POST /workspaces/review/send` with target
- `{ workspace: "review", channel: "design" }` → `POST /workspaces/review/send` with target

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
      recv.ts               # aw recv
      run.ts                # aw run
      state.ts              # aw state
      peek.ts               # aw peek
      log.ts                # aw log
      doc.ts                # aw doc *

  # existing files (unchanged)
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
1. Add `parseTarget()` to `cli/target.ts`
2. Add `AwClient` to `client.ts`
3. Expand daemon API routes (agent send/recv/state/log, workspace send/peek)

### Phase 2: CLI Rewrite
4. Rewrite CLI commands as AwClient consumers under `cli/commands/`
5. Wire up `cli/index.ts` entry point
6. Update `package.json` bin entry

### Phase 3: Consolidate
7. Merge `agent/src/cli/daemon.ts` (AwDaemon) capabilities into daemon
8. Merge `workspace/src/cli/daemon.ts` (WsDaemon) capabilities into daemon
9. Delete old CLIs (`agent/src/cli/`, `workspace/src/cli/`)
10. Update a2a-test skill to use new `aw` commands

### Phase 4: Other Interfaces
11. Web UI using AwClient
12. MCP server using AwClient
