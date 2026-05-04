# Agent-Worker — Design

> A local daemon that runs long-lived AI agents (Claude Code, Codex, Cursor, AI SDK, Mock) in two modes — **standalone** agents with an internal runtime, and **workspaces** of coordinated agents sharing a kernel state store — over pluggable LLM backends with event-first JSONL persistence.

## Sub-scope docs

Per-package design docs live under [packages/](packages/). Read this file first for the system shape, then drop into the package doc for internal organization.

| Doc | Scope |
| --- | --- |
| [packages/agent-worker.md](packages/agent-worker.md) | Daemon, CLI, HTTP surface, registries, orchestrator |
| [packages/agent.md](packages/agent.md) | Standalone agent runtime (inbox / todos / memory / context) |
| [packages/workspace.md](packages/workspace.md) | Workspace kernel — channels, inbox, queue, ledger, MCP tools |
| [packages/loop.md](packages/loop.md) | `AgentLoop` abstraction + per-backend implementations |
| [packages/shared.md](packages/shared.md) | Cross-cutting plumbing (event bus, JSONL, CLI colors) |
| [packages/web.md](packages/web.md) | Web UI (semajsx SPA) |

Architectural decisions (ADRs) live in [decisions/](decisions/).

## Architecture

Two execution paths share one daemon, one event bus, and one loop abstraction. They branch at the HTTP surface and **do not share any agent-runtime state** — see Key Mechanisms.

```
                   ┌────────────────────────────────────────────────┐
                   │                    daemon                      │
POST /agents       │  ┌─ standalone path ─────────────────────────┐ │
POST /agents/:n/   │  │ ManagedAgent ──wraps── Agent              │ │
  send           ──┼─►│                         │                 │ │
                   │  │                         ├─ RunCoordinator │ │
                   │  │                         │  (decision,     │ │
                   │  │                         │   history,      │ │
                   │  │                         │   memory)       │ │
                   │  │                         ├─ ContextEngine  │ │
                   │  │                         │  .assemble()    │ │
                   │  │                         ├─ Inbox / Todos  │ │
                   │  │                         │  / Notes / Mem  │ │
                   │  │                         └─ loop.run({sys, │ │
                   │  │                            prompt})       │ │
                   │  └────────────────────────────────────────────┘ │
                   │                                                │
POST /workspaces   │  ┌─ workspace path ──────────────────────────┐ │
POST /ws/:k/send ──┼─►│ ManagedWorkspace                          │ │
                   │  │  ├─ channels + InstructionQueue            │ │
                   │  │  ├─ kernel state store                     │ │
                   │  │  │   (Task / Attempt / Handoff /           │ │
                   │  │  │    Artifact + worktrees)                │ │
                   │  │  └─ WorkspaceOrchestrator                  │ │
                   │  │      ├─ workspace.assemblePrompt            │ │
                   │  │      │   (channels + ledger + worktrees)    │ │
                   │  │      └─ runner(prompt) ──► loop.run(prompt) │ │
                   │  │          (per-run tools injected)           │ │
                   │  │      GlobalAgentStub surfaces each agent    │ │
                   │  │      at /agents for listing                 │ │
                   │  └────────────────────────────────────────────┘ │
                   │                                                │
                   │         loop (AiSdk / ClaudeCode / Codex /     │
                   │          Cursor / Mock) ─► LoopEvent stream    │
                   │                      │                         │
                   │                      ▼                         │
                   │                 EventBus ─► JSONL logs         │
                   └────────────────────────────────────────────────┘
```

## Modules

**`packages/agent-worker/`** — daemon, CLI, HTTP, orchestration.
_Does:_ Hono HTTP server (`/agents`, `/workspaces`, `/events`), `aw` CLI entry, `AgentRegistry` + `ManagedAgent` for standalone agents, `WorkspaceRegistry` + `ManagedWorkspace` + `WorkspaceOrchestrator` + runner closures for workspace agents, loop factory, MCP config generation, per-run logs, `GlobalAgentStub` so workspace agents are listable at `/agents`.
_Doesn't:_ implement loops, define agent subsystems, or define workspace kernel types.

**`packages/agent/`** — standalone agent runtime (standalone path only).
_Does:_ `Agent` class wiring `Inbox` / `TodoManager` / `MemoryManager` / `ContextEngine` / `ReminderManager`; `RunCoordinator` owns `shouldContinue` → `executeRun` (assemble dashboard prompt → run loop → persist Turns → memory checkpoints); lifecycle hooks (checkpoint, context-pressure). Re-exports `AgentLoop` type for consumers.
_Doesn't:_ participate in workspaces, know about channels, or coordinate with other agents. Workspace mode never instantiates `Agent`.

**`packages/workspace/`** — workspace kernel for multi-agent coordination.
_Does:_ `Workspace` definition (channels, `InstructionQueue`, context providers, `WorkspaceStateStore` for `Task` / `Attempt` / `Handoff` / `Artifact`), `assemblePrompt(sections, ctx)` + `BASE_SECTIONS`, MCP tools (channel / inbox / task / resource / team / chronicle / worktree), attempt-scoped git worktree provisioning, per-attempt tool rebinding.
_Doesn't:_ poll queues (that's the orchestrator), run loops, or hold any standalone-agent state.

**`packages/loop/`** — pluggable LLM backends.
_Does:_ `AgentLoop` interface + implementations (`AiSdkLoop`, `ClaudeCodeLoop`, `CodexLoop`, `CursorLoop`, `MockLoop`); streaming `LoopEvent` (text / thinking / tool_call_* / usage / error); optional `setTools` (AI SDK direct injection), `setMcpServers` (SDK runtimes with structured MCP), and `setMcpConfig` (config-file runtimes).
_Doesn't:_ know about agents, workspaces, inboxes, or how the prompt was assembled.

**`packages/shared/`** — cross-cutting plumbing.
_Does:_ synchronous in-process `EventBus`, JSONL read/append helpers, CLI colors, runtime detection.
_Doesn't:_ emit events itself — it only provides the channels.

## Data Flow

Workspace path — the load-bearing one:

```
POST /workspaces/:key/send {channel, content}
      │
      ▼
ManagedWorkspace.send ─► contextProvider.send ─► channel router
                                                    │
                                                    ▼
                                            InboxEntry per subscriber
                                                    │
      ▼ (poll interval, or wake on enqueue)         │
WorkspaceOrchestrator.tick                          │
      ├─ inbox.peek → enqueue new entries as Instruction ◄┘
      ├─ queue.dequeue → Instruction
      ├─ buildPrompt:
      │     ├─ stateStore.findActiveAttempt → worktrees for this run
      │     └─ workspace.assemblePrompt(BASE_SECTIONS + per-agent sections, ctx)
      ├─ onCheckpoint("run_start") → may inject prologue
      └─ onInstruction(prompt, instruction)
              │
              ▼
      createInstructionHandler wrapper (emits run_start/run_end bus events,
      classifies errors, auto-pauses on quota, notifies lead on fatal)
              │
              ▼
      runner closure (createRunner):
              ├─ (first run) createWorkspaceMcpConfig → temp JSON config for CLI runtimes
              ├─ rebuild per-run tools with activeAttemptId (worktree_* shows iff mid-attempt)
              ├─ loop.setTools(aiSdkTools)  |  loop.setMcpConfig(path)
              └─ for await (event of loop.run(prompt)):
                      ├─ EventBus.emit(BusEvent)
                      ├─ per-run log append
                      └─ workspace.eventLog.log (text / tool_call)
              │
              ▼
      inbox.ack(messageId) on ok, inbox.defer on throw
      onCheckpoint("run_end") → inject-to-queue if returned
      status → idle
```

Standalone path skips channels / queue / stateStore entirely: `POST /agents/:name/send` → `ManagedAgent` → `Agent.push` (enqueues into `Inbox`) → `RunCoordinator.shouldContinue()` picks `next_message` / `next_todo` / `idle` → `executeRun` → `ContextEngine.assemble({instructions, inbox, todos, notes, memory, reminders, history, name})` → `loop.run({system, prompt: notification+snapshot})` → events streamed to per-agent JSONL.

Core types: `BusEvent` (shared), `LoopEvent` (loop), `Instruction` / `InboxEntry` / `PromptSection` / `Task` / `Attempt` / `Handoff` / `Artifact` / `Worktree` (workspace), `AgentState` / `Turn` / `AssembledPrompt` (agent).

## Key Mechanisms

**Two parallel execution paths.** The daemon runs two independent agent runtimes side-by-side. Standalone mode (`/agents`) uses the full `packages/agent/` runtime: `RunCoordinator` decides what to run next from inbox/todos/reminders, `ContextEngine` assembles a dashboard-style system prompt from agent-local state, event-level memory checkpoints extract facts during the stream. Workspace mode (`/workspaces`) bypasses all of that: `WorkspaceOrchestrator` polls an `InstructionQueue`, `workspace.assemblePrompt` builds a workspace-contextualized prompt (channels, ledger, worktrees), and the runner calls `loop.run(prompt)` directly with per-run tools injected. They share only the `AgentLoop` interface (a type) and the event bus. Knowing which path you're on is prerequisite to any agent-worker code change.

**Event-first JSONL persistence.** Every activity — loop events, inbox state, responses, chronicle, timeline, per-run logs — appends to JSONL files via the process-level `EventBus`. Emitters don't know consumers; tailers (UI stream, `aw log`, replay) subscribe + read from disk. Crash recovery and UI resume are both log replay, so there's no separate snapshot path to keep in sync.

**Loop abstraction decouples runtime from backend.** `AgentLoop` is minimal: `run(prompt)` returning a streaming `LoopEvent` iterable, plus optional `setTools` / `setMcpServers` / `setMcpConfig`. AI SDK loops inject workspace tools directly via `prepareStep`; SDK-backed loops (Claude Code, Cursor) receive structured MCP server objects; config-file runtimes (Codex) receive generated config and run the workspace MCP tool server as a stdio subprocess. Tool capability is committed once per run. Runtime is chosen at agent-create time via `RuntimeConfig.type` and can be swapped without touching agent or workspace code.

**Workspace kernel state (Task → Attempt → Handoff → Artifact) with attempt-scoped worktrees.** The workspace owns multi-agent coordination records, not the agent. A `Task` is a unit of work; an `Attempt` is one runtime execution with lifecycle-bound resources; a `Handoff` is an explicit shift with decisions/blockers/next-steps; `Artifact`s point to concrete outputs. Git worktrees are created on-demand by `worktree_*` MCP tools during a running attempt, bound to its lifecycle, and torn down at terminal status — branches survive as audit trail. Per-run tool rebuilding attaches `activeAttemptId` so `worktree_*` tools are visible only while an attempt is active.

**Restart recovery is workspace-led, with runtime-local session continuity.** Daemon restart restores workspace manifests, workspace state stores, status, inbox references, chronicle/timeline/docs/resources, and active workspace loops. Running attempts recovered from disk are marked failed with a chronicle entry rather than silently resumed as if the process never died. Provider session continuity stays runtime-local: Codex persists a `threadIdFile`; other runtimes may add their own session files later. The workspace ledger and chronicle are the durable cross-runtime recovery surface, not a universal transcript store.

**Control boundaries are resolved from workspace policy into runtime knobs.** Workspace YAML can define `policy` at workspace and agent scope; agent fields override workspace fields one by one. The resolved policy flows into runtime config as concrete backend controls such as Claude Code `permissionMode`, Codex `fullAuto`, and Codex `sandbox`. Filesystem scope is still expressed as runner `cwd` plus `allowedPaths`, with attempt worktrees and shared sandbox paths attached per run. Git-specific policy, approval UI, and bash-level command guards remain outside the current design.

## Key Decisions

**Single long-lived daemon, not per-command subprocess.** Daemon holds agents + workspaces in memory; CLI commands are thin HTTP clients. _Rejected:_ spawn a fresh agent per CLI call like `codex` does. _Why:_ multi-agent workspaces need shared channels, queue, and kernel state store — a per-call subprocess can't coordinate a team.

**`WorkspaceOrchestrator` in `agent-worker/`, not `workspace/`.** Workspace is passive (stores state, answers queries, enqueues); orchestrator is active (polls queue, dispatches to runner, handles errors/auto-pause/lead notification). The class was literally moved here from `workspace/WorkspaceAgentLoop` — the file header records it. _Rejected:_ keep polling inside `workspace/`. _Why:_ workspace semantics stay reusable across execution strategies; orchestration is swappable without touching the kernel.

**Standalone and workspace as parallel paths, not one path subsuming the other.** Workspace mode bypasses `packages/agent/` entirely — no `RunCoordinator`, no `ContextEngine`, no memory manager; workspace agents surface at `/agents` only via `GlobalAgentStub`. Standalone mode doesn't touch the workspace kernel. _Rejected:_ make workspace agents instances of standalone agents with a channels subsystem bolted on. _Why:_ keeps both paths honest — standalone is a minimal one-shot runtime, workspace is coordination-first. Fusing them would force agent to know channels and workspace to know agent memory, coupling both sides to irrelevant concerns.

**Attempt-scoped worktrees, not per-agent globals.** Worktrees are created on-demand by a tool call within a running attempt and torn down at terminal status; branches survive. _Rejected:_ pre-allocate one worktree per agent at workspace startup. _Why:_ clean task isolation, no cross-task branch pollution, no git state in workspace schema, deterministic cleanup driven by attempt lifecycle.

## Constraints

- **Single user.** Daemon auth is a machine-wide bearer token; loopback/localhost skip auth entirely. No per-user accounts.
- **Local-first.** Default bind is loopback; remote access via Tailscale. No cloud sync.
- **Bun runtime.** App code is Bun; library code uses Node APIs for compatibility.
- **Static tool capability per run.** Tool set is committed before `loop.run()` starts; no mid-run capability changes.
- **Runtime-local usage/session semantics.** Context usage and provider session ids stay inside loop implementations because each backend reports and resumes differently.
- **OAuth-declaring MCP servers rejected.** `readAgentMcpConfig` throws if a server entry has an `oauth` field.
- **Config-file MCP runtimes over stdio only.** Codex deadlocked on HTTP MCP transport, so config-file MCP generation uses the stdio subprocess path. SDK runtimes should prefer structured MCP server objects when their SDK exposes that surface.

## Non-goals

- Multi-workspace federation across daemons.
- Cross-run persistent memory stores (memory re-hydrates from JSONL inbox / notes / chronicle; nothing beyond).
- Direct agent-to-agent messaging — all traffic goes through channels and inbox.
- Transactional guarantees across kernel state updates — eventual consistency via the event log is the contract.
- Universal transcript persistence across all runtimes — workspace ledger, chronicle, notes, memory, and runtime-local session files are the recovery contract.
- Non-local runtimes (remote SSH, cloud runners).
- Unifying standalone and workspace modes into one runtime.
