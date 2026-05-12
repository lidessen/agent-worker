# Agent-Worker — Goal

> A continuously-running, multi-agent engineering work system: requirements
> in at the top, finished work out — built from short-lived agents
> orchestrated by harnesses, anchored to open-source model capability,
> not a single super-agent.

## General Line

A continuously-running work system that processes any kind of requirement
(coding, writing, decision-making, …) in an *engineering* manner — composed
of short-lived, collaborating agents organized by layered harnesses, **not** a
single super-agent. The system's backbone capability is anchored at the level
reachable by open-source models (closed/SOTA agents are supplementary, not a
dependency); the system does not collapse when closed-source models become
unavailable. The human engages only at the top — submitting requirements
and accepting completed work; tool/API calls that need authorization are
intercepted at the tool layer, and while waiting for approval the system
keeps progressing other unblocked work instead of idling.

## Success criteria

All metrics depend on a continuously-running **monitor** that observes
agent invocations, requirement concurrency, user interventions, and system
activity. The monitor is a shared observability prerequisite for C1–C4
and a first-class early engineering deliverable (a separate
`design/decisions/004-observability-monitor.md` proposal is expected).

**Conventions:**
- **Startup period** = first 3 months. Thresholds marked "baseline-then-set"
  are recorded but not enforced; from month 4 they are replaced by hard
  thresholds derived from observed baselines.
- Default sliding window: 30 days.
- `unclear` accumulating ≥ 2 months on any criterion triggers a review.

- **C1 — Real multi-requirement concurrency.**
  Monitor samples (per-second / on-event): active-requirement count,
  active-agent-instance count, pending-on-auth-requirement count, and
  the scheduler's configured concurrency cap.
  Computed metrics: (1) concurrency-time distribution (≥3 / =2 / =1 / =0
  share); (2) 30-day peak concurrency; (3) structural cap.
  Thresholds:
  - Structural cap ≥ 3 (hard — system is configurationally not allowed to
    be single-threaded).
  - 30-day peak concurrency ≥ 3 (startup may be relaxed to ≥ 2).
  - From month 4: time-share at concurrency ≥ 2 ≥ 20% (baseline-then-set).
  Backstop: when monitor reports "30-day peak < 2", run a one-off
  capacity drill (inject 5 concurrent real requirements) to verify the
  capability *exists*; the drill is not routine.

- **C2 — No irreplaceable dependence on closed-source models.**
  Monitor instruments every agent invocation: binding ID, actual
  model/agent used, closed vs. open source, whether an OSS fallback is
  configured for that binding, and the OSS fallback's actual success rate.
  Computed metrics: (1) **uncovered-binding count** — bindings with no
  OSS fallback configured; (2) **failed-binding count** — bindings whose
  configured OSS fallback has 0% success over the last 30 days;
  (3) **reachability** — counterfactual share: "if all closed-source
  agents were cut off today, what fraction of the last 30 days' work
  would still complete?".
  Thresholds:
  - Uncovered-binding count = 0 (hard).
  - Failed-binding count = 0 (hard — "configured but not actually
    working" equals not configured).
  - Reachability ≥ 70% from month 4 (baseline-then-set).
  Auxiliary: targeted single-binding drills are triggered automatically
  when monitor flags an uncovered or failed binding — there is no
  blanket monthly "fire-drill".

- **C3 — Intervention budget.**
  Monitor instruments every user intervention: type, requirement ID,
  triggering context (which agent / which step), and notification-to-
  response latency. Types:
  - `authorization` — system actively raises an authorization request
    (tool-layer interception).
  - `acceptance` — system reports "done; please review".
  - `rescue` — system reports "stuck; need direction / hint / context".
    **This is the failure signal.**
  - `other` — user-initiated interruption (does *not* count as the system
    interrupting the user).
  Computed metrics: (1) rescue ratio = rescue / total interventions;
  (2) per-requirement (auth + acceptance) count; (3) response-latency
  distribution.
  Thresholds:
  - Rescue ratio ≤ 5% from month 4 (baseline-then-set) — this is the
    direct embodiment of "stop bothering me at every step".
  - Per-requirement (auth + acceptance) ≤ 3 from month 4 (baseline-then-set).

- **C4 — Async non-blocking.**
  Monitor samples (per-second / on-event): the unfinished-requirement set
  (with state: pending-on-auth / running / blocked) and the active-agent-
  instance count. Computed metrics:
  - **All-silent ratio** (primary) = time when ≥1 unfinished requirement
    exists AND 0 agents active / total time when ≥1 unfinished
    requirement exists.
  - **Auth-wait non-blocking utilization** (secondary) = within windows
    where authorization is pending AND ≥1 other non-blocked requirement
    exists, share of time with active agents ≥ 1.
  - **Phantom-block events** = discrete count of intervals where waiting
    is in flight, ≥1 other requirement exists, and active agents = 0.
  Thresholds:
  - All-silent ratio ≤ 20% from month 4 (baseline-then-set, primary).
  - Auth-wait non-blocking utilization ≥ 80% from month 4
    (baseline-then-set, secondary).
  - Phantom-block events ≤ 5 / month.

## Invariants

- **Inv-1 — No agent instance holds cross-requirement state.** Cross-
  requirement memory and continuity live only in harnesses (workspace
  events, durable facts, protected invocation records). An agent
  instance accumulating cross-requirement context indicates the system
  is silently regressing toward super-agent shape — STOP regardless of
  criteria status.
- **Inv-2 — Every agent capability binding has an OSS fallback configured.**
  Even when closed-source bindings are the active choice for capability
  reasons, an OSS path must remain configured. This is both a robustness
  invariant (against API outages) and an accessibility invariant
  (productive capability must not depend on willingness to pay).
- **Inv-3 — Any work submitted for user acceptance has been auto-tested
  by the system.** The system never delegates verification to the user.
  An acceptance request without a corresponding self-test record is a
  protocol violation — STOP.

## Non-goals

- **No benchmark optimization** — Tuning for SWE-bench / HumanEval /
  any synthetic-task leaderboard is out of scope. The General Line
  measures success on real requirements; a change improving benchmark
  numbers while regressing real-requirement throughput must be rejected.
- **No super-agent path** — When a capability gap appears, the answer
  is harness reorganization (new capability templates, different
  decomposition), not upgrading a single agent's prompt / context /
  model ceiling. This includes long-context / RAG patterns that turn
  one agent into a generalist black box.
- **No domain-specific architecture lock-in** — Domain-specific
  *capability templates* are encouraged; domain-specific *harness or
  scheduler primitives* are forbidden. Switching to a new domain must
  be "add a template", not "rewrite the substrate".
- **No rewriting backend agent CLIs** — We orchestrate; existing
  agent CLIs (Claude Code, Codex, Cursor, OpenClaw, Hermes, …) execute.
  Building our own LLM agent CLI to replace them creates a closed
  dependency on our own implementation and naturally invites
  super-agent regressions (NG-2).
- **No optimization for commercialization / monetization** — Core
  productive capability must not depend on a paid tier; features
  existing only to enable a billing path are out of scope. Commerce
  is not forbidden, but is never the optimization target — any future
  commercial layer must sit on top of the open-source-anchored core,
  not gate it.
- **No primary end-user scheduling UI** — The human schedules work
  through an MCP-capable agent (Hermes, Claude Code, …), not through
  a built-in dashboard. The web UI exists for debug/observability,
  not as the primary interaction surface. The system's capabilities
  are exposed as MCP tools so any scheduling agent can drive them;
  the built-in CLI and HTTP API remain available as secondary surfaces.

## Current trajectory (2026-05-12)

**Principal tension: core loop works, results aren't surfaced to the user.**
The daemon starts, discovers runtimes, and processes tasks through the
coordination harness (verified: task create → dispatch → Codex agent
runs in worktree → handoff completes). Three blockers prevent daily use
(see `HANDOFF.md`). The substrate cut (extracting coordination to a
peer package) is deferred — it improves package boundaries without
changing behavior.

**Strategic pivot: headless-first, MCP as the scheduling interface.**
The human interacts through an MCP-capable scheduling agent (Hermes),
not through a built-in UI. agent-worker exposes its capabilities as MCP
tools — task create/dispatch/status/cancel, agent list/state, harness
list/send — so any scheduling agent can drive execution. The web UI
stays for debug/observability; the dashboard redesign becomes a lower
priority than the MCP surface. This changes the product shape while
keeping the architecture intact: agent-worker is an execution backend,
not a user-facing application.

**External landscape.** Multica (27K stars, 4 months) validates the
market direction (agents as teammates on a shared board) but has no
agent-to-agent coordination or HarnessType primitive. Claude Code Agent
View (v2.1.139) treats sessions as process-level primitives — parallel
independent workers, zero cross-session state. Both confirm agent-worker's
differentiation (Harness as shared context, Wake/Handoff structured state
transfer, OSS anchoring per Inv-2) is the right bet.

**Priority.** (1) Three daily-use blockers → (2) MCP server exposing
core capabilities → (3) coordination end-to-end (two agents in one
harness, channel routing, Wake handoff) → (4) monitor producing C1–C4
numbers.

## Revisions

- 2026-05-09: initial set (interview-driven).
