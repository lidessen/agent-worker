# Agent-Worker — Design

> A local daemon that runs harness-driven AI runtimes. A `Harness` is the agent's work environment — a universal substrate plus exactly one `HarnessType` that shapes its content. The harness decides context, tools, policy, recovery, and return semantics; `AgentRuntime` executes the bounded run over pluggable LLM backends and streams event-first JSONL telemetry. The `MultiAgentCoordinationHarnessType` (channels, inbox, channel bridges) is the first mature type and uses a semantic harness-event stream as its long-term context.

## Sub-scope docs

Per-package design docs live under [packages/](packages/). Read this file first for the system shape, then drop into the package doc for internal organization.

| Doc | Scope |
| --- | --- |
| [packages/agent-worker.md](packages/agent-worker.md) | Daemon, CLI, HTTP surface, harness registries, harness orchestrator |
| [packages/orchestrator.md](packages/orchestrator.md) | Session orchestrator surface — unified entry above harnesses (Wake lifecycle, binding picker, resume) |
| [packages/agent.md](packages/agent.md) | `AgentRuntime` boundary, runtime context-budget signaling, migration source for historical standalone subsystems |
| [packages/harness.md](packages/harness.md) | `Harness` substrate — Signals, HarnessEvents, projections, capability boundary, Wake / Handoff records, MCP tools, `HarnessType` registry |
| [packages/harness-types/coordination.md](packages/harness-types/coordination.md) | `MultiAgentCoordinationHarnessType` — channels, inbox, channel bridges, team docs, lane vocabulary |
| [packages/loop.md](packages/loop.md) | `AgentLoop` abstraction + per-backend implementations |
| [packages/shared.md](packages/shared.md) | Cross-cutting plumbing (event bus, JSONL, CLI colors) |
| [packages/web.md](packages/web.md) | Web UI (semajsx SPA) |

Architectural decisions (ADRs) live in [decisions/](decisions/).

## Architecture

One daemon owns Harness lifecycles and invokes runtime actors through a common execution boundary. Harnesses, not runtimes, decide which context and tools exist for a run. Each Harness is the universal substrate plus exactly one `HarnessType`, fixed at construction.

```
                   ┌──────────────────────────────────────────────────┐
                   │                      daemon                      │
                   │                                                  │
HTTP / CLI / Web ──┼─► HarnessRegistry / lifecycle                    │
                   │       │                                          │
                   │       ├─ Harness (type=coordination)             │
                   │       │   ├─ substrate                           │
                   │       │   │   ├─ Signals + HarnessEvents         │
                   │       │   │   ├─ Resources + Track skeleton      │
                   │       │   │   ├─ chronicle/timeline/status mech. │
                   │       │   │   ├─ execution records (Wake / Hand) │
                   │       │   │   ├─ protected invocation records    │
                   │       │   │   ├─ ContextPacketBuilder            │
                   │       │   │   ├─ CapabilityBoundary              │
                   │       │   │   └─ HarnessTypeRegistry             │
                   │       │   └─ type contributions                  │
                   │       │       ├─ channels / inbox / bridge       │
                   │       │       ├─ Track lane vocabulary           │
                   │       │       └─ produce/consumeExtension hooks  │
                   │       │                                          │
                   │       ├─ Harness (type=task-tracking)            │
                   │       │   └─ task projection over events         │
                   │       │       (subscribes / dispatches reminder  │
                   │       │        events; tasks are projection)     │
                   │       │                                          │
                   │       └─ Harness (type=personal)?                │
                   │           (optional simple-agent product path)    │
                   │                                                  │
                   │  HarnessOrchestrator                             │
                   │     ├─ selects runtime binding                    │
                   │     ├─ grants tool capability set                 │
                   │     └─ extracts durable facts                     │
                   │                         │                        │
                   │                         ▼                        │
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
_Does:_ Hono HTTP server (`/agents`, `/harnesses`, `/events` during migration), `aw` CLI entry, Harness lifecycle/registries, `HarnessRegistry` + `ManagedHarness` + `HarnessOrchestrator`, runtime binding resolution, loop factory, MCP config generation, per-run logs, extraction/retry/recovery, and transitional listing/state surfaces for Harness members.
_Doesn't:_ implement backend loops, own long-term Harness context, or define Harness substrate types.

**`packages/agent/`** — `AgentRuntime` boundary and migration source for historical standalone subsystems.
_Does:_ target `AgentRuntime.run(binding, packet, capabilities, policy)` execution wrapper, runtime-local session continuity, loop invocation, streaming telemetry, run-scoped tool transport, and any shared helpers carved out of the old standalone implementation. During migration it still contains the historical `Agent` / inbox / todo / notes / memory subsystems.
_Doesn't:_ own Harness context, task state, long-term semantic memory, recovery policy, or authority. Personal/simple-agent behavior must live behind an explicit Harness type if it survives.

**`packages/harness/`** — passive Harness substrate (universal across all `HarnessType`s).
_Does:_ `Harness` definition; semantic `HarnessEvent` stream; raw `Signal` intake; `Resource` / `Document` content; rebuildable Track / chronicle / timeline / status projection mechanisms; runtime-boundary records (`Wake`, `Handoff`); protected invocation records; context packet builders; capability validation contracts; MCP/tool surfaces; `HarnessTypeRegistry` and hook-invocation helpers (`produceExtension` / `consumeExtension`); Wake-scoped resource provisioning (worktrees and similar). (See [decisions/006](decisions/006-harness-as-agent-environment.md): renamed from `packages/workspace/`; coordination-flavored stores moved to a peer type. See [decisions/005](decisions/005-session-orchestration-model.md): Task moves into a harness-type projection; `Artifact` merges with `Resource`.)
_Doesn't:_ hold type-specific stores (channels, inbox, bridges), poll queues, wake agents, run loops, execute extractors, retry failed work, or hold runtime-local/personal-agent state.

**`packages/harness/` + type contributions.** Each `HarnessType` plugs in type-specific stores, projection vocabulary, MCP tools, capability invocations, and Handoff hooks. The `MultiAgentCoordinationHarnessType` (today's only mature type — channels, inbox, channel bridges, telegram adapter) is documented in [packages/harness-types/coordination.md](packages/harness-types/coordination.md). Future types (coding, writing, manager-delegation, task-tracking, personal) follow the same plug-in shape.

**`packages/loop/`** — pluggable LLM backends.
_Does:_ `AgentLoop` interface + implementations (`AiSdkLoop`, `ClaudeCodeLoop`, `CodexLoop`, `CursorLoop`, `MockLoop`); streaming `LoopEvent` (text / thinking / tool_call_* / usage / error); optional `setTools` (AI SDK direct injection), `setMcpServers` (SDK runtimes with structured MCP), and `setMcpConfig` (config-file runtimes).
_Doesn't:_ know about harnesses, agents, channels, inboxes, or how the packet/prompt was assembled.

**`packages/shared/`** — cross-cutting plumbing.
_Does:_ synchronous in-process `EventBus`, JSONL read/append helpers, CLI colors, runtime detection.
_Doesn't:_ emit events itself — it only provides the channels.

## Data Flow

Harness path (coordination type — today's only mature type):

```
POST /harnesses/:key/send {channel, content}
      │
      ▼
ManagedHarness.send ─► raw channel message / Signal     (channel store: type-contributed)
      │
      ▼
normalize / reducer
      │
      ▼
HarnessEvent (semantic fact, independently understandable)   (substrate)
      │
      ▼
projection update (Track views + pending invocation views)   (substrate skeleton, type vocab)
      │
      ▼
HarnessOrchestrator.tick
      ├─ read pending HarnessEvents / invocations
      ├─ ContextPacketBuilder builds bounded packet
      │     (substrate sections + type-contributed sections via consumeExtension)
      ├─ CapabilityBoundary gates protected writes/effects
      ├─ accepted dispatch → Wake + runner(packet)
      │     ├─ rebuild per-run tools with activeWakeId
      │     ├─ loop.setTools(aiSdkTools) | setMcpServers | setMcpConfig
      │     └─ for await (event of loop.run(prompt)):
      │             ├─ EventBus.emit(BusEvent)        # runtime telemetry
      │             ├─ per-run log append             # audit evidence
      │             └─ optional audit/evidence refs
      ├─ runtime returns ExecutionResult + HandoffDraft + resource refs
      ├─ HarnessTypeRegistry.runProduceExtension → committed Handoff (core + ext.)
      ├─ extractor derives HarnessEvent(s)
      └─ idempotent replay fills missing extraction after restart
```

Personal/simple-agent dispatch, if retained, must follow the same Harness shape: a Harness with type=`personal` owns inbox/todos/notes/memory contributions and builds a packet through the substrate's `ContextPacketBuilder`; `AgentRuntime` executes it. The historical `POST /agents/:name/send` -> `Agent.push` -> `RunCoordinator` path is migration source, not the target architecture. Target `/agents` dispatch is blocked unless explicitly mapped to a Harness with the personal type.

Core types: `BusEvent` (shared telemetry), `LoopEvent` (loop telemetry), `RuntimeBinding` / `ContextPacket` / `ToolCapabilitySet` / `RunPolicy` / `RuntimeTrace` / `ExecutionResult` / `HandoffDraft` (runtime boundary), `Signal` / `HarnessEvent` / `CapabilityInvocation` / `Track` / `Wake` / `Handoff` (core + per-type extension) / `Resource` / `Worktree` (Harness substrate), `HarnessType` / `HarnessTypeRegistry` (substrate hook + tool plug-in), `TaskProjection` (harness-type projection over events; not a substrate record), optional `AgentState` / `Turn` / `AssembledPrompt` only inside a personal/simple harness type migration.

## Key Mechanisms

**Harness = substrate + HarnessType.** A Harness instance is the universal substrate (event stream, resources, projection skeletons, capability boundary, MCP hub, hook registry, Wake-scoped resource provisioning) plus exactly one `HarnessType` plugged in at construction. The substrate provides mechanism every type wants; the type provides content (type-specific stores, Track lane vocabulary, MCP tools, capability invocations, packet sections, Handoff hooks). Cross-type read happens through substrate surfaces (Resource refs, HarnessEvent stream, Track skeleton), never through direct cross-type-store imports. See [decisions/006](decisions/006-harness-as-agent-environment.md).

**Harness-driven runtime boundary.** `AgentRuntime` is the execution subject, not the owner of context or backend choice. A Harness selects a `RuntimeBinding`, builds a `ContextPacket`, grants a `ToolCapabilitySet`, resolves a `RunPolicy`, invokes the runtime, commits accepted return records, then extracts durable facts from the result. The Harness consumes pending HarnessEvents / invocations, asks `ContextPacketBuilder` for a bounded packet (substrate sections + type-contributed sections), validates protected effects through the capability boundary, and dispatches accepted Wakes through runtime runner closures. A future personal/simple-agent path must also be a Harness type; it cannot make inbox/todos/memory the default responsibility of `AgentRuntime`.

**Event-first JSONL persistence.** Runtime activity — loop events, inbox state, responses, chronicle, timeline, per-run logs — appends to JSONL files via the process-level `EventBus`. Emitters don't know consumers; tailers (UI stream, `aw log`, replay) subscribe + read from disk. This event bus is telemetry/audit plumbing, not the Harness semantic fact layer. Crash recovery and UI resume are log replay, so there is no separate snapshot path to keep in sync.

**HarnessEvent is the substrate semantic-fact stream.** A Harness's long-term context is a semantic `HarnessEvent` stream. A `Signal` is raw boundary intake; a `HarnessEvent` is the durable fact that L1+ coordination can read without the original transcript. Raw channel messages (when present), runtime transcripts, tool outputs, daemon `BusEvent`s, chronicle, and timeline are evidence surfaces by default. Context is assembled by `ContextPacketBuilder` from HarnessEvents, Resources, and projections; type-contributed `consumeExtension` hooks layer in per-type sections; `assemblePrompt` renders the packet rather than deciding long-term state semantics.

**Loop abstraction decouples runtime from backend.** `AgentLoop` is minimal: `run(prompt)` returning a streaming `LoopEvent` iterable, plus optional `setTools` / `setMcpServers` / `setMcpConfig`. AI SDK loops inject granted tools directly via `prepareStep`; SDK-backed loops (Claude Code, Cursor) receive structured MCP server objects; config-file runtimes (Codex) receive generated config and run the Harness MCP tool server as a stdio subprocess. Tool capability is committed once per run. Runtime is selected before invocation via `RuntimeConfig.type` and can be swapped without changing harness semantics.

**Capability boundary as the protected write/effect gate.** The capability boundary is not one fixed step before every agent run. It is the shared gate whenever a reducer, planner, MCP tool call, extractor, HTTP API, or orchestrator action proposes a protected Harness mutation, Wake dispatch, user-visible commitment, external side effect, resource/security change, or governance change. Validation checks binding ids, evidence, preconditions, authority, and idempotency key, then either applies the effect or records a blocked/retry HarnessEvent. Read-only tools, audit reads, and low-risk local status updates stay lightweight and do not require governance ceremony.

**Wake is the bounded unit of agent execution; Handoff transfers state between Wakes.** A `Wake` is one short-lived agent instance — one runtime invocation bounded by task completion, context window, or harness decision. It replaces the previous kernel record `Attempt` (see [decisions/005](decisions/005-session-orchestration-model.md)). A `Handoff` is the structured transfer between two Wakes on the same task: a fixed generic core (`summary / pending / decisions / blockers / resources / workLogPointer`) plus an optional per-type extension produced by `produceExtension(wake, events, workLog)` and consumed by `consumeExtension(extension, packet)`. Different `HarnessType`s (coordination, coding, writing, manager-delegation, trading) define their own extension schemas. Wake / Handoff are L0 operational records; they become L1+ semantic context only when extractors turn them into HarnessEvents and projection updates. Tasks themselves are projections owned by a task-tracking harness type, not substrate records — that type subscribes to events and may dispatch reminders for unfinished work back into the event stream. `Artifact` is being merged into `Resource` (decision 005, deferred consequence). Extraction is idempotent: derived events are keyed by Wake / Handoff / resource refs and extractor version.

**Track projection skeleton; lane vocabulary from the type.** `Track` represents long-running continuity as a rebuildable projection over HarnessEvents and Resources. The substrate provides the projection mechanism; the registered `HarnessType` supplies the lane vocabulary (e.g. coordination's `incident / feature thread / release lane / watch / migration`; coding's branch/PR lanes when implemented). Track state must point back to the event that updated it. Track does not own policy, workflow, or execution; enforceable rules live in reducers and the capability boundary.

**Protected invocation idempotency anchor.** Every protected invocation has a stable `invocationId` / idempotency key. All state writes, dispatch records, worktree operations, resource records, extractor outputs, and external outbox entries caused by that invocation must bind to that key. Recovery replays by key: already-committed effects are observed, missing idempotent effects are retried, and non-idempotent external effects must have a durable outbox/commit record or remain blocked for human/operator resolution.

**Restart recovery is Harness-led, with runtime-local session continuity.** Daemon restart restores Harness manifests, substrate stores/projections, status, type-contributed stores (e.g. inbox references for the coordination type), resources, and active Harness loops. Running Wakes recovered from disk are marked failed with a HarnessEvent rather than silently resumed as if the process never died. Terminal Wakes / Handoffs without matching extracted HarnessEvents are re-extracted during recovery. Provider session continuity stays runtime-local: Codex persists a `threadIdFile`; other runtimes may add their own session files later. The HarnessEvent stream, resources, and runtime-local session files are the durable cross-runtime recovery surface, not a universal transcript store.

**Control boundaries are resolved from Harness policy into runtime knobs.** Harness YAML can define `policy` at Harness and agent scope; agent fields override Harness fields one by one. The resolved policy flows into runtime config as concrete backend controls such as Claude Code `permissionMode`, Codex `fullAuto`, and Codex `sandbox`. Filesystem scope is still expressed as runner `cwd` plus `allowedPaths`, with Wake worktrees and shared sandbox paths attached per run. Git-specific policy, approval UI, and bash-level command guards remain outside the current design.

## Key Decisions

**Attention-driven as system protocol, not only a skill.** The short-term
product target is a work-entry replacement subset for Claude Code / Codex, not
full CLI or chat parity. Backend runtimes are execution bindings; the product
shape is the harness protocol: requirement intake, bounded Wake execution,
observation, recovery, verification, blocked-work handling, and cross-runtime
continuity. Long term, the harness should become self-aware, self-adaptive,
and self-organizing through events, monitor signals, decision ownership,
Handoffs, and capability boundaries. See [decisions/009](decisions/009-attention-driven-system-protocol.md).

**Single long-lived daemon, not per-command subprocess.** Daemon holds Harnesses and runtime actors in memory; CLI commands are thin HTTP clients. _Rejected:_ spawn a fresh agent per CLI call like `codex` does. _Why:_ multi-agent Harnesses need shared intake, semantic events, projections, and execution state — a per-call subprocess can't coordinate a team.

**`HarnessOrchestrator` in `agent-worker/`, not `harness/`.** The Harness substrate is passive (stores state, answers queries, validates, projects, and renders context packets); orchestrator is active (polls pending work, dispatches to runner, invokes extractors, handles errors/auto-pause/operator notification). _Rejected:_ keep polling inside `harness/`. _Why:_ Harness semantics stay reusable across execution strategies; orchestration is swappable without touching the substrate.

**Harness = substrate + HarnessType, not a privileged Workspace class.** The old shape baked multi-agent-coordination flavor (channels, inbox, channel bridge, telegram) into the kernel under the name `Workspace`, forcing every other harness type to be modeled as a projection on top of it. The new shape: a universal substrate, plus `HarnessType` as the shape primitive (one type per Harness, fixed at construction). Today's coordination content moves into a peer `MultiAgentCoordinationHarnessType`; coding / writing / manager-delegation / personal types follow the same plug-in shape. _Rejected:_ keep `Workspace` central and add `HarnessType` as a sidecar. _Why:_ locks coordination flavor into the substrate name and makes every new type pay the cognitive tax of being modeled "on top of Workspace" — see [decisions/006](decisions/006-harness-as-agent-environment.md).

**AgentRuntime under harness types, not standalone-vs-workspace.** The old `/agents` runtime is no longer a peer architectural path. Every agent is a member of some Harness whose context/tools/policy come from the substrate plus a registered type. `packages/agent` is refactored toward the shared runtime boundary; the historical `workspace-client.ts` direction is removed. _Rejected:_ preserve standalone `Agent` as the default owner of inbox/todos/memory and make Harnesses a special case. _Why:_ that keeps context ownership in the wrong layer and makes every harness type adapt to agent-local state instead of explicitly supplying the run environment.

**Wake-scoped worktrees, not per-agent globals.** Worktrees are created on-demand by a tool call within a running Wake and torn down at terminal status; branches survive. _Rejected:_ pre-allocate one worktree per agent at Harness startup. _Why:_ clean task isolation, no cross-task branch pollution, no git state in substrate schema, deterministic cleanup driven by Wake lifecycle.

**HarnessEvent over raw transcript as the long-term context subject.** Every Harness uses semantic events and projections for long-term continuity, while L0 Wakes keep raw conversations local to execution and audit evidence. _Rejected:_ keep channels, timeline, chronicle, and prompt sections as competing long-term state surfaces. _Why:_ multi-day and multi-agent work needs high-density facts, bounded context packets, and replayable projections rather than a growing chat transcript.

## Constraints

- **Single user.** Daemon auth is a machine-wide bearer token; loopback/localhost skip auth entirely. No per-user accounts.
- **Local-first.** Default bind is loopback; remote access via Tailscale. No cloud sync.
- **Bun runtime.** App code is Bun; library code uses Node APIs for compatibility.
- **Static tool capability per run.** Tool set is committed before `loop.run()` starts; no mid-run capability changes.
- **Runtime-local usage/session semantics.** Context usage and provider session ids stay inside loop implementations because each backend reports and resumes differently.
- **Harness semantic facts are extracted, not self-asserted.** Raw tool output, runtime transcript, and worker prose do not become L1/L2 context until a reducer/extractor promotes them into HarnessEvents.
- **Idempotent extraction/replay.** Terminal Wakes and Handoffs must be re-extractable after restart; duplicate extraction is ignored by stable keys.
- **Protected effects bind to invocation ids.** Protected writes and external effects must be recoverable by stable invocation id / idempotency key; non-idempotent effects require durable outbox/commit records or fail closed.
- **OAuth-declaring MCP servers rejected.** `readAgentMcpConfig` throws if a server entry has an `oauth` field.
- **Config-file MCP runtimes over stdio only.** Codex deadlocked on HTTP MCP transport, so config-file MCP generation uses the stdio subprocess path. SDK runtimes should prefer structured MCP server objects when their SDK exposes that surface.

## Non-goals

- Multi-Harness federation across daemons.
- Hidden standalone memory/context systems inside `AgentRuntime`; long-lived context belongs to a Harness.
- Direct agent-to-agent private messaging — traffic goes through Harness intake surfaces such as type-contributed channels, tasks, and optional personal inboxes.
- Transactional guarantees across substrate state updates — idempotent HarnessEvents, execution records, and rebuildable projections are the contract.
- Universal transcript persistence across all runtimes — HarnessEvents/resources/projections and runtime-local session files are the recovery contract.
- Raw transcript as default Harness long-term context.
- Governance ceremony for read-only tools, audit reads, or low-risk local status updates.
- Non-local runtimes (remote SSH, cloud runners).
- Treating coordination as the only possible `HarnessType`. Coding, writing, manager-delegation, task-tracking, and personal types are peers, not subtypes of coordination.
- Type-specific stores baked into the substrate. Channels, inbox, telegram bridge, and similar belong to the registering `HarnessType`, not the universal layer.
