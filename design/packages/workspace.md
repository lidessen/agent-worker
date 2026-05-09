# packages/workspace — Design

> The passive `WorkspaceHarness` kernel: raw intake/audit stores, semantic `WorkspaceEvent` stream, resource pointers, rebuildable Track and task projections, runtime-boundary records (`Wake` / `Handoff`), protected invocation records, context packet builders, capability validation contracts, on-demand worktrees, and the MCP tool server that exposes workspace capabilities to runtime actors. Active orchestration stays in `packages/agent-worker/`. (See [../decisions/005-session-orchestration-model.md](../decisions/005-session-orchestration-model.md): Task moves out of the kernel into a harness-layer projection; `Attempt` was renamed to `Wake`; `Artifact` is being merged into `Resource`.)

See [../DESIGN.md](../DESIGN.md) for how the orchestrator consumes this package.

## Internal shape

```
┌───────────────────────── Workspace ─────────────────────────┐
│                                                              │
│   ChannelStore / InboxStore                                  │
│      └─ raw intake + audit evidence                          │
│                                                              │
│   SignalStore ─► WorkspaceEventStore                         │
│                    └─ semantic facts for L1+ context          │
│                                                              │
│   StatusStore   TimelineStore   ChronicleStore               │
│      └─ audit / legacy evidence surfaces                     │
│                                                              │
│   ResourceStore   DocumentStore                              │
│      └─ addressable long content, artifacts, evidence         │
│                                                              │
│   WorkspaceStateStore                                        │
│     Track projection                                         │
│     task projection (built by task-tracking harness;         │
│                       NOT a kernel record)                   │
│     CapabilityInvocation (protected write/effect record)     │
│     runtime-boundary records: Wake ─► Handoff (core + ext.)  │
│                                                              │
│   ChannelBridge ──► adapters/ (Telegram, Webhook, …)         │
│                                                              │
│   CapabilityBoundary / reducer / extractor contracts         │
│   ContextPacketBuilder ─► renderPromptDocument(...)          │
│                                                              │
│   WorkspaceMcpHub (per-agent HTTP MCP sessions)              │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
  worktree.ts
  (git worktree add/remove/list)
```

## Modules

**Top-level.**
- `workspace.ts` — the `Workspace` class: wires raw stores, semantic event stores, resources, projections, channel bridge, migration-era instruction queue, state store; registers agents; lifecycle `init / stop`.
- `factory.ts` — `createWorkspace()` builds shared infrastructure; `createAgentTools()` binds tools + context packet/rendering sections to an agent identity.
- `mcp-server.ts` — `WorkspaceMcpHub`: HTTP MCP server, per-agent session scoping, identity extraction, per-run tool rebinding with `activeWakeId`.
- `worktree.ts` — thin wrapper over `git worktree add/remove/list`; callers provide branch names, while runtime allocates Wake-scoped paths under `workspace-data/<workspaceKey>/worktrees/<wakeId>/<name>`.
- `types.ts` — `Message`, `InboxEntry`, `Instruction`, `Priority`, `Signal`, `WorkspaceEvent`, `ContextPacket`, `CapabilityInvocation`, `TimelineEvent`, `Resource`, `Document`, `ChannelAdapter`, `WorkspaceConfig`.
- `utils.ts` — `nanoid`, `extractMentions`, `extractAddressedMentions`.

**`context/`** — stores + providers. `provider.ts` composes a `CompositeContextProvider` over independent stores; `storage.ts` abstracts `MemoryStorage` (tests) vs `FileStorage` (prod); `bridge.ts` routes channel events to external adapters with anti-loop guards. `stores/` has one file per store (channel, inbox, document, resource, status, timeline, chronicle, and target semantic event stores). `mcp/` holds the tool implementations and packet/rendering surfaces.

**`state/`** — semantic workspace state and runtime-boundary ledger. `types.ts` defines `Track` projection, `CapabilityInvocation`, and the runtime-boundary records `Wake` and `Handoff` (`Handoff` carries a generic core plus a per-harness extension map keyed by `harnessTypeId`); `store.ts` is the interface; `file-store.ts` is the on-disk implementation. The store itself is passive — accepted reducers and orchestrator lifecycle calls apply protected mutations after capability validation. **Tasks are not stored here** — they are projections owned by a task-tracking harness, computed over the event stream. Existing `Task` / `Artifact` records and tools are migration source; `Task` moves out, `Artifact` merges with `Resource`.

**`loop/`** — dispatch/context primitives used by the orchestrator. `priority-queue.ts` implements the migration-era three-lane `InstructionQueue` with bandwidth quotas and background promotion. `prompt.tsx` renders context packets to prompt documents. `lead-hooks.ts` is legacy/migration scaffolding until event reducers and extractors fully replace chronicle-driven lead updates.

**`config/`** — YAML workspace loader. Parses the definition, interpolates templates (`${{ workspace.tag }}`), resolves model/connection specs, handles secrets.

**`adapters/`** — external-platform bridges. Today: Telegram. Each implements `ChannelAdapter`: subscribe to `ChannelBridge`, map inbound external messages to channel appends, push channel appends back to the platform with anti-loop tagging.

## Context packet and prompt rendering

`ContextPacketBuilder` is the semantic context boundary. It reads WorkspaceEvents, Resources, Track projections, task projections (from the task-tracking harness), pending invocations, prior Handoffs (including any per-harness extension via `consumeExtension`), agent identity, and active Wake worktrees, then builds a bounded packet for one context layer.

Initial implementation scope is:

- workspace coordination context
- task execution context

Governance/review and observation contexts are extension profiles, not required first-phase machinery. They should be introduced only when protected invocations need delegated/collective authority or external observation workflows require their own packet shape.

The packet is generated by system code, not handwritten by agents. Raw channel history, full runtime transcripts, tool outputs, daemon events, and chronicle/timeline entries are not included by default; they can be opened through audit/read tools and then promoted into WorkspaceEvents or evidence refs.

`assemblePrompt` / `renderPromptDocument` are renderers. During migration they may still accept `PromptSection`s, but the target responsibility is packet-to-prompt rendering, not deciding which long-term workspace facts exist.

## MCP tool surface

Tools are grouped; each group has a narrow purpose:

- `channel_*` — `send`, `read`, `list`, `join`, `leave` over named channels. Channel messages are raw intake/audit; semantic state changes require extraction or reducer promotion into WorkspaceEvents.
- `inbox_*` — migration/notification evidence tools (`my_inbox`, `my_inbox_ack`, `my_inbox_defer`, `my_status_set`) for legacy per-agent queues. They are not a target long-term context lane; target dispatch reads WorkspaceEvents/invocations and context packets. New workflow state must be promoted through reducers/extractors before it can shape L1+ context.
- `event_*` / `signal_*` — read semantic WorkspaceEvents and raw Signals; write paths are reducer/extractor mediated.
- `track_*` — read Track projections and linked facts; Track updates come from WorkspaceEvents, not direct agent summary edits.
- `task_*` — `create`, `update`, `list`, `dispatch`, `get`. Migration surface: under decision 005 these become tools provided by the task-tracking harness, not kernel-resident; the kernel-side implementations remain temporarily until the harness lands.
- `wake_*` + `worktree_*` — `wake_list`, `wake_get`, `worktree_create`, `worktree_remove`, `worktree_list`. `worktree_*` are only visible while a Wake is active. (Migration source: the existing `attempt_*` tools are renamed.)
- `handoff_*` — structured cross-Wake transfer records. `handoff` writes commit a generic core plus an optional per-harness extension produced by the harness's `produceExtension` hook; terminal handoffs feed extractors that produce WorkspaceEvents. The standalone `artifact_*` tool surface is deprecated; concrete outputs are referenced as `Resource`s.
- `capability_*` / `invocation_*` — validate, inspect, block, retry, or approve protected capability invocations. Each protected invocation carries a stable `invocationId` / idempotency key.
- `resource_*` — content-addressed blob storage; used by `smartSend` to offload long messages.
- `team_*` — `members`, `doc_read / write / append / list / create`.
- `chronicle_*` — legacy/audit decision log. It is not the semantic workspace state surface.
- `wait_inbox` — legacy blocking wait primitive for lead agents. Target orchestration should wait on tasks, invocations, WorkspaceEvents, or harness-defined completion conditions instead.

## Semantic state and execution ledger

- **Signal** — raw boundary input with source/evidence refs. It may normalize into zero or more WorkspaceEvents.
- **WorkspaceEvent** — semantic durable fact. It must remain understandable without the raw transcript; long content is referenced through Resources.
- **Track** — rebuildable continuity projection over WorkspaceEvents and Resources. It records current state, open questions, risks, watches, linked tasks, and the event that last updated it. It does not own policy or workflow.
- **CapabilityInvocation** — validated or blocked protected action request with a stable `invocationId` / idempotency key. Required for Wake dispatch, workspace state mutation, user-visible commitments, external side effects, resource/security changes, and governance changes. Read-only/audit-read paths stay lightweight.
- **Wake** — one short-lived agent instance (`status: running → completed | failed | cancelled | handed_off`, `worktrees[]`, `output`). Bounded by task completion, context window, or harness decision; renamed from `Attempt` per decision 005.
- **Handoff** — cross-Wake transfer with two parts:
  - **Generic core** (universal, every Handoff carries it): `closingWakeId`, `taskRef` (pointer into the harness's task projection), `summary`, `pending`, `decisions`, `blockers`, `resources` (refs to `Resource`s), `workLogPointer`, `kind: progress | blocked | completed | aborted`.
  - **Per-harness extension** (optional, harness-typed): a map keyed by `harnessTypeId`, populated by the harness's `produceExtension(wake, events, workLog)` hook on close, consumed by the next Wake's `consumeExtension(extension, packet)` hook on start. Cross-harness-type handoff drops extensions unless an explicit translation hook is registered. Extensions carry `schemaVersion` for evolution.

**Task** is no longer stored here — it is a projection owned by a task-tracking harness over the WorkspaceEvent stream (decision 005). Existing `Task` types stay temporarily as migration source until the harness lands.

**Artifact** is being merged into `Resource` (decision 005, deferred consequence). Concrete outputs are referenced as `Resource`s.

Relations: `WorkspaceEvent` can reference Tracks, task-projection refs, Wakes, Handoffs, Resources, Signals, and invocation records. `Wake → Handoff` via `closingWakeId`; resources produced during a Wake reference the Wake via `createdByWakeId`. Wake / Handoff are L0 operational records — not rebuildable projections. Wake terminal state is not the long-term semantic fact by itself; extractor output is the WorkspaceEvent.

## Worktree lifecycle

Worktrees are created on-demand via the `worktree_create` tool inside a running Wake, not preallocated. The caller chooses the branch name; runtime owns collision-free path allocation under the Wake. On Wake terminal status (`completed | failed | cancelled | handed_off`), worktrees for that Wake are removed; **branches are left as audit trail.** Per-run tool rebinding in `WorkspaceMcpHub` attaches the `activeWakeId`, which is why `worktree_*` tools appear iff a Wake is active.

## Instruction queue policy

Three lanes: `immediate | normal | background`.

- **Bandwidth:** 4 consecutive `immediate` dispatches force 1 `normal` if pending; 8 consecutive high-priority dispatches force 1 `background`. Prevents lane starvation.
- **Promotion:** `background` items promote to `normal` after a wait threshold or when their `preemptionCount` reaches the configured threshold. The current code does not yet increment `preemptionCount`, so wait-time promotion is the operative path.
- **Planned cooperative preemption:** `shouldYield()` is the intended scheduler signal for a future explicit checkpoint/yield tool. The queue can answer whether a higher-priority item is waiting, but current orchestration only preempts at run boundaries; it does not transparently interrupt or resume arbitrary in-flight LLM work.

## Multi-instance via tag

A workspace defined by one YAML can run multiple isolated instances (`--tag pr-123`, `--tag staging`). Tag isolates everything — channels, inbox, docs, resources, status, timeline, chronicle, WorkspaceEvents, Tracks, invocations, and execution ledgers. Tag is available in templates as `${{ workspace.tag }}` and in factory as `tag` (drives `storageDir`, default `/tmp/agent-worker-<name>-<tag>/`).

## Key mechanisms

**Passive semantic kernel.** Every component here either stores, indexes, validates, projects, or renders context. Polling, wakeup, error handling, retry, extractor execution, and dispatch live in `WorkspaceOrchestrator` over in `packages/agent-worker/`. This separation is intentional: orchestration can be swapped without touching kernel invariants.

**Append-only evidence, semantic events, rebuildable Track projections.** Channels, chronicle, timeline, inbox, and runtime logs remain append-only audit/evidence surfaces. `WorkspaceEvent` is the append-only semantic fact stream. Track views are projections over events/resources; execution records are explicit operational state. If a Track projection conflicts with events, events win and the projection can be rebuilt.

**Inbox holds references, not content.** Channels own the message bodies; each agent's inbox holds `{ messageId, state }`. Selective ack means an agent can ignore a message without dropping the conversation; messages remain in the channel log.

**Composite provider pattern.** Stores are behind narrow interfaces (`ChannelStoreInterface`, `InboxStoreInterface`, …). `CompositeContextProvider` fans method calls to the right store. This is the seam that lets tests swap `MemoryStorage` for `FileStorage` without touching tool code. `smartSend` is the canonical cross-store orchestration: long messages create a `Resource` and post a short channel reference.

**Capability validation is the protected write/effect gate.** Mutating tools, reducers, planner outputs, extractors, HTTP APIs, and orchestrator actions submit typed capability invocations for protected effects. Validation checks binding ids, evidence refs, preconditions, authority, and idempotency key before state mutation, runtime dispatch, external side effects, or user-visible commitments. Failure writes blocked/retry WorkspaceEvents instead of silently no-oping or letting the model decide.

**Protected invocation idempotency.** Every protected effect binds to `invocationId`: state writes, dispatch records, worktree mutations, artifact records, extractor outputs, and external outbox entries. Recovery observes already-committed effects by key, retries missing idempotent effects, and blocks non-idempotent external effects unless a durable outbox/commit record proves their status.

**Extraction is the execution return boundary.** Wakes and Handoffs are L0 operational records. They become L1+ context only after an extractor produces WorkspaceEvents and projection updates. Extractor output is idempotently keyed by Wake / Handoff / resource refs and extractor version so restart recovery can fill missing facts without duplicates.

**WorkspaceMcpHub is the workspace tool boundary.** Runtime actors do not mutate kernel state by importing stores directly. They receive workspace tools through `WorkspaceMcpHub` or direct AI SDK tool injection built from the same tool factories, as granted by `WorkspaceHarness` for a run. The hub scopes each session to an agent identity, exposes channel/inbox/event/track/task/resource/team/chronicle/capability tools, and rebuilds Wake-scoped worktree tools only when an `activeWakeId` exists. External debug clients use supervisor endpoints rather than impersonating normal agents.

**Anti-loop on the bridge.** Messages tagged `telegram:*` (or any `<platform>:*`) are not redelivered to the originating adapter. The same pattern supports Slack / Webhook without a dedicated anti-loop per adapter.

## Non-goals

- Polling the instruction queue or pending invocation/event queues (orchestrator's job).
- Running loops (orchestrator calls `loop.run` with an assembled prompt).
- Executing extractors or retry policy (orchestrator's job).
- Holding runtime-local state or personal-agent state (`AgentRuntime` sessions, personal memory, todos).
- Cross-workspace communication — channels are workspace-local.
- Transactional multi-store writes — idempotent semantic events, execution records, and rebuildable projections are the contract.
- Raw transcript as default long-term workspace context.
- Governance ceremony for read-only tools, audit reads, or low-risk local status updates.
