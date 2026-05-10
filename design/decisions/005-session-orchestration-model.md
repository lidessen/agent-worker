# Session Orchestration Model

**Status:** adopted
**Date:** 2026-05-09 (proposed) — 2026-05-09 (adopted)

> **Terminology note (2026-05-10):** This proposal predates [decision 006](006-harness-as-agent-environment.md), which renames the `Workspace` kernel to `Harness` and recasts the privileged `WorkspaceHarness` as one peer `HarnessType` (`MultiAgentCoordinationHarnessType`) plugged into a universal substrate. References below to `Workspace` / `WorkspaceEvent` / `WorkspaceHarness` should be read as `Harness` / `HarnessEvent` / `Harness with type=coordination` — the substantive claims of this proposal (Task as projection, Wake/Handoff core+extension, work log, hook protocol, session orchestrator) are unchanged. The original wording is preserved as historical record.

## Context

`goals/GOAL.md` defines the project's General Line: a continuously-running,
multi-agent work system whose backbone is a unified entry surface — not a
fleet of separate CLI / IDE apps. The current daily routine (open Claude
Code, open Codex, open Cursor, start a session per task) is the pain this
phase targets.

Two months of harness work (decisions 002 and 003) settled where context
lives (with harnesses, not runtimes) and where backend choice lives
(harness-selected `RuntimeBinding`, not runtime-internal). What remains
underspecified — and what this phase now needs to answer — is:

1. Where do "tasks" live? The kernel currently treats `Task / Attempt /
   Handoff / Artifact` as first-class execution records (per
   [design/packages/workspace.md](../packages/workspace.md)). Is that
   right?
2. What is the lifetime of an agent instance?
3. How does work continue across context-window exhaustion?
4. What's the user-facing entry surface that replaces the per-app routine?

This proposal answers them as one coherent shape. Work-log schema, UI
specifics, and context-budget signaling protocol are explicitly deferred
to downstream blueprints.

## Recommendation

### 1. Task is a harness-layer projection, not a kernel record

The workspace kernel keeps `WorkspaceEvent`s, `Signal`s, `Resource`s,
rebuildable projections (`Track` and similar), and protected invocation
records. **It no longer holds `Task` records.**

A **task-tracking harness** subscribes to events and projects task state
on top of the event stream:

- It observes new-requirement events, progress events, completion
  signals, and blockers
- It can periodically dispatch reminder events for unfinished work back
  into the kernel (as ordinary `WorkspaceEvent`s)
- It computes task status from event history; status is rebuildable

Tasks join `Track` as a **projection family**, not a kernel record. The
visual model: events are the only kernel-truth; everything else
(including tasks) is a way of looking at events.

`Artifact` similarly moves: it overlaps semantically with `Resource`
(both are pointers to concrete outputs); merging them is a follow-on
clean-up, deferred but flagged.

`Handoff` stays — redefined below as a runtime-boundary concept, not a
kernel record. The previous `Attempt` concept is renamed to **Wake**
(rationale below).

### 2. Wake = agent's bounded life

A **Wake** is one short-lived agent instance — the period between when
a harness wakes an agent in response to an event and when that agent
goes silent. Naming rationale: the project's bet rests on short-lived,
event-triggered agents organized by harnesses (see GOAL Inv-1 and the
General Line). "Wake" puts that lifecycle directly into the type name:
events wake an agent, the agent works, the wake ends, the agent goes
dormant. Compared to `Run` (action-flavored, single-shot connotation),
`Episode` (story-arc connotation), or `Attempt` (failure-flavored), Wake
matches the event-driven, ephemeral, non-heroic shape this project is
built around. Trade-off: not a community-standard term — definition
must be explicit on first introduction (here).

A Wake's life is naturally bounded:

- **By task completion** — terminal early; the Wake produces a
  completion signal and ends.
- **By context window** — typically 200K to 1M tokens depending on
  model. The runtime signals approaching exhaustion (extend
  `LoopEvent.usage` or add a dedicated signal — see open questions).
- **By harness decision** — the harness may end a Wake voluntarily for
  any reason (cost, runtime swap, recovery).

One Wake = one agent instance. Cross-Wake state lives in the
task-tracking harness's projection plus the work log; no Wake holds
state for a future Wake.

This is the operational meaning of GOAL invariant Inv-1 ("no agent
instance holds cross-requirement state"). A "requirement" spans Wakes;
a Wake does not span requirements.

### 3. Handoff is the protocol between Wakes — generic core plus per-harness extension

A **Handoff** is the structured knowledge transfer between consecutive
Wakes on the same task. Different harnesses are different work
environments — a coding harness's handoff carries fundamentally
different structural content from a writing harness's or a
manager-style delegation harness's. The Handoff schema is therefore
split into a **fixed generic core** every Handoff carries plus a
**per-harness extension** populated by hooks.

**Generic core** (universal, present in every Handoff):

- `closingWakeId` — the Wake ending here
- `taskRef` — the task projection this Wake contributed to
- `summary` — what was done in the closing Wake
- `pending` — work items still open
- `decisions` — decisions made during the Wake
- `blockers` — what's stuck
- `resources` — pointers to concrete outputs (`Resource` references)
- `workLogPointer` — anchor into the work log for the next Wake to
  rebuild context from

The core is universal: any task across any harness can express
progress / pending / decisions / blockers / resources without
per-domain extension.

**Per-harness extension** (optional, harness-typed):

Each harness type defines (a) an optional `HandoffExtension` schema
and (b) two hooks executed at the Handoff boundary:

- `produceExtension(wake, events, workLog) → extension` — invoked when
  a Wake closes; extracts harness-specific state from the Wake's emitted
  events and the work log into the extension shape.
- `consumeExtension(extension, packet) → packet'` — invoked when the
  next Wake starts; contributes extension content into the new Wake's
  `ContextPacket`.

Concrete examples of what each harness might put in its extension:

| Harness type | Extension content (illustrative) |
|---|---|
| Coding harness | branch state, modified files, test/build status, CI artifacts, error contexts |
| Writing harness | chapter/section arc, character notes, tone samples, citations gathered |
| Manager-style delegation harness | subordinate assignments, escalations, awaiting-approval list |
| Trading / decision harness | hypotheses tested, data sources consulted, confidence levels, position state |

Storage: extensions live in a `harnessTypeId`-keyed map alongside the
core. A handoff with no extension (rare but possible — e.g., a
generic-task harness) just has an empty map.

Cross-harness-type handoff: when a task moves from one harness type to
another (uncommon; typically only when an explicit "manager → developer"
delegation pattern is in play), only the generic core transfers
verbatim. Extensions from the closing harness are dropped at the
boundary unless an explicit translation hook is registered. The
receiving harness sees `extension = undefined` and falls back to
core-only context construction.

Schema evolution: each extension carries an optional `schemaVersion`;
`consumeExtension` hooks must handle `undefined` and earlier versions
gracefully or reject explicitly. A failed extension consume must not
silently drop content — it surfaces as a Wake-startup blocker.

Runtime-agnostic at every layer: neither core nor any extension may
serialize runtime-native transcripts (no Claude `message[]`, no Codex
thread). Native session continuity (e.g., Codex `threadIdFile`) is a
same-runtime fast path coexisting with — not replacing — the Handoff +
work log surface.

A Handoff is necessary for any Wake that does NOT terminally complete
the task. Voluntary terminal-success Wakes produce a final result +
resource references and skip Handoff.

### 4. Work log — runtime-agnostic, harness-owned

The **work log** is the harness's record of all Wakes contributing to
one task. It contains:

- Each Wake's input `ContextPacket`
- Each Wake's emitted events (text, tool calls, results — neutral
  shape, not runtime-specific)
- Each Wake's terminal record (Handoff or final-result)
- Resource pointers produced along the way

The work log is the source from which the next Wake's `ContextPacket`
is built. Constraint: **no runtime-native
serialization** (no Claude `message[]`, no Codex thread, no Cursor
internal state). Runtime-native session continuity (e.g., Codex
`threadIdFile`) is a same-runtime fast path; the work log is the
ground truth for cross-runtime continuity.

The exact schema of the work log is deferred to a downstream blueprint.
This proposal only fixes the constraint (runtime-agnostic, harness-
owned) and the responsibility boundary (harness writes; runtime reads
via `ContextPacketBuilder`).

### 5. Central session orchestrator — unified entry surface

A unified entry — CLI + web UI sharing the daemon — to:

- Start a new task (becomes a task-tracking-harness projection)
- Pick a `RuntimeBinding` (which runtime, which model)
- View in-flight tasks across all runtimes
- Resume a task: next Wake with potentially different binding
- Switch the active binding mid-task

Deliberate non-goal: the orchestrator is **not a chat client**. User
interaction shape is task-shaped (submit, get notified at acceptance
points, accept or redirect), not message-shaped. Runtime CLIs already
exist for the message-shaped use case; this is the layer above them.

The orchestrator implementation likely lives in `packages/agent-worker`
(daemon + CLI) and `internals/web` (UI), with a new module — possibly
`packages/agent-worker/src/orchestrator/` or a sibling — coordinating
session lifecycle. Concrete shape deferred to a downstream blueprint.

### 6. OSS path is per-binding, not per-runtime

`RuntimeBinding` specifies model selection. For GOAL invariant Inv-2,
**every binding type must be configurable to point at an OSS-compatible
endpoint**, not just one runtime family:

| Runtime family       | OSS routing options                                             |
|----------------------|-----------------------------------------------------------------|
| Vercel AI SDK        | Direct OSS providers (Ollama, vLLM, OpenRouter, Together, …)    |
| Claude Agent SDK     | OAI-compatible proxy in front of OSS (LiteLLM, custom adapter)  |
| Codex app-server     | If app-server accepts custom model/endpoint configuration       |
| Cursor SDK           | Subject to SDK capabilities; via proxy if available             |

The OSS fallback obligation in Inv-2 is a **binding-level** statement:
each capability binding must have *some* OSS-compatible configuration,
regardless of which runtime family the binding belongs to. C2 monitor's
"uncovered binding count = 0" is the enforcement.

### Sequencing relative to decision 004

Decision 004 (observability monitor) covers C1–C4 measurement. This
proposal (005) is the substrate the monitor will instrument. Order:
**005 lands first; 004 follows immediately.** Without sessions running,
the monitor has nothing to instrument; without the monitor, GOAL
criteria stay `unclear`. Both are early, but the dependency runs 005 → 004.

## Open questions (deferred to blueprints)

1. **Work-log schema** — events-only / transcript-plus-events / structured-
   semantic-state. Trade-off: faithfulness to runtime emission vs.
   serialization cost vs. context-rebuilding fidelity.
2. **Context-budget signaling** — extend `LoopEvent.usage`, or add a
   dedicated `LoopEvent` variant for "approaching exhaustion"? The
   harness needs enough warning to checkpoint cleanly.
3. **Auto-checkpoint cadence** — on every tool round? at fixed
   percentage thresholds (e.g., 70%, 85%, 95%)? on natural breakpoints?
4. **Resume UX** — automatic on context exhaustion vs. surface to user
   for confirmation vs. configurable per task. Default behavior matters
   for the "顶层介入" UX promise in the General Line.
5. **Task vs. Track relationship** — both are projections over events;
   when does a task become a track? (Hypothesis: tracks are long-running
   cross-task continuity; tasks are unit-of-work projections; some
   long-running tasks may be both.)
6. **UI rollout order** — CLI first (faster, dogfoodable from terminal)
   then web; or web first (richer surface from day one). Affects what
   gets observable when.
7. **`Artifact` → `Resource` merge** — flagged for cleanup; does it
   happen as part of 005 or as a follow-on?
8. **First Handoff extensions to ship** — which harness types get
   typed `HandoffExtension` schemas in the first iteration? Coding is
   obvious (this monorepo's first dogfood). Beyond that: writing,
   trading, manager-delegation? Schema design for each is its own
   blueprint.
9. **Extension translation hooks across harness types** — when does
   "manager → developer" cross-harness handoff become real enough to
   need translation hooks, vs. just dropping extensions at the
   boundary? Defer until a concrete cross-harness flow appears.

## Consequences

- **`design/DESIGN.md`** — workspace package's `_Does:_` line drops
  `Task` and `Artifact` from execution records; the architecture diagram
  loses `Task / Attempt / Handoff / Art.` and replaces it with
  `Wake / Handoff` plus a "task projection" block under harness layer.
- **`design/packages/workspace.md`** — "Execution records" section
  substantially rewritten: Task moves out; Artifact deferred-merge-noted;
  Wake (formerly Attempt) and Handoff redefined as runtime-boundary
  concepts.
- **`design/packages/agent.md`** — `AgentRuntime` contract: add explicit
  context-budget signaling responsibility (concrete shape in blueprint).
- **New: `design/packages/orchestrator.md`** (or sibling) — central
  session orchestrator scope, relationship to daemon and harness layer.
- **`packages/workspace/`** code — Task records and accessors are
  removed or migrated to the task-tracking harness. Affects
  `state/types.ts`, `state/file-store.ts`, MCP `task_*` tools, and any
  call site building Task records directly.
- **New harness scaffold** — task-tracking harness as a worked example
  (concrete shape in blueprint).
- **Harness type definition gains hook signatures** — every harness
  type now declares: optional `HandoffExtension` schema,
  `produceExtension` hook, and `consumeExtension` hook. The harness
  registry / type system carries these alongside the existing
  `RuntimeBinding` / `ContextPacketBuilder` / `CapabilityBoundary`
  surfaces.
- **Inv-2 enforcement** — binding configuration must include OSS
  fallback as a structural requirement, not a recommendation. Affects
  `RuntimeBinding` schema and binding registry.

## Alternatives considered

- **Keep Task in kernel.** Simpler short-term, but contradicts the
  harness-owns-context principle from decision 003 and creates dual
  truth (events vs. records). The Task→Wake→Handoff chain is already
  redundant with the event stream + extraction step.
- **Split this into two decisions** — "task out of kernel" first, then
  "session orchestrator" next. Cleaner narrative-wise, but the
  motivation for moving Task is precisely the orchestrator phase's
  needs; coupling them keeps the why visible.
- **Per-runtime work-log format.** Each runtime writes its own
  serialization; harness adapts on resume. Rejected: cross-runtime
  resume becomes O(N²) adapters. Single neutral format is cheaper
  long-term.
- **Make the orchestrator a chat client.** Tempting because it
  matches existing UX from per-runtime CLIs. Rejected: GOAL's General
  Line says "顶层介入 + 验收"; chat-shaped interaction structurally
  invites the every-step-asking pain (NG-context: same shape that
  current coding agents have). Task-shaped interaction is a different
  product.

## References

- [decision 002 — adopt workspace event harness core](002-adopt-workspace-event-harness-core.md)
- [decision 003 — agent runtime / harness boundary](003-agent-runtime-harness-boundary.md)
- [decision 004 — observability monitor (placeholder)](004-observability-monitor.md)
- [goals/GOAL.md](../../goals/GOAL.md) — General Line, Inv-1, Inv-2, NG-2
- [design/packages/workspace.md](../packages/workspace.md) — current
  Task / Attempt / Handoff / Artifact descriptions to be revised
