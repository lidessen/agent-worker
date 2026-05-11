# Session Orchestrator — Design

> The unified entry surface — CLI plus web UI — that sits above the
> harness layer and replaces the current "open one app per runtime"
> daily flow. It owns Wake lifecycle (start, observe, resume, switch
> binding), surfaces task projections from task-tracking Harness typees,
> and routes user intent into the appropriate `RuntimeBinding`.

The orchestrator is not its own package — its code lives in
`packages/agent-worker/src/orchestrator/` (CLI + daemon side) and
`internals/web/src/` (UI side). This doc defines the architectural
surface; the package designs ([agent-worker.md](agent-worker.md),
[web.md](web.md)) describe the code organization.

See [../decisions/005-session-orchestration-model.md](../decisions/005-session-orchestration-model.md)
for the adopted shape this doc reflects.

## Why this exists

`goals/GOAL.md`'s General Line names a single-entry, continuously-running
work system as the user-facing promise. The pain it targets is the
current daily routine of opening Claude Code for one task, Codex for
another, Cursor for a third — each app a silo with its own session,
its own context, its own runtime, its own context-window exhaustion
ritual.

The orchestrator unifies that surface as a **work-entry replacement
subset**, not as Claude Code / Codex parity. The user submits a requirement;
picks a `RuntimeBinding` (or accepts the harness's recommendation);
sees in-flight tasks across all runtimes in one place; resumes a task
when its previous Wake hit context limit, possibly under a different
binding. The orchestrator does **not** implement runtime semantics —
that stays in `internals/loop/` — and it does **not** own task state
— that stays in the task-tracking Harness type's projection. It coordinates.
See [../decisions/009-attention-driven-system-protocol.md](../decisions/009-attention-driven-system-protocol.md)
for the scope rule: only runtime-CLI behaviors that also strengthen
the long-term harness protocol belong here.

## Surface

```
                 ┌──────────────────────┐
                 │     User intent      │
                 │  CLI cmd  /  Web UI  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  Session Orchestrator │
                 │                      │
                 │  ├─ task projection   │  ← from task-tracking Harness type
                 │  │     overview      │
                 │  ├─ Wake lifecycle    │  ← spawn / observe / end
                 │  ├─ binding picker    │  ← OSS-fallback aware
                 │  ├─ resume from       │
                 │  │   work log + Handoff
                 │  └─ runtime swap      │  ← cross-binding continuation
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │  HarnessRegistry      │
                 │   (existing)         │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   AgentRuntime.run    │  ← short-lived Wake
                 └──────────────────────┘
```

## Responsibilities

**Submit intent.** A user submits a requirement at the top — a task
description, optionally a runtime preference, optionally a target
`HarnessType`. The orchestrator routes it: typically into a Harness
with the task-tracking type, which projects it as an open task on the
event stream. The Harness (or the orchestrator on its behalf) opens
the first Wake under a chosen `RuntimeBinding`.

**Show in-flight tasks across runtimes.** The orchestrator reads task
projections from Harnesses and presents a unified list — independent
of which runtime each task's most recent Wake used. This is the daily
"what am I working on" surface, replacing per-app project lists.

**Spawn, observe, end Wakes.** Wake lifecycle is the orchestrator's
operational surface: dispatching the next Wake (delegated to the
Harness), streaming its `LoopEvent`s and `RuntimeTrace` to the UI,
catching the runtime's context-budget signal (see
[agent.md](agent.md)) and triggering checkpoint flow before forced
termination.

**Resume across context exhaustion.** When a Wake ends with a Handoff
(not terminal completion), the orchestrator surfaces the resume option:
either auto (default to be defined in a downstream blueprint) or
user-confirmed. Resume reads the work log + the closing Handoff (core
+ extension), runs the registered `HarnessType`'s `consumeExtension`
hook to build the next `ContextPacket`, and dispatches the next Wake
— possibly under a different `RuntimeBinding` selected by the user or
the Harness.

**Switch `RuntimeBinding` mid-task.** A user may explicitly change the
binding for an in-progress task ("this is taking too long, try a
different model"). The orchestrator ends the current Wake (if running)
with a Handoff, then opens a new Wake with the chosen binding,
reading state from the work log. Cross-binding continuity goes through
the work log, never through runtime-native session files (per
decision 005).

**OSS-fallback awareness.** The binding picker shows OSS coverage
clearly. Per GOAL Inv-2, every binding *type* must have an OSS
configuration available; the orchestrator surfaces which bindings are
OSS-anchored vs. closed-source-only, so the user (and the system,
under the C2 monitor) sees coverage in real time.

## Non-responsibilities

- **Not a chat client.** The orchestrator is task-shaped, not
  message-shaped. The chat-shaped UX is what the per-runtime CLIs
  already do — and it's the same shape that drove the
  every-step-asking pain (decision 005, alternatives section). The
  orchestrator surfaces tasks, Wakes, Handoffs, and acceptance points
  — not a free-flowing dialogue.
- **Not a runtime implementation.** Backend semantics (model selection,
  prompt rendering, tool invocation) stay in `internals/loop/`.
- **Not a task store.** Task state lives as a projection contributed
  by the task-tracking Harness type over the HarnessEvent stream, not
  in the orchestrator.
- **Not a long-term memory model.** Cross-Wake state lives in the
  work log (Harness-owned) plus Handoffs; the orchestrator reads but
  does not own.
- **Not a runtime adapter.** Per-binding context-budget normalization,
  session continuity, and tool transport are runtime concerns
  ([agent.md](agent.md)), not orchestrator concerns.
- **Not Claude Code / Codex parity.** Native CLI affordances are adopted
  only when they serve both short-term work-entry replacement and the
  long-term attention-driven harness protocol.

## Key mechanisms

**Top-shaped UX, not message-shaped.** The orchestrator's primary
surfaces are *task list*, *task detail (with Wake history)*, and
*acceptance prompt*. The user submits, observes, and accepts — not
chats. Acceptance is a deliberate boundary; the user reviews the
output, then either accepts (task closes) or hands back a redirect
that becomes the next Wake's input via a new Handoff seed.

**Authorization is a tool-layer concern, not an orchestrator
concern.** When an agent's tool call needs user approval (e.g., a
purchase, a `git push`, an outbound message), the tool layer
intercepts and emits an authorization request — the orchestrator
surfaces it to the user but does not generate it itself. While the
user has not yet responded, the orchestrator continues running other
in-flight Wakes for unrelated tasks (decision 005, GOAL C4
"async non-blocking"). This is the structural reason the orchestrator
is multi-task by design rather than single-session.

**Wake-lifecycle UI primitives.** `start` / `running` / `closing` /
`handed_off` / `completed` / `failed` / `cancelled` map to UI states
on every Wake row. A long-running task with multiple Wakes presents
as a sequence of Wake rows linked by Handoffs.

**Binding choice is a first-class action.** The orchestrator's binding
picker is exposed every time a Wake starts (or restarts after a
Handoff). Default suggestion comes from the Harness's recommendation; user
can override. The picker visibly distinguishes OSS-anchored from
closed-source-only configurations, making coverage and dependence
patterns obvious in normal use, not just in the C2 monitor's report.

## Open questions (deferred to blueprints)

The orchestrator's concrete shape — work-log schema, context-budget
signal format, auto-checkpoint cadence, resume UX defaults, UI
rollout order (CLI first vs. web first), and `Task` vs. `Track`
relationship — is captured in decision 005's "Open questions" section.
Each is a downstream blueprint candidate.

## Cross-references

- [../decisions/005-session-orchestration-model.md](../decisions/005-session-orchestration-model.md) — adopted model
- [../decisions/009-attention-driven-system-protocol.md](../decisions/009-attention-driven-system-protocol.md) —
  product scope and attention-driven system protocol
- [../decisions/004-observability-monitor.md](../decisions/004-observability-monitor.md) — instruments
  this surface; runs in parallel
- [agent-worker.md](agent-worker.md) — daemon package where the
  orchestrator's server-side code lives
- [agent.md](agent.md) — runtime contract incl. context-budget signaling
- [harness.md](harness.md) — substrate where Wake / Handoff records live
- [harness-types/coordination.md](harness-types/coordination.md) —
  the first mature `HarnessType`'s contributions
- [web.md](web.md) — UI package for the orchestrator's web surface
- [../../goals/GOAL.md](../../goals/GOAL.md) — General Line, C1, C4, NG-2
