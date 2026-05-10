# packages/agent-worker — Design

> The daemon. One `aw` CLI, one Hono HTTP surface, one long-lived process that owns Harness lifecycles, active orchestration, runtime actor creation, and the runtime telemetry event log.

See [../DESIGN.md](../DESIGN.md) for the `Harness -> AgentRuntime` boundary, [harness.md](harness.md) for the substrate this daemon hosts, and [orchestrator.md](orchestrator.md) for the session orchestrator surface. This doc covers the daemon's internal organization.

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
  │    └─ ManagedHarness                                       │
  │       ├─ Harness (substrate + HarnessType)                 │
  │       └─ HarnessOrchestrator[]                             │
  │          ├─ ContextPacketBuilder                           │
  │          ├─ CapabilityBoundary                             │
  │          ├─ HarnessTypeRegistry hook helpers               │
  │          ├─ extractor/retry hooks                          │
  │          └─ AgentRuntime runner closures                   │
  │                                                            │
  │   runtime-factory ──► RuntimeBinding ──► AgentRuntime      │
  │                         ▲                 │                │
  │                  resolve-runtime          ▼                │
  │                                       AgentLoop            │
  │                                                            │
  │   EventBus ─► DaemonEventLog (JSONL + byte cursor)         │
  │                                                            │
  │   HarnessMcpHub (per-agent HTTP MCP sessions)              │
  └────────────────────────────────────────────────────────────┘
```

## Modules

**Daemon core.** `daemon.ts` owns the Hono server, routes, auth, startup/shutdown. `index.ts` is the public package entry. `client.ts` (`AwClient`) is the single HTTP client used by CLI, Web UI, MCP tools, and tests — no direct fetch elsewhere. `types.ts` defines cross-module DTOs. `discovery.ts` persists the daemon info file (port, pid, token) for CLI lookup.

**Runtime actor surfaces (migration source).** During migration, `agent-registry.ts`, `managed-agent.ts`, and `global-agent-stub.ts` still expose the historical `/agents` product surface. In the target design this becomes listing/state for runtime actors or Harness members, not the owner of inbox/todos/memory. `POST /agents` and `POST /agents/:name/send` must either be removed/blocked or explicitly mapped to a Harness with the personal type; they must not preserve a hidden `ManagedAgent` dispatch path. Normal message dispatch targets a Harness — the coordination type contributes channel/task APIs; a personal type contributes its own intake APIs.

**Harness path.** `harness-registry.ts` maps keys (`name` or `name:tag`) -> `ManagedHarness`, ensures the implicit `global` Harness exists, persists `harnesses.json` for restart recovery, serializes manifest writes. `managed-harness.ts` holds the passive `Harness` (substrate + the configured `HarnessType`) + resolved config + one `HarnessOrchestrator` per runtime actor, emits `status.json`, snapshots per-run runner scopes (cwd, allowedPaths, active worktree). `orchestrator.ts` reads pending HarnessEvents/invocations, asks the substrate for context packets (running prior-Handoff `consumeExtension` hooks via the type registry), routes every protected write/effect through the capability boundary, dispatches accepted Wakes to runner closures, runs `produceExtension` at Handoff write, invokes extractors after terminal Wakes, and owns quota backoff + retry/auto-pause. Protected effects are keyed by invocation id; non-idempotent external effects require a durable outbox/commit record before retry. `runner.ts` is the runner abstraction (`HostRunner` today; `SandboxRunner` is a placeholder).

**Runtime wiring.** `resolve-runtime.ts` and `loop-factory.ts` resolve a Harness-selected runtime/model into a `RuntimeBinding` backed by an `AgentLoop` (ai-sdk / claude-code / codex / cursor / mock), passing MCP servers as structured objects to SDK-capable loops and writing temp MCP config files only for config-file runtimes, with cleanup hooked. The daemon wraps that loop as an `AgentRuntime` runner closure that receives the binding, a Harness-built packet, capability grant, and run policy. Runtime selection happens before invocation; `AgentRuntime` adapts the binding and does not choose provider/model/actor.

**Event log.** `event-log.ts` is the single EventBus consumer: appends every BusEvent to daemon JSONL, tracks byte offsets so `/events` can resume from a cursor.

**CLI.** `cli/index.ts` dispatches, `cli/target.ts` parses the `[agent][@harness[:tag]][#channel]` syntax, `cli/output.ts` formats. `cli/commands/` holds one module per command (`daemon`, `status`, `add`, `create`, `run`, `ls`, `info`, `rm`, `send`, `read`, `repl`, `state`, `peek`, `log`, `doc`, `task`, `auth`, `connect`, `clear`). All commands are thin HTTP callers.

## Daemon startup

```
new Daemon()
  ├─ EventBus + HarnessRegistry + DaemonEventLog
  ├─ bus.on(eventLog.append)          ← single consumer
  └─ Hono routes mounted
start()
  ├─ server.listen(port)
  ├─ HarnessRegistry.ensureDefault("global")
  ├─ HarnessMcpHub.start()            ← HTTP MCP sessions for harness tools
  ├─ register Harness members for listing/state
  ├─ boot Harness orchestrators
  ├─ restore persisted Harnesses from manifest
  └─ write discovery file, emit daemon.started
```

## HTTP surface

Grouped by concern. The substrate paths are present on every Harness regardless of type; type-specific paths (channels, inbox, team docs) are mounted by the registered `HarnessType`.

- **Daemon** — `GET /health`, `POST /shutdown`.
- **Agents / runtime actors (migration surface)** — `GET /agents`, `GET /agents/:name`, `GET /agents/:name/state`, `GET /agents/:name/responses[/stream]`, `GET /agents/:name/events[/stream]` list and inspect runtime actors or Harness members. `POST /agents`, `DELETE /agents/:name`, and `POST /agents/:name/send` are deprecated migration endpoints: target behavior is blocked unless the request explicitly targets a Harness with the personal type. Coordination-type-backed members are listing/state only and `/agents/:name/send` rejects them instead of silently routing through.
- **Harnesses (lifecycle, substrate)** — `GET/POST /harnesses`, `GET/DELETE /harnesses/:key`, `GET /harnesses/:key/wait` (task-mode completion), `GET /harnesses/:key/status`, `POST /harnesses/:key/send`.
- **Harness substrate semantic state** — `GET /harnesses/:key/events`, `GET /harnesses/:key/tracks`, `GET /harnesses/:key/invocations`, `GET /harnesses/:key/wakes`, `GET /harnesses/:key/handoffs`.
- **Harness substrate tasks (migration source)** — `GET/POST /harnesses/:key/tasks`, `GET /harnesses/:key/tasks/:id`, `POST /harnesses/:key/tasks/:id/{dispatch,complete,abort}`. Decision 005 moves these to the task-tracking harness type; the substrate-side endpoints stay until the type lands. Mutating task APIs route through capability validation in the target shape.
- **Coordination-type endpoints** — `GET /harnesses/:key/channels`, `GET/DELETE /harnesses/:key/channels/:ch[/stream]`, `GET /harnesses/:key/inbox/:agent`, `GET /harnesses/:key/docs`, `GET/PUT/PATCH /harnesses/:key/docs/:name`. Mounted only on Harnesses whose type contributes channels/inbox/team docs. (See [harness-types/coordination.md](harness-types/coordination.md).)
- **Harness debug** — `GET /harnesses/:key/chronicle`, `GET /harnesses/:key/agent-scopes`, `POST /harnesses/:key/tool-call`. Chronicle/tool-call endpoints are audit/debug or migration surfaces, not the semantic state source.
- **Events** — `GET /events[/stream]` (cursor-based polling or SSE).

## Key mechanisms

**Thin CLI, fat daemon.** Every `aw` command goes through `AwClient` over HTTP. No CLI-local state, no alternate control paths. Web UI and MCP hub use the same client. This is why the daemon must stay up — CLI invocations are not self-contained.

**Auth by locality.** Requests from loopback (`127.0.0.1`, `localhost`, `::1`) and optionally Tailscale CGNAT ranges skip auth entirely. Anything else requires the machine-scoped bearer token from the discovery file. No per-user accounts.

**One Harness registry, one event bus.** The daemon's `HarnessRegistry` holds `ManagedHarness` instances regardless of type; per-type registration of `HarnessType` definitions happens via the substrate's `HarnessTypeRegistry`, which is process-scoped. Removing a runtime actor must not delete Harness state unless the Harness API says so. All runtime telemetry converges on the EventBus, which remains global audit plumbing rather than semantic Harness state.

**Orchestrator owns active Harness work; substrate stays passive.** The substrate exposes raw intake/evidence stores, semantic event stores, Track projection skeletons, context packet builders, capability validation contracts, invocation records, and execution ledgers. `HarnessOrchestrator` is the active loop: read pending events/invocations, request a bounded context packet (substrate sections + type contributions via `consumeExtension`), route protected dispatch/mutation/tool/extractor effects through the capability boundary, rebuild per-run tools with the active Wake id, dispatch through a per-agent runner closure, run `produceExtension` at Handoff write, classify errors, backoff/retry on quota or failed extraction, and notify operators on fatal failures. This split is why Harness semantics can be reused with different execution strategies.

**Runtime is chosen before Harness dispatch.** `resolve-runtime.ts` + `loop-factory.ts` commit the loop implementation for a runtime actor or run. MCP config is written to a temp file per-loop and cleaned up on disposal; OAuth-declaring MCP entries are rejected up front. Runtime choice does not decide context, tools, policy, or long-term memory; the Harness does.

**Recovery is manifest + idempotent semantic replay, not process resurrection.** `HarnessRegistry` persists Harness manifests and restores them on daemon start; `ManagedHarness` restarts each Harness's orchestrators from the resolved config and file-backed substrate stores. Substrate state recovery is explicit: type-contributed inbox entries are reloaded during migration, orphaned running Wakes are stamped failed with a HarnessEvent so future dispatch can proceed, and terminal Wakes / Handoffs without matching extracted HarnessEvents are re-extracted. Runtime session continuity is delegated to the loop factory and backend-specific state files, currently Codex's per-agent `codex-thread.json`.

**Protected effect retry is invocation-keyed.** The daemon retries protected work by stable `invocationId` / idempotency key. It must observe committed state writes, dispatch records, worktree operations, resource records, extractor outputs, and external outbox entries before retrying. If an external effect cannot prove whether it committed, the orchestrator records a blocked HarnessEvent and asks for operator/human resolution instead of replaying it blindly.

**Control policy is resolved before runtime invocation.** Harness config loading resolves `HarnessDef.policy` + `AgentDef.policy` into each `ResolvedAgent`. `harness-registry.ts` passes those fields into runtime creation/invocation, where they become backend options (`permissionMode`, `fullAuto`, `sandbox`) alongside `cwd`, `allowedPaths`, `env`, and MCP servers. The daemon does not invent a generic autonomy mode; it translates resolved policy into runtime-native controls.

## Non-goals

- Distributing across multiple daemon processes.
- Per-user auth or multi-tenant isolation.
- Command-line-local state (no `~/.aw/state` that bypasses the daemon).
- Hot-swapping runtimes on a live agent.
- A universal approval UI or git-command policy layer.
- Privileging any one `HarnessType` in the daemon's HTTP / CLI / lifecycle surfaces. The substrate paths are universal; the type contributes additional paths but does not replace them.
