# packages/agent-worker — Design

> The daemon. One `aw` CLI, one Hono HTTP surface, one long-lived process that owns the two execution paths (standalone agents and workspaces) and the event log.

See [../DESIGN.md](../DESIGN.md) for how the two paths split. This doc covers the package's internal organization.

## Internal shape

```
   CLI (aw) ──┐     Web UI ──┐     MCP clients ──┐
              ▼              ▼                   ▼
                        AwClient (HTTP)
                              │
                              ▼
  ┌────────────────────── Daemon (Hono) ──────────────────────┐
  │                                                            │
  │   AgentRegistry          WorkspaceRegistry                 │
  │    └─ ManagedAgent        └─ ManagedWorkspace              │
  │       └─ Agent               ├─ Workspace (kernel)         │
  │                              └─ WorkspaceOrchestrator[]    │
  │                                 └─ runner closures         │
  │       GlobalAgentStub ◄──── surfaces workspace agents      │
  │                                                            │
  │   loop-factory ──► AgentLoop        resolve-runtime        │
  │                                                            │
  │   EventBus ─► DaemonEventLog (JSONL + byte cursor)         │
  │                                                            │
  │   WorkspaceMcpHub (per-agent HTTP MCP sessions)            │
  └────────────────────────────────────────────────────────────┘
```

## Modules

**Daemon core.** `daemon.ts` owns the Hono server, routes, auth, startup/shutdown. `index.ts` is the public package entry. `client.ts` (`AwClient`) is the single HTTP client used by CLI, Web UI, MCP tools, and tests — no direct fetch elsewhere. `types.ts` defines cross-module DTOs. `discovery.ts` persists the daemon info file (port, pid, token) for CLI lookup.

**Agent path.** `agent-registry.ts` maps names → `ManagedAgent | GlobalAgentStub`, validates storage paths, handles removal. `managed-agent.ts` wraps `Agent` with per-agent JSONL storage (`responses.jsonl`, `events.jsonl`, `inbox.jsonl`, `timeline.jsonl`), token usage bookkeeping, and EventBus fan-out. `global-agent-stub.ts` is a listing-only stub for workspace-backed agents — it has no `Agent` or loop, it just lets workspace members appear at `/agents`.

**Workspace path.** `workspace-registry.ts` maps keys (`name` or `name:tag`) → `ManagedWorkspace`, ensures the implicit `global` workspace exists, persists `workspaces.json` for restart recovery, serializes manifest writes. `managed-workspace.ts` holds the `Workspace` + resolved config + one `WorkspaceOrchestrator` per agent loop, emits `status.json`, snapshots per-run runner scopes (cwd, allowedPaths, active worktree). `orchestrator.ts` polls the workspace's `InstructionQueue`, builds prompts, dispatches to the runner closure, and owns quota backoff + auto-pause. `runner.ts` is the runner abstraction (`HostRunner` today; `SandboxRunner` is a placeholder).

**Loop wiring.** `loop-factory.ts` turns a `RuntimeConfig` into an `AgentLoop` (ai-sdk / claude-code / codex / cursor / mock) and writes a temp MCP config file for CLI runtimes, hooking cleanup. `resolve-runtime.ts` resolves runtime + model: CLI discovery precedence, provider key detection, fallback to ai-sdk if a model is given but no CLI.

**Event log.** `event-log.ts` is the single EventBus consumer: appends every BusEvent to daemon JSONL, tracks byte offsets so `/events` can resume from a cursor.

**CLI.** `cli/index.ts` dispatches, `cli/target.ts` parses the `[agent][@workspace[:tag]][#channel]` syntax, `cli/output.ts` formats. `cli/commands/` holds one module per command (`daemon`, `status`, `add`, `create`, `run`, `ls`, `info`, `rm`, `send`, `read`, `repl`, `state`, `peek`, `log`, `doc`, `task`, `auth`, `connect`, `clear`). All commands are thin HTTP callers.

## Daemon startup

```
new Daemon()
  ├─ EventBus + AgentRegistry + WorkspaceRegistry + DaemonEventLog
  ├─ bus.on(eventLog.append)          ← single consumer
  └─ Hono routes mounted
start()
  ├─ server.listen(port)
  ├─ WorkspaceRegistry.ensureDefault("global")
  ├─ WorkspaceMcpHub.start()          ← HTTP MCP sessions for workspace tools
  ├─ register global-config agents as GlobalAgentStub
  ├─ boot workspace orchestrators
  ├─ restore persisted workspaces from manifest
  └─ write discovery file, emit daemon.started
```

## HTTP surface

Grouped by concern:

- **Daemon** — `GET /health`, `POST /shutdown`.
- **Agents** — `GET/POST /agents`, `GET/DELETE /agents/:name`, `POST /agents/:name/send`, `GET /agents/:name/state`, `GET /agents/:name/responses[/stream]`, `GET /agents/:name/events[/stream]`.
- **Workspaces (lifecycle)** — `GET/POST /workspaces`, `GET/DELETE /workspaces/:key`, `GET /workspaces/:key/wait` (task-mode completion), `GET /workspaces/:key/status`, `POST /workspaces/:key/send`.
- **Workspace channels** — `GET /workspaces/:key/channels`, `GET/DELETE /workspaces/:key/channels/:ch[/stream]`.
- **Workspace docs** — `GET /workspaces/:key/docs`, `GET/PUT/PATCH /workspaces/:key/docs/:name`.
- **Workspace tasks** — `GET/POST /workspaces/:key/tasks`, `GET /workspaces/:key/tasks/:id`, `POST /workspaces/:key/tasks/:id/{dispatch,complete,abort}`.
- **Workspace debug** — `GET /workspaces/:key/chronicle`, `GET /workspaces/:key/agent-scopes`, `GET /workspaces/:key/inbox/:agent`, `POST /workspaces/:key/tool-call`.
- **Events** — `GET /events[/stream]` (cursor-based polling or SSE).

## Key mechanisms

**Thin CLI, fat daemon.** Every `aw` command goes through `AwClient` over HTTP. No CLI-local state, no alternate control paths. Web UI and MCP hub use the same client. This is why the daemon must stay up — CLI invocations are not self-contained.

**Auth by locality.** Requests from loopback (`127.0.0.1`, `localhost`, `::1`) and optionally Tailscale CGNAT ranges skip auth entirely. Anything else requires the machine-scoped bearer token from the discovery file. No per-user accounts.

**Two registries, one event bus.** `AgentRegistry` and `WorkspaceRegistry` are independent — removing an agent never touches a workspace, restarting a workspace never touches `/agents`-registered standalones. They converge on the EventBus, which is the only global point.

**Orchestrator owns polling, workspace stays passive.** `Workspace` exposes enqueue/dequeue, state store, and context providers. `WorkspaceOrchestrator` is the active loop: poll queue, assemble prompt via `workspace.assemblePrompt`, rebuild per-run tools with the active attempt id, dispatch through a per-agent runner closure, classify errors, backoff on quota, notify lead on fatal. This split is why workspace semantics can be reused with different execution strategies.

**Runtime is chosen at agent-create time.** `resolve-runtime.ts` + `loop-factory.ts` commit the loop implementation once. Runtime swap requires recreating the agent. MCP config is written to a temp file per-loop and cleaned up on disposal; OAuth-declaring MCP entries are rejected up front.

## Non-goals

- Distributing across multiple daemon processes.
- Per-user auth or multi-tenant isolation.
- Command-line-local state (no `~/.aw/state` that bypasses the daemon).
- Hot-swapping runtimes on a live agent.
