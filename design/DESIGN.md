# Agent-Worker — Design

> A local daemon that runs harness-driven AI runtimes. A harness decides context, tools, policy, recovery, and return semantics; `AgentRuntime` executes the bounded run over pluggable LLM backends and streams event-first JSONL telemetry. `WorkspaceHarness` is the first mature harness implementation and uses a semantic workspace event stream as its long-term context.

## Sub-scope docs

Per-package design docs live under [packages/](packages/). Read this file first for the system shape, then drop into the package doc for internal organization.

| Doc | Scope |
| --- | --- |
| [packages/agent-worker.md](packages/agent-worker.md) | Daemon, CLI, HTTP surface, harness registries, orchestrators |
| [packages/agent.md](packages/agent.md) | `AgentRuntime` boundary and migration source for historical standalone subsystems |
| [packages/workspace.md](packages/workspace.md) | `WorkspaceHarness` kernel — Signals, WorkspaceEvents, projections, capability boundary, MCP tools |
| [packages/loop.md](packages/loop.md) | `AgentLoop` abstraction + per-backend implementations |
| [packages/shared.md](packages/shared.md) | Cross-cutting plumbing (event bus, JSONL, CLI colors) |
| [packages/web.md](packages/web.md) | Web UI (semajsx SPA) |

Architectural decisions (ADRs) live in [decisions/](decisions/).

## Architecture

One daemon owns harness lifecycles and invokes runtime actors through a common execution boundary. Harnesses, not runtimes, decide which context and tools exist for a run.

```
                   ┌──────────────────────────────────────────────────┐
                   │                      daemon                      │
                   │                                                  │
HTTP / CLI / Web ──┼─► HarnessRegistry / lifecycle                    │
                   │       │                                          │
                   │       ├─ WorkspaceHarness                        │
                   │       │   ├─ Signals + WorkspaceEvents           │
                   │       │   ├─ Resources + rebuildable Track views │
                   │       │   ├─ execution records                   │
                   │       │   │   (Task / Attempt / Handoff / Art.)  │
                   │       │   ├─ protected invocation records        │
                   │       │   ├─ ContextPacketBuilder                │
                   │       │   ├─ CapabilityBoundary                  │
                   │       │   └─ WorkspaceOrchestrator               │
                   │       │       ├─ selects runtime binding         │
                   │       │       ├─ grants tool capability set      │
                   │       │       └─ extracts durable facts          │
                   │       │                                          │
                   │       └─ PersonalHarness?                        │
                   │           (optional simple-agent product path)    │
                   │                                                  │
                   │  RuntimeBinding + ContextPacket + ToolCapabilitySet
                   │  + RunPolicy                                     │
                   │                         │                        │
                   │                         ▼                        │
                   │                  AgentRuntime                    │
                   │                         │                        │
                   │                         ▼                        │
                   │     loop (AiSdk / ClaudeCode / Codex / Cursor /  │
                   │            Mock) ─► LoopEvent stream             │
                   │                         │                        │
                   │                         ▼                        │
                   │                 EventBus ─► JSONL logs           │
                   └──────────────────────────────────────────────────┘
```

## Modules

**`packages/agent-worker/`** — daemon, CLI, HTTP, orchestration.
_Does:_ Hono HTTP server (`/agents`, `/workspaces`, `/events` during migration), `aw` CLI entry, harness lifecycle/registries, `WorkspaceRegistry` + `ManagedWorkspace` + `WorkspaceOrchestrator`, runtime binding resolution, loop factory, MCP config generation, per-run logs, extraction/retry/recovery, and transitional listing/state surfaces for harness members.
_Doesn't:_ implement backend loops, own long-term harness context, or define workspace kernel types.

**`packages/agent/`** — `AgentRuntime` boundary and migration source for historical standalone subsystems.
_Does:_ target `AgentRuntime.run(binding, packet, capabilities, policy)` execution wrapper, runtime-local session continuity, loop invocation, streaming telemetry, run-scoped tool transport, and any shared helpers carved out of the old standalone implementation. During migration it still contains the historical `Agent` / inbox / todo / notes / memory subsystems.
_Doesn't:_ own workspace context, task state, long-term semantic memory, recovery policy, or authority. Personal/simple-agent behavior must live behind an explicit harness if it survives.

**`packages/workspace/`** — passive workspace kernel for multi-agent coordination.
_Does:_ `Workspace` definition; raw channels/inbox as intake and audit evidence; semantic `WorkspaceEvent` stream; resource pointers; rebuildable Track projections; execution records (`Task`, `Attempt`, `Handoff`, `Artifact`); protected invocation records; context packet builders; capability validation contracts; MCP/tool surfaces that submit typed invocations; attempt-scoped git worktree provisioning.
_Doesn't:_ poll queues, wake agents, run loops, execute extractors, retry failed work, or hold runtime-local/personal-agent state.

**`packages/loop/`** — pluggable LLM backends.
_Does:_ `AgentLoop` interface + implementations (`AiSdkLoop`, `ClaudeCodeLoop`, `CodexLoop`, `CursorLoop`, `MockLoop`); streaming `LoopEvent` (text / thinking / tool_call_* / usage / error); optional `setTools` (AI SDK direct injection), `setMcpServers` (SDK runtimes with structured MCP), and `setMcpConfig` (config-file runtimes).
_Doesn't:_ know about harnesses, agents, workspaces, inboxes, or how the packet/prompt was assembled.

**`packages/shared/`** — cross-cutting plumbing.
_Does:_ synchronous in-process `EventBus`, JSONL read/append helpers, CLI colors, runtime detection.
_Doesn't:_ emit events itself — it only provides the channels.

## Data Flow

WorkspaceHarness path — the first mature harness:

```
POST /workspaces/:key/send {channel, content}
      │
      ▼
ManagedWorkspace.send ─► raw channel message / Signal
      │
      ▼
normalize / reducer
      │
      ▼
WorkspaceEvent (semantic fact, independently understandable)
      │
      ▼
projection update (Track views + pending invocation views)
      │
      ▼
WorkspaceOrchestrator.tick
      ├─ read pending WorkspaceEvents / invocations
      ├─ ContextPacketBuilder builds bounded packet
      ├─ CapabilityBoundary gates protected writes/effects
      ├─ accepted dispatch → Task / Attempt + runner(packet)
      │     ├─ rebuild per-run tools with activeAttemptId
      │     ├─ loop.setTools(aiSdkTools) | setMcpServers | setMcpConfig
      │     └─ for await (event of loop.run(prompt)):
      │             ├─ EventBus.emit(BusEvent)        # runtime telemetry
      │             ├─ per-run log append             # audit evidence
      │             └─ optional audit/evidence refs
      ├─ runtime returns ExecutionResult + HandoffDraft / ArtifactCandidate refs
      ├─ harness commits Handoff / Artifact records
      ├─ extractor derives WorkspaceEvent(s)
      └─ idempotent replay fills missing extraction after restart
```

Personal/simple-agent dispatch, if retained, must follow the same harness shape: a `PersonalHarness` owns inbox/todos/notes/memory and builds a packet; `AgentRuntime` executes it. The historical `POST /agents/:name/send` -> `Agent.push` -> `RunCoordinator` path is migration source, not the target architecture. Target `/agents` dispatch is blocked unless explicitly mapped to `PersonalHarness`.

Core types: `BusEvent` (shared telemetry), `LoopEvent` (loop telemetry), `RuntimeBinding` / `ContextPacket` / `ToolCapabilitySet` / `RunPolicy` / `RuntimeTrace` / `ExecutionResult` / `HandoffDraft` / `ArtifactCandidate` (runtime boundary), `Signal` / `WorkspaceEvent` / `CapabilityInvocation` / `Track` / `Task` / `Attempt` / `Handoff` / `Artifact` / `Worktree` (workspace harness), optional `AgentState` / `Turn` / `AssembledPrompt` only inside a personal/simple harness migration.

## Key Mechanisms

**Harness-driven runtime boundary.** `AgentRuntime` is the execution subject, not the owner of context or backend choice. A harness selects a `RuntimeBinding`, builds a `ContextPacket`, grants a `ToolCapabilitySet`, resolves a `RunPolicy`, invokes the runtime, commits accepted return records, then extracts durable facts from the result. `WorkspaceHarness` consumes pending workspace events/invocations, asks `ContextPacketBuilder` for a bounded packet, validates protected effects through the capability boundary, and dispatches accepted attempts through runtime runner closures. A future personal/simple-agent path must also be a harness; it cannot make inbox/todos/memory the default responsibility of `AgentRuntime`.

**Event-first JSONL persistence.** Runtime activity — loop events, inbox state, responses, chronicle, timeline, per-run logs — appends to JSONL files via the process-level `EventBus`. Emitters don't know consumers; tailers (UI stream, `aw log`, replay) subscribe + read from disk. This event bus is telemetry/audit plumbing, not the workspace semantic fact layer. Crash recovery and UI resume are log replay, so there is no separate snapshot path to keep in sync.

**Workspace event harness core.** Workspace mode's long-term context is a semantic `WorkspaceEvent` stream. A `Signal` is raw boundary intake; a `WorkspaceEvent` is the durable fact that L1+ coordination can read without the original transcript. Raw channel messages, runtime transcripts, tool outputs, daemon `BusEvent`s, chronicle, and timeline are evidence surfaces by default. Context is assembled by `ContextPacketBuilder` from WorkspaceEvents, Resources, and projections; `assemblePrompt` renders the packet rather than deciding long-term state semantics.

**Loop abstraction decouples runtime from backend.** `AgentLoop` is minimal: `run(prompt)` returning a streaming `LoopEvent` iterable, plus optional `setTools` / `setMcpServers` / `setMcpConfig`. AI SDK loops inject granted tools directly via `prepareStep`; SDK-backed loops (Claude Code, Cursor) receive structured MCP server objects; config-file runtimes (Codex) receive generated config and run the harness MCP tool server as a stdio subprocess. Tool capability is committed once per run. Runtime is selected before invocation via `RuntimeConfig.type` and can be swapped without changing harness semantics.

**Capability boundary as the protected write/effect gate.** The capability boundary is not one fixed step before every agent run. It is the shared gate whenever a reducer, planner, MCP tool call, extractor, HTTP API, or orchestrator action proposes a protected workspace mutation, task/attempt dispatch, user-visible commitment, external side effect, resource/security change, or governance change. Validation checks binding ids, evidence, preconditions, authority, and idempotency key, then either applies the effect or records a blocked/retry WorkspaceEvent. Read-only tools, audit reads, and low-risk local status updates stay lightweight and do not require governance ceremony.

**Execution return via extraction.** `Task → Attempt → Handoff → Artifact` is the execution record chain, not a pure projection and not the long-term memory model. A `Task` is an executable unit; an `Attempt` is one L0 runtime execution with lifecycle-bound resources; a `Handoff` is a structured execution report; `Artifact`s point to concrete outputs. These records are operational source state for dispatch, recovery, and audit. They become L1+ semantic context only when an extractor turns Handoff/Artifact/evidence into WorkspaceEvents and Track projection updates. Extraction is idempotent: derived events are keyed by attempt/handoff/artifact refs and extractor version, so restart recovery can re-run missing extraction without duplicating facts.

**Track projections, not Track truth.** `Track` represents long-running continuity — incident, feature thread, release lane, watch, migration — as a rebuildable projection over WorkspaceEvents and Resources. Track state must point back to the event that updated it. Track does not own policy, workflow, or execution; enforceable rules live in reducers and the capability boundary.

**Protected invocation idempotency anchor.** Every protected invocation has a stable `invocationId` / idempotency key. All state writes, dispatch records, worktree operations, artifact records, extractor outputs, and external outbox entries caused by that invocation must bind to that key. Recovery replays by key: already-committed effects are observed, missing idempotent effects are retried, and non-idempotent external effects must have a durable outbox/commit record or remain blocked for human/operator resolution.

**Restart recovery is workspace-led, with runtime-local session continuity.** Daemon restart restores workspace manifests, workspace stores/projections, status, inbox references, resources, and active workspace loops. Running attempts recovered from disk are marked failed with a WorkspaceEvent rather than silently resumed as if the process never died. Terminal attempts/handoffs without matching extracted WorkspaceEvents are re-extracted during recovery. Provider session continuity stays runtime-local: Codex persists a `threadIdFile`; other runtimes may add their own session files later. The workspace event stream, resources, and runtime-local session files are the durable cross-runtime recovery surface, not a universal transcript store.

**Control boundaries are resolved from workspace policy into runtime knobs.** Workspace YAML can define `policy` at workspace and agent scope; agent fields override workspace fields one by one. The resolved policy flows into runtime config as concrete backend controls such as Claude Code `permissionMode`, Codex `fullAuto`, and Codex `sandbox`. Filesystem scope is still expressed as runner `cwd` plus `allowedPaths`, with attempt worktrees and shared sandbox paths attached per run. Git-specific policy, approval UI, and bash-level command guards remain outside the current design.

## Key Decisions

**Single long-lived daemon, not per-command subprocess.** Daemon holds harnesses and runtime actors in memory; CLI commands are thin HTTP clients. _Rejected:_ spawn a fresh agent per CLI call like `codex` does. _Why:_ multi-agent workspaces need shared intake, semantic events, projections, and execution state — a per-call subprocess can't coordinate a team.

**`WorkspaceOrchestrator` in `agent-worker/`, not `workspace/`.** Workspace is passive (stores state, answers queries, validates, projects, and renders context packets); orchestrator is active (polls pending work, dispatches to runner, invokes extractors, handles errors/auto-pause/operator notification). The class was literally moved here from `workspace/WorkspaceAgentLoop` — the file header records it. _Rejected:_ keep polling inside `workspace/`. _Why:_ workspace semantics stay reusable across execution strategies; orchestration is swappable without touching the kernel.

**AgentRuntime and HarnessEnvironment, not standalone-vs-workspace.** The old `/agents` runtime is no longer a peer architectural path. Workspace agents are harness members whose context/tools/policy are supplied by `WorkspaceHarness`; personal/simple agents, if kept, are harness members whose context/tools/policy are supplied by `PersonalHarness`. `packages/agent` should be refactored toward the shared runtime boundary plus optional personal-harness pieces, and the historical `workspace-client.ts` direction should be removed. _Rejected:_ preserve standalone `Agent` as the default owner of inbox/todos/memory and make workspaces a special case. _Why:_ that keeps context ownership in the wrong layer and makes every harness adapt to agent-local state instead of explicitly supplying the run environment.

**Attempt-scoped worktrees, not per-agent globals.** Worktrees are created on-demand by a tool call within a running attempt and torn down at terminal status; branches survive. _Rejected:_ pre-allocate one worktree per agent at workspace startup. _Why:_ clean task isolation, no cross-task branch pollution, no git state in workspace schema, deterministic cleanup driven by attempt lifecycle.

**WorkspaceEvent over raw transcript as the workspace context subject.** Workspace mode uses semantic events and projections for long-term coordination, while L0 attempts keep raw conversations local to execution and audit evidence. _Rejected:_ keep channels, timeline, chronicle, and prompt sections as competing long-term state surfaces. _Why:_ multi-day and multi-agent work needs high-density facts, bounded context packets, and replayable projections rather than a growing chat transcript.

## Constraints

- **Single user.** Daemon auth is a machine-wide bearer token; loopback/localhost skip auth entirely. No per-user accounts.
- **Local-first.** Default bind is loopback; remote access via Tailscale. No cloud sync.
- **Bun runtime.** App code is Bun; library code uses Node APIs for compatibility.
- **Static tool capability per run.** Tool set is committed before `loop.run()` starts; no mid-run capability changes.
- **Runtime-local usage/session semantics.** Context usage and provider session ids stay inside loop implementations because each backend reports and resumes differently.
- **Workspace semantic facts are extracted, not self-asserted.** Raw tool output, runtime transcript, and worker prose do not become L1/L2 context until a reducer/extractor promotes them into WorkspaceEvents.
- **Idempotent extraction/replay.** Terminal attempts and handoffs must be re-extractable after restart; duplicate extraction is ignored by stable keys.
- **Protected effects bind to invocation ids.** Protected writes and external effects must be recoverable by stable invocation id / idempotency key; non-idempotent effects require durable outbox/commit records or fail closed.
- **OAuth-declaring MCP servers rejected.** `readAgentMcpConfig` throws if a server entry has an `oauth` field.
- **Config-file MCP runtimes over stdio only.** Codex deadlocked on HTTP MCP transport, so config-file MCP generation uses the stdio subprocess path. SDK runtimes should prefer structured MCP server objects when their SDK exposes that surface.

## Non-goals

- Multi-workspace federation across daemons.
- Hidden standalone memory/context systems inside `AgentRuntime`; long-lived context belongs to a harness.
- Direct agent-to-agent private messaging — traffic goes through harness intake surfaces such as channels, tasks, and optional personal inboxes.
- Transactional guarantees across kernel state updates — idempotent WorkspaceEvents, execution records, and rebuildable projections are the contract.
- Universal transcript persistence across all runtimes — workspace events/resources/projections and runtime-local session files are the recovery contract.
- Raw transcript as default workspace long-term context.
- Governance ceremony for read-only tools, audit reads, or low-risk local status updates.
- Non-local runtimes (remote SSH, cloud runners).
- Treating `WorkspaceHarness` as the only possible harness implementation.
