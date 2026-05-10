# packages/harness — Design

> The passive `Harness` substrate: an agent's work environment as universal mechanism, parameterized by `HarnessType`. Holds the semantic `HarnessEvent` stream, raw `Signal` intake, `Resource` / `Document` content, runtime-boundary records (`Wake` / `Handoff` / `CapabilityInvocation`), the capability validation contract, the projection mechanisms (Track / chronicle / timeline / status — skeleton; vocabulary supplied by the type), the on-demand resource-provisioning mechanism (worktrees and similar), the `ContextPacketBuilder`, and the `HarnessMcpHub` that exposes harness capabilities to runtime actors. Active orchestration stays in `packages/agent-worker/`. (See [../decisions/006-harness-as-agent-environment.md](../decisions/006-harness-as-agent-environment.md): the `Workspace` class is renamed `Harness` and its coordination-flavored stores move into a peer `MultiAgentCoordinationHarnessType`. See [../decisions/005-session-orchestration-model.md](../decisions/005-session-orchestration-model.md): Task moves into a harness-layer projection; `Attempt` was renamed to `Wake`; `Artifact` is being merged into `Resource`.)

See [../DESIGN.md](../DESIGN.md) for how the orchestrator consumes this package, and [harness-types/coordination.md](harness-types/coordination.md) for what the multi-agent coordination type plugs in.

## Internal shape

```
┌─────────────────────────── Harness ─────────────────────────┐
│                                                              │
│   substrate (universal — every HarnessType inherits)         │
│   ───────────────────────────────────────────────             │
│                                                              │
│   SignalStore ─► HarnessEventStore                           │
│                    └─ semantic facts for L1+ context          │
│                                                              │
│   ResourceStore   DocumentStore                              │
│      └─ addressable long content, evidence                   │
│                                                              │
│   HarnessStateStore                                          │
│     Track projection (skeleton; lane vocabulary from type)   │
│     CapabilityInvocation (protected write/effect record)     │
│     runtime-boundary records: Wake ─► Handoff (core + ext.)  │
│                                                              │
│   ChronicleStore   TimelineStore   StatusStore               │
│      └─ projection mechanisms; entry schemas from type       │
│                                                              │
│   CapabilityBoundary / reducer / extractor contracts         │
│   ContextPacketBuilder ─► renderPromptDocument(...)          │
│                                                              │
│   HarnessTypeRegistry ──► HarnessType (id, hooks, content)   │
│      └─ produceExtension at Handoff write                    │
│         consumeExtension at packet build                     │
│                                                              │
│   HarnessMcpHub (per-agent HTTP MCP sessions)                │
│                                                              │
│   wake-scoped resource provisioning (e.g. worktrees)         │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
  type-specific contributions
  (channels, inbox, channel bridge, telegram, … — see
   harness-types/coordination.md for the coordination type)
```

## Modules

**Top-level.**
- `harness.ts` — the `Harness` class: wires substrate stores, projections, hook registry, state store, type registry; lifecycle `init / stop`. Constructed with one `HarnessType`, fixed for the instance's lifetime.
- `factory.ts` — `createHarness(config, type)` builds substrate infrastructure and applies the type's contributions; `createAgentTools()` binds tools + context packet/rendering sections to an agent identity.
- `mcp-server.ts` — `HarnessMcpHub`: HTTP MCP server, per-agent session scoping, identity extraction, per-run tool rebinding with `activeWakeId`. Exposes substrate tools plus the type's contributed tools.
- `worktree.ts` — thin wrapper over `git worktree add/remove/list`. Wake-scoped resource provisioning is substrate; today only the coding-flavored Harness types call it. Path allocation is `harness-data/<harnessKey>/worktrees/<wakeId>/<name>`.
- `types.ts` — `Signal`, `HarnessEvent`, `ContextPacket`, `CapabilityInvocation`, `TimelineEvent`, `Resource`, `Document`, `HarnessConfig`, plus the substrate-level base types of records that types may extend.
- `utils.ts` — `nanoid`, `extractMentions`, `extractAddressedMentions`.

**`context/`** — stores + providers. `provider.ts` composes a `CompositeContextProvider` over independent stores; `storage.ts` abstracts `MemoryStorage` (tests) vs `FileStorage` (prod). `stores/` has one file per substrate store (signal, event, document, resource, status, timeline, chronicle). Type-specific stores (channels, inbox) are contributed by the type — see [harness-types/coordination.md](harness-types/coordination.md). `mcp/` holds substrate tool implementations and the packet/rendering surfaces.

**`state/`** — semantic state and runtime-boundary ledger. `types.ts` defines `Track` projection, `CapabilityInvocation`, and the runtime-boundary records `Wake` and `Handoff` (`Handoff` carries a generic core plus a per-harness-type extension map keyed by `harnessTypeId`, and an optional `harnessTypeId` field naming which type was authoritative); `store.ts` is the interface; `file-store.ts` is the on-disk implementation. The store itself is passive — accepted reducers and orchestrator lifecycle calls apply protected mutations after capability validation. **Tasks are not stored here** — they are projections owned by a task-tracking harness type, computed over the event stream. Existing `Task` / `Artifact` records and tools are migration source; `Task` moves to a harness-type projection, `Artifact` merges with `Resource`.

**`type/`** — `HarnessType` interface, `HarnessTypeRegistry`, default no-op type, hook-invocation helpers (`runProduceExtension`, `runConsumeExtension`). One in-memory registry per process, accessed by Handoff write sites and `ContextPacketBuilder`. The kernel does not inspect extension payloads — it delegates to the registered type. Failure semantics (per decision 005): `produceExtension` throw is logged and Handoff core is still written; `consumeExtension` throw rethrows as a Wake-startup blocker.

**`config/`** — YAML harness loader. Parses the definition, interpolates templates (`${{ harness.tag }}`), resolves model/connection specs, handles secrets. The substrate config schema covers identity, tag, storage, and the chosen `harnessTypeId`; type-specific schema (e.g. channel definitions for the coordination type) is delegated to the type's own loader.

## Context packet and prompt rendering

`ContextPacketBuilder` is the semantic context boundary. It reads HarnessEvents, Resources, Track projections, task projections (from the task-tracking harness type), pending invocations, prior Handoffs (running them through the registered type's `consumeExtension` for the per-type extension), agent identity, and active Wake-scoped resources, then builds a bounded packet for one context layer. The type contributes additional packet sections by registering builders against the substrate's section enumeration.

The packet is generated by system code, not handwritten by agents. Raw channel history (when present), full runtime transcripts, tool outputs, daemon events, and chronicle/timeline entries are not included by default; they can be opened through audit/read tools and then promoted into HarnessEvents or evidence refs.

`assemblePrompt` / `renderPromptDocument` are renderers. The target responsibility is packet-to-prompt rendering, not deciding which long-term harness facts exist.

## MCP tool surface

Substrate tools are present on every Harness regardless of type. The type contributes additional tool groups; see the type's doc.

- `event_*` / `signal_*` — read semantic HarnessEvents and raw Signals; write paths are reducer/extractor mediated.
- `track_*` — read Track projections and linked facts; Track updates come from HarnessEvents, not direct agent summary edits.
- `wake_*` + `worktree_*` — `wake_list`, `wake_get`, `worktree_create`, `worktree_remove`, `worktree_list`. `worktree_*` are only visible while a Wake is active.
- `handoff_*` — structured cross-Wake transfer records. `handoff_create` writes the generic core plus the per-type extension produced by the registered type's `produceExtension` hook; terminal handoffs feed extractors that produce HarnessEvents.
- `capability_*` / `invocation_*` — validate, inspect, block, retry, or approve protected capability invocations. Each protected invocation carries a stable `invocationId` / idempotency key.
- `resource_*` — content-addressed blob storage; used by long-message offload helpers.
- `chronicle_*` — substrate decision log mechanism; entry schemas / vocabulary supplied by the type.
- `task_*` — `create`, `update`, `list`, `dispatch`, `get`. Migration surface: under decision 005 these become tools provided by the task-tracking harness type, not substrate-resident; the substrate-side implementations remain temporarily until the type lands.

## Semantic state and execution ledger

- **Signal** — raw boundary input with source/evidence refs. Normalizes into zero or more HarnessEvents.
- **HarnessEvent** — semantic durable fact. Must remain understandable without the raw transcript; long content is referenced through Resources.
- **Track** — rebuildable continuity projection over HarnessEvents and Resources. Records current state, open questions, risks, watches, linked tasks, and the event that last updated it. Lane vocabulary (e.g. "incident / feature thread / release lane") is supplied by the registered HarnessType. Does not own policy or workflow.
- **CapabilityInvocation** — validated or blocked protected action request with a stable `invocationId` / idempotency key. Required for Wake dispatch, harness state mutation, user-visible commitments, external side effects, resource/security changes, and governance changes. Read-only/audit-read paths stay lightweight.
- **Wake** — one short-lived agent instance (`status: running → completed | failed | cancelled | handed_off`). Bounded by task completion, context window, or harness decision. Wake-scoped resource provisioning (e.g. git worktrees, type-specific scratch) is released on terminal status.
- **Handoff** — cross-Wake transfer with two parts:
  - **Generic core** (universal, every Handoff carries it): `closingWakeId`, `taskRef`, `summary`, `pending`, `decisions`, `blockers`, `resources`, `workLogPointer`, `kind: progress | blocked | completed | aborted`.
  - **Per-type extension** (optional, type-typed): a map keyed by `harnessTypeId`, populated by the type's `produceExtension(wake, events, workLog)` hook on close, consumed by the next Wake's `consumeExtension(extension, packet)` hook on start. Cross-type handoff drops extensions unless an explicit translation hook is registered. Extensions carry `schemaVersion` for evolution. The `Handoff` record also has an optional `harnessTypeId` field naming which type was authoritative.

**Task** is no longer stored here — it is a projection owned by a task-tracking harness type over the HarnessEvent stream (decision 005). Existing `Task` types stay temporarily as migration source until the type lands.

**Artifact** is being merged into `Resource` (decision 005). Concrete outputs are referenced as `Resource`s.

Relations: `HarnessEvent` can reference Tracks, task-projection refs, Wakes, Handoffs, Resources, Signals, and invocation records. `Wake → Handoff` via `closingWakeId`; resources produced during a Wake reference the Wake via `createdByWakeId`. Wake / Handoff are L0 operational records. Wake terminal state is not the long-term semantic fact by itself; extractor output is the HarnessEvent.

## Worktree lifecycle

Worktrees are created on-demand via the `worktree_create` tool inside a running Wake, not preallocated. The caller chooses the branch name; runtime owns collision-free path allocation under the Wake. On Wake terminal status, worktrees for that Wake are removed; **branches are left as audit trail.** Per-run tool rebinding in `HarnessMcpHub` attaches the `activeWakeId`, which is why `worktree_*` tools appear iff a Wake is active. Worktree is the first concrete user of substrate Wake-scoped resource provisioning; type-specific scratch resources follow the same lifecycle.

## Multi-instance via tag

A Harness defined by one YAML can run multiple isolated instances (`--tag pr-123`, `--tag staging`). Tag isolates everything in the substrate (signals, events, resources, status, timeline, chronicle, Tracks, invocations, execution ledgers) and is propagated to type-specific stores too. Tag is available in templates as `${{ harness.tag }}` and in factory as `tag` (drives `storageDir`, default `/tmp/agent-worker-<name>-<tag>/`).

## Key mechanisms

**Substrate + HarnessType composition.** A `Harness` instance is the substrate plus exactly one `HarnessType`, fixed at construction. The substrate provides mechanism (event stream, resource store, projection skeletons, capability boundary, MCP hub, hook registry) that every type wants regardless of what its agents are doing. The type provides content (type-specific stores, projection vocabulary, MCP tools, capability invocations, packet sections) that's specific to the kind of work the agents are doing. Cross-type read happens through substrate surfaces (Resource refs, HarnessEvent stream, Track skeleton), never through direct cross-type-store imports. Promotion-to-substrate is the planned correction path if a "type-specific" piece turns out universal.

**Passive semantic substrate.** Every component here either stores, indexes, validates, projects, or renders context. Polling, wakeup, error handling, retry, extractor execution, and dispatch live in `HarnessOrchestrator` over in `packages/agent-worker/`. This separation is intentional: orchestration can be swapped without touching substrate invariants.

**Append-only evidence, semantic events, rebuildable projections.** Chronicle, timeline, and runtime logs remain append-only audit/evidence surfaces. `HarnessEvent` is the append-only semantic fact stream. Track views are projections over events/resources; execution records are explicit operational state. If a projection conflicts with events, events win and the projection can be rebuilt.

**Composite provider pattern.** Stores are behind narrow interfaces. `CompositeContextProvider` fans method calls to the right store. This is the seam that lets tests swap `MemoryStorage` for `FileStorage` without touching tool code, and the seam type-contributed stores plug into.

**Capability validation is the protected write/effect gate.** Mutating tools, reducers, planner outputs, extractors, HTTP APIs, and orchestrator actions submit typed capability invocations for protected effects. Validation checks binding ids, evidence refs, preconditions, authority, and idempotency key before state mutation, runtime dispatch, external side effects, or user-visible commitments. Failure writes blocked/retry HarnessEvents instead of silently no-oping or letting the model decide.

**Protected invocation idempotency.** Every protected effect binds to `invocationId`: state writes, dispatch records, worktree mutations, resource records, extractor outputs, and external outbox entries. Recovery observes already-committed effects by key, retries missing idempotent effects, and blocks non-idempotent external effects unless a durable outbox/commit record proves their status.

**Extraction is the execution return boundary.** Wakes and Handoffs are L0 operational records. They become L1+ context only after an extractor produces HarnessEvents and projection updates. Extractor output is idempotently keyed by Wake / Handoff / resource refs and extractor version so restart recovery can fill missing facts without duplicates.

**HarnessType hook protocol.** Each registered `HarnessType` is identified by a stable `id` and optionally declares two hooks: `produceExtension` runs at Handoff write to build the per-type payload from the closing Wake's events plus the work log; `consumeExtension` runs at packet build to inject prior-Handoff extension content into the next Wake's `ContextPacket`. The `HarnessTypeRegistry` is a single in-memory map keyed by id, accessed by every Handoff write site (`handoff_create` MCP tool, daemon close-task path, orphan recovery) and by `ContextPacketBuilder`. All sites go through the registry's invocation helpers — no site invokes a hook directly. Failure semantics are asymmetric: a `produceExtension` throw is logged via the harness event log and the Handoff core is still written (missing extension is recoverable, missing core is not); a `consumeExtension` throw rethrows as a Wake-startup blocker per decision 005. Cross-type handoff drops extensions unless a translation hook is registered — that boundary is the `HarnessType` contract's responsibility, not the substrate's.

**HarnessMcpHub is the harness tool boundary.** Runtime actors do not mutate substrate state by importing stores directly. They receive harness tools through `HarnessMcpHub` or direct AI SDK tool injection built from the same tool factories, as granted by the Harness for a run. The hub scopes each session to an agent identity, exposes substrate tool groups plus the type's contributed tool groups, and rebuilds Wake-scoped tools only when an `activeWakeId` exists. External debug clients use supervisor endpoints rather than impersonating normal agents.

## Non-goals

- Polling pending invocation/event queues (orchestrator's job).
- Running loops (orchestrator calls `loop.run` with an assembled prompt).
- Executing extractors or retry policy (orchestrator's job).
- Holding runtime-local state or personal-agent state (`AgentRuntime` sessions, personal memory, todos).
- Cross-Harness communication — substrate stores are Harness-local. Cross-Harness collaboration goes through type-contributed channels or a higher-layer routing harness.
- Transactional multi-store writes — idempotent semantic events, execution records, and rebuildable projections are the contract.
- Raw transcript as default long-term harness context.
- Governance ceremony for read-only tools, audit reads, or low-risk local status updates.
- Type-specific content baked into the substrate. Channels, inbox, telegram bridge, and similar coordination-flavored stores live with the coordination type, not here.
