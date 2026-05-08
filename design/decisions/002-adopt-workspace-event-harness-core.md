# Adopt Workspace Event Harness Core

**Status:** adopted
**Date:** 2026-05-04

**Supersession note:** ADR 003 supersedes this document's statement that
standalone `/agents` stays separate from workspace mode. The WorkspaceEvent
harness core remains adopted, but the broader agent model is now
`HarnessEnvironment -> AgentRuntime`.

## Context

The current workspace design still treats channels, inbox entries, the
instruction queue, chronicle, timeline, and the `Task -> Attempt -> Handoff ->
Artifact` ledger as the main long-running coordination surface. That works for
short workspace runs, but it keeps too much long-term state tied to chat-like
transcripts and prompt sections. The harness direction in `DESIGN-NEXT.md`
points at a cleaner shape: L0 conversations execute tasks, while L1+ workspace
coordination consumes durable, high-density facts.

## Recommendation

Adopt a workspace event harness core for workspace mode. The workspace's
long-term context becomes a semantic `WorkspaceEvent` stream, not raw channel
history, timeline events, tool traces, or worker transcripts. External inputs
enter as `Signal`s and normalize into `WorkspaceEvent`s; deterministic internal
lifecycle changes may produce `WorkspaceEvent`s directly through reducers.

Terms are intentionally separated:

- `Signal` is raw boundary intake: channel message, schedule tick, webhook, API
  call, or human correction. It preserves source/evidence and may be ignored.
- `WorkspaceEvent` is the semantic, durable fact used by L1+ context. It must be
  independently understandable outside the raw source.
- daemon `BusEvent` / loop `LoopEvent` are runtime telemetry and audit evidence,
  not workspace semantic state.
- tool output, transcripts, channel text, chronicle, and timeline are evidence
  surfaces unless an extractor/reducer promotes them into `WorkspaceEvent`s.

The core loop becomes:

```text
WorkspaceEvent / Resource
  -> ContextPacketBuilder
  -> ContextPacket
  -> agent / reducer / tool / orchestrator proposes protected effect
  -> CapabilityBoundary
  -> accepted invocation / blocked event
  -> Task / Attempt dispatch or workspace mutation
  -> Handoff / Artifact / extractor
  -> WorkspaceEvent / Track projection update
```

This changes the workspace package boundary. `Workspace` owns semantic events,
resources, Track projections, execution records (`Task / Attempt / Handoff /
Artifact`), protected invocation records, and delegation contracts as passive
stores/projections/validation inputs. `ContextPacketBuilder` initially builds
bounded packets for coordination and task execution contexts; governance/review
and observation packets are extension profiles introduced only when protected
workflows need them. `assemblePrompt` becomes a renderer for those packets
rather than the component that decides long-term workspace state. The
capability boundary is the shared gate for protected mutations and external
side effects proposed by reducers, planners, tools, extractors, HTTP APIs, or
orchestrator actions before stores or runtime dispatch are touched. Mutating MCP
tools, reducers, and planner outputs submit typed capability invocations; they
no longer write protected stores directly.

“Owns” here means passive persistence, projection, and validation interfaces,
not active execution. `packages/workspace` may define stores, reducers,
projection rebuild, and capability validation contracts. `packages/agent-worker`
still owns polling, wakeup, runner dispatch, extractor invocation, retry, and
error handling. This relaxes the current workspace kernel boundary by adding
semantic event, projection, and invocation records, but it does not move the
active orchestrator into `packages/workspace`.

`Track` is a projection over events and resources, not a task, policy object, or
workflow engine. `Task`, `Attempt`, `Handoff`, and `Artifact` remain execution
domain objects: a task describes one executable unit, an attempt is one L0
runtime execution, a handoff is an execution report, and an artifact is a
pointer. Attempt completion does not directly update long-term continuity; an
extractor turns Handoff/Artifact/evidence into WorkspaceEvents and Track
projection updates. Raw channel messages, runtime transcripts, tool outputs,
daemon bus events, and the existing chronicle/timeline are audit or evidence
surfaces by default, loaded only through explicit audit/read paths.

Persistence and replay follow an idempotent event-sourced contract. A protected
effect first records an invocation with a stable `invocationId` / idempotency
key. State writes, dispatch records, worktree operations, artifact records,
extractor outputs, and external outbox entries caused by that invocation bind to
that key. Reducers apply accepted state transitions; extractors append derived
WorkspaceEvents keyed by `{attemptId, handoffId, artifactRefs,
extractorVersion}`. Track state is a rebuildable projection, not the source of
truth. Task/Attempt/Handoff/Artifact are operational execution records, not
rebuildable projections. If the daemon crashes after an attempt becomes
terminal but before extraction, recovery scans terminal attempts/handoffs
without matching extracted events and re-runs extraction. Duplicate extraction
is ignored by key; missing or failed extraction is visible as a blocked/retry
WorkspaceEvent, not hidden from long-term context. Non-idempotent external
effects need a durable outbox/commit record or remain blocked for
human/operator resolution.

`packages/agent-worker` remains the active orchestration layer. Its
orchestrator reads pending events/invocations, asks for context packets,
dispatches accepted attempts through runner closures, calls extractors after
terminal attempts, and records blocked/failed/completed outcomes as
WorkspaceEvents. `packages/loop` remains unchanged in shape: loops receive a
prompt/context string plus pre-wired tools and stream runtime-local events.
At the time of this ADR, standalone `/agents` was kept separate and not folded
into workspace mode. ADR 003 supersedes that broader agent-model boundary.

Breaking migration is allowed. Replace direct call sites rather than carrying
dual paths or compatibility shims. The current `DESIGN-NEXT.md` should be
promoted into the current design in smaller, package-owned edits after this
proposal is adopted.

Migration order is part of the decision:

1. Introduce `WorkspaceEvent` and extraction/replay for terminal attempts while
   keeping current task dispatch usable.
2. Add `ContextPacketBuilder` and make prompts render packets instead of raw
   long-term history.
3. Add `CapabilityBoundary` for protected mutations and external side effects;
   read-only tools, audit reads, and low-risk local status updates stay light.
4. Add `Track` as a projection over events/resources.
5. Add delegation contracts only for protected invocations that need delegated,
   collective, expiring, or revocable authority.

The limiting rule: not every action becomes ceremony. Persisted invocation
records are required for task/attempt dispatch, workspace state mutation, user-
visible commitments, external side effects, resource/security changes, and
governance changes. Read-only and audit-read paths do not require invocation
records; audit reads leave evidence. Low-risk local updates may be reducer
events with binding ids rather than full governance.

## Alternatives seriously considered

**Keep the current workspace ledger + prompt-section model.** Strongest case:
the existing model is implemented, understandable, and enough for single-day
workspace runs. It avoids a large schema and enforcement migration. It loses
when work spans days, agents, or external signals because raw channels,
chronicle entries, timeline events, and prompt sections keep competing to be
the durable state surface.

**Adopt `DESIGN-NEXT.md` wholesale as the current design in one edit.**
Strongest case: it already contains the full target model and avoids another
intermediate artifact. It loses because it mixes durable core mechanisms,
domain objects, UI principles, and open questions. Promoting it wholesale would
turn unresolved questions into apparent current truth.

**Make `Track` the central primitive instead of `WorkspaceEvent`.** Strongest
case: users reason about ongoing concerns more naturally than individual
events, so a Track-centered implementation could produce a better UI sooner. It
loses because Track state must be explainable and replayable from facts; making
it primitive would recreate mutable summaries as the long-term source of truth.

**Unify standalone agents and workspace agents under this harness.** Strongest
case: one runtime model would remove the historical parallel paths. This
alternative was rejected in this ADR because the proposal was scoped to the
workspace event core. ADR 003 later adopts a broader
`HarnessEnvironment -> AgentRuntime` boundary without making every harness a
workspace.

## Pre-mortem

A year from now this proposal is being ripped out because the boundary became
too ceremonial: every useful action had to become an invocation, event schemas
were overfit before real workflows stabilized, and agents spent more time
servicing validation than completing work. The guardrail is to persist and
validate protected/external mutations first, keep low-risk local actions light,
and treat event schema design as domain-owned rather than a closed core enum.

## Cold review

Fresh-context review ran against only `design/DESIGN.md` and this proposal.

- **Completeness** — Reviewer found the proposal changed the write contract
  without defining the transactional boundary if an attempt reaches terminal
  status and the daemon crashes before extraction/projection. Fixed above by
  adding the idempotent persistence/replay contract: accepted invocations carry
  stable keys, extractors key derived WorkspaceEvents by attempt/handoff/
  artifacts/version, recovery re-runs missing extraction, and projections remain
  rebuildable.
- **Consistency** — Reviewer found that saying `Workspace` owns events,
  invocation records, and contracts silently expands the package boundary beyond
  the current kernel store. Fixed above by spelling out that workspace ownership
  means passive stores/projections/validation interfaces, while active polling,
  dispatch, extractor execution, retry, and error handling remain in
  `packages/agent-worker`.
- **Clarity** — Reviewer found two ambiguous write paths into the event stream:
  `Signal` normalization and reducer-produced events, with unclear distinction
  from daemon `BusEvent` and runtime events. Fixed above by defining `Signal`,
  `WorkspaceEvent`, daemon/loop telemetry, and evidence surfaces separately.
- **Scope** — Reviewer found the proposal bundled event context, capability
  enforcement, packet building, and Track projection. Fixed above by making the
  migration order explicit and staged.
- **YAGNI** — Reviewer found capability boundary, delegation contracts,
  governance/review, and Track projections were at risk of becoming ceremony
  before workflows prove they need it. Fixed above by adding the limiting rule:
  persisted invocation records are required for protected/dispatch/external
  effects, while read-only, audit-read, and low-risk local status paths stay
  lightweight.

Post-adoption design review found five follow-up ambiguities and the design docs
were tightened:

- `/agents` contract: `GlobalAgentStub` is listing/state only. Sending to a
  workspace-backed stub must fail clearly instead of silently routing.
- Ledger semantics: `Task / Attempt / Handoff / Artifact` are execution records
  and operational source state, while `Track` is the rebuildable projection.
- Capability boundary: it is the shared gate for protected writes/effects from
  reducers, tools, planners, extractors, HTTP APIs, and orchestrator actions,
  not a single pre-run pipeline step.
- Idempotency anchor: every protected invocation carries a stable
  `invocationId` / idempotency key; external non-idempotent effects need a
  durable outbox/commit record or fail closed.
- Scope pressure: first implementation should cover coordination + task
  execution contexts; governance/review, observation, and delegation contracts
  remain extensions until a protected workflow needs them.

## Outcome

Adopted. Update the current design docs to make workspace mode's long-term
context a semantic `WorkspaceEvent` stream, with context packets, capability
validation, idempotent extraction/replay, and Track projections as the core
harness direction. Implementation should follow the staged migration order in
this proposal and replace current direct paths rather than carrying long-lived
compatibility shims.
