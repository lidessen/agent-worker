# packages/agent-worker — Design

> The daemon. One `aw` CLI, one Hono HTTP surface, one long-lived process that owns harness lifecycles, active workspace orchestration, runtime actor creation, and the runtime telemetry event log.

See [../DESIGN.md](../DESIGN.md) for the `HarnessEnvironment -> AgentRuntime` boundary, and [orchestrator.md](orchestrator.md) for the session orchestrator surface this daemon hosts. This doc covers the package's internal organization.

## Internal shape

```
   CLI (aw) ──┐     Web UI ──┐     MCP clients ──┐
              ▼              ▼                   ▼
                        AwClient (HTTP)
                              │
                              ▼
  ┌────────────────────── Daemon (Hono) ──────────────────────┐
  │                                                            │
  │   HarnessRegistry / lifecycle                              │
  │    ├─ WorkspaceRegistry                                    │
  │    │   └─ ManagedWorkspace                                 │
  │    │      ├─ WorkspaceHarness kernel                       │
  │    │      └─ WorkspaceOrchestrator[]                       │
  │    │         ├─ ContextPacketBuilder                       │
  │    │         ├─ CapabilityBoundary                         │
  │    │         ├─ extractor/retry hooks                      │
  │    │         └─ AgentRuntime runner closures               │
  │    └─ PersonalHarnessRegistry?                             │
  │        (optional simple-agent product path)                 │
  │                                                            │
  │   runtime-factory ──► RuntimeBinding ──► AgentRuntime      │
  │                         ▲                 │                │
  │                  resolve-runtime          ▼                │
  │                                       AgentLoop            │
  │                                                            │
  │   EventBus ─► DaemonEventLog (JSONL + byte cursor)         │
  │                                                            │
  │   WorkspaceMcpHub (per-agent HTTP MCP sessions)            │
  └────────────────────────────────────────────────────────────┘
```

## Modules

**Daemon core.** `daemon.ts` owns the Hono server, routes, auth, startup/shutdown. `index.ts` is the public package entry. `client.ts` (`AwClient`) is the single HTTP client used by CLI, Web UI, MCP tools, and tests — no direct fetch elsewhere. `types.ts` defines cross-module DTOs. `discovery.ts` persists the daemon info file (port, pid, token) for CLI lookup.

**Runtime and harness actor surfaces.** During migration, `agent-registry.ts`, `managed-agent.ts`, and `global-agent-stub.ts` still expose the historical `/agents` product surface. In the target design this becomes listing/state for runtime actors or harness members, not the owner of inbox/todos/memory. `POST /agents` and `POST /agents/:name/send` must either be removed/blocked or explicitly mapped to `PersonalHarness`; they must not preserve a hidden `ManagedAgent` dispatch path. Normal message dispatch targets a harness: workspace channel/task APIs for `WorkspaceHarness`, or personal harness APIs if simple non-workspace agents remain.

**WorkspaceHarness path.** `workspace-registry.ts` maps keys (`name` or `name:tag`) -> `ManagedWorkspace`, ensures the implicit `global` workspace exists, persists `workspaces.json` for restart recovery, serializes manifest writes. `managed-workspace.ts` holds the passive `Workspace` kernel + resolved config + one `WorkspaceOrchestrator` per runtime actor, emits `status.json`, snapshots per-run runner scopes (cwd, allowedPaths, active worktree). `orchestrator.ts` reads pending WorkspaceEvents/invocations, asks the workspace for context packets, routes every protected write/effect through the capability boundary, dispatches accepted Wakes to runner closures, invokes extractors after terminal Wakes, and owns quota backoff + retry/auto-pause. Protected effects are keyed by invocation id; non-idempotent external effects require a durable outbox/commit record before retry. `runner.ts` is the runner abstraction (`HostRunner` today; `SandboxRunner` is a placeholder).

**Runtime wiring.** `resolve-runtime.ts` and `loop-factory.ts` resolve a harness-selected runtime/model into a `RuntimeBinding` backed by an `AgentLoop` (ai-sdk / claude-code / codex / cursor / mock), passing MCP servers as structured objects to SDK-capable loops and writing temp MCP config files only for config-file runtimes, with cleanup hooked. The daemon wraps that loop as an `AgentRuntime` runner closure that receives the binding, a harness-built packet, capability grant, and run policy. Runtime selection happens before invocation; `AgentRuntime` adapts the binding and does not choose provider/model/actor.

**Event log.** `event-log.ts` is the single EventBus consumer: appends every BusEvent to daemon JSONL, tracks byte offsets so `/events` can resume from a cursor.

**CLI.** `cli/index.ts` dispatches, `cli/target.ts` parses the `[agent][@workspace[:tag]][#channel]` syntax, `cli/output.ts` formats. `cli/commands/` holds one module per command (`daemon`, `status`, `add`, `create`, `run`, `ls`, `info`, `rm`, `send`, `read`, `repl`, `state`, `peek`, `log`, `doc`, `task`, `auth`, `connect`, `clear`). All commands are thin HTTP callers.

## Daemon startup

```
new Daemon()
  ├─ EventBus + harness registries + DaemonEventLog
  ├─ bus.on(eventLog.append)          ← single consumer
  └─ Hono routes mounted
start()
  ├─ server.listen(port)
  ├─ WorkspaceRegistry.ensureDefault("global")
  ├─ WorkspaceMcpHub.start()          ← HTTP MCP sessions for workspace tools
  ├─ register workspace harness members for listing/state
  ├─ boot workspace orchestrators
  ├─ restore persisted workspaces from manifest
  └─ write discovery file, emit daemon.started
```

## HTTP surface

Grouped by concern:

- **Daemon** — `GET /health`, `POST /shutdown`.
- **Agents / runtime actors (migration surface)** — `GET /agents`, `GET /agents/:name`, `GET /agents/:name/state`, `GET /agents/:name/responses[/stream]`, `GET /agents/:name/events[/stream]` list and inspect runtime actors or harness members. `POST /agents`, `DELETE /agents/:name`, and `POST /agents/:name/send` are deprecated migration endpoints: target behavior is blocked unless the request explicitly targets `PersonalHarness`. Workspace-backed members are listing/state only and `/agents/:name/send` rejects them instead of silently routing to workspace mode.
- **Workspaces (lifecycle)** — `GET/POST /workspaces`, `GET/DELETE /workspaces/:key`, `GET /workspaces/:key/wait` (task-mode completion), `GET /workspaces/:key/status`, `POST /workspaces/:key/send`.
- **Workspace channels** — `GET /workspaces/:key/channels`, `GET/DELETE /workspaces/:key/channels/:ch[/stream]`.
- **Workspace docs** — `GET /workspaces/:key/docs`, `GET/PUT/PATCH /workspaces/:key/docs/:name`.
- **Workspace semantic state** — `GET /workspaces/:key/events`, `GET /workspaces/:key/tracks`, `GET /workspaces/:key/invocations` (target shape; current HTTP surface may lag during migration).
- **Workspace tasks** — `GET/POST /workspaces/:key/tasks`, `GET /workspaces/:key/tasks/:id`, `POST /workspaces/:key/tasks/:id/{dispatch,complete,abort}`. Mutating task APIs route through capability validation in the target shape.
- **Workspace debug** — `GET /workspaces/:key/chronicle`, `GET /workspaces/:key/agent-scopes`, `GET /workspaces/:key/inbox/:agent`, `POST /workspaces/:key/tool-call`. Chronicle/inbox/tool-call endpoints are audit/debug or migration surfaces, not the semantic state source.
- **Events** — `GET /events[/stream]` (cursor-based polling or SSE).

## Key mechanisms

**Thin CLI, fat daemon.** Every `aw` command goes through `AwClient` over HTTP. No CLI-local state, no alternate control paths. Web UI and MCP hub use the same client. This is why the daemon must stay up — CLI invocations are not self-contained.

**Auth by locality.** Requests from loopback (`127.0.0.1`, `localhost`, `::1`) and optionally Tailscale CGNAT ranges skip auth entirely. Anything else requires the machine-scoped bearer token from the discovery file. No per-user accounts.

**Harness registries, one event bus.** The daemon may keep separate registries for workspace and personal/simple harnesses, but the conceptual owner is the harness lifecycle. Removing a runtime actor must not delete harness state unless the harness API says so. All runtime telemetry converges on the EventBus, which remains global audit plumbing rather than semantic workspace state.

**Orchestrator owns active harness work, workspace stays passive.** `Workspace` exposes raw intake/evidence stores, semantic event stores, Track projections, context packet builders, capability validation contracts, invocation records, and execution ledgers. `WorkspaceOrchestrator` is the active loop: read pending events/invocations, request a bounded context packet, route protected dispatch/mutation/tool/extractor effects through the capability boundary, rebuild per-run tools with the active Wake id, dispatch through a per-agent runner closure, classify errors, backoff/retry on quota or failed extraction, and notify operators on fatal failures. This split is why workspace semantics can be reused with different execution strategies.

**Runtime is chosen before harness dispatch.** `resolve-runtime.ts` + `loop-factory.ts` commit the loop implementation for a runtime actor or run. MCP config is written to a temp file per-loop and cleaned up on disposal; OAuth-declaring MCP entries are rejected up front. Runtime choice does not decide context, tools, policy, or long-term memory; the harness does.

**Recovery is manifest + idempotent semantic replay, not process resurrection.** `WorkspaceRegistry` persists workspace manifests and restores them on daemon start; `ManagedWorkspace` restarts each workspace's orchestrators from the resolved config and file-backed workspace stores. Workspace state recovery is explicit: inbox entries are reloaded during migration, orphaned running Wakes are stamped failed with a WorkspaceEvent so future dispatch can proceed, and terminal Wakes / Handoffs without matching extracted WorkspaceEvents are re-extracted. Runtime session continuity is delegated to the loop factory and backend-specific state files, currently Codex's per-agent `codex-thread.json`.

**Protected effect retry is invocation-keyed.** The daemon retries protected work by stable `invocationId` / idempotency key. It must observe committed state writes, dispatch records, worktree operations, artifact records, extractor outputs, and external outbox entries before retrying. If an external effect cannot prove whether it committed, the orchestrator records a blocked WorkspaceEvent and asks for operator/human resolution instead of replaying it blindly.

**Control policy is resolved before runtime invocation.** Workspace config loading resolves `WorkspaceDef.policy` + `AgentDef.policy` into each `ResolvedAgent`. `workspace-registry.ts` passes those fields into runtime creation/invocation, where they become backend options (`permissionMode`, `fullAuto`, `sandbox`) alongside `cwd`, `allowedPaths`, `env`, and MCP servers. The daemon does not invent a generic autonomy mode; it translates resolved policy into runtime-native controls.

## Non-goals

- Distributing across multiple daemon processes.
- Per-user auth or multi-tenant isolation.
- Command-line-local state (no `~/.aw/state` that bypasses the daemon).
- Hot-swapping runtimes on a live agent.
- A universal approval UI or git-command policy layer.
