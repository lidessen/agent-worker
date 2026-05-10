# Observability Monitor

**Status:** placeholder (proposal pending)
**Date:** 2026-05-09

> **Terminology note (2026-05-10):** [Decision 006](006-harness-as-agent-environment.md) renames the `Workspace` kernel to `Harness`. The reference to `WorkspaceHarness` below should be read as the universal `Harness` substrate plus its registered `HarnessType`. The monitor's instrumentation surfaces remain the same; only the names change.

## Context

`goals/GOAL.md` defines four success criteria (C1–C4) — multi-requirement
concurrency, no irreplaceable closed-source dependence, intervention budget,
async non-blocking — that all rely on a continuously-running observability
**monitor**: a system-level instrumentation surface that samples agent
invocations, requirement state, intervention events, and concurrency, and
that computes the metrics underlying each criterion's verdict.

This monitor is named in GOAL.md as a first-class engineering deliverable,
not a nice-to-have. Without it, every C1–C4 verdict at every periodic
review degrades to `unclear`. Per the goal-driven protocol, `unclear`
accumulating ≥ 2 months on a criterion is itself a failure signal — so
the monitor's absence is a known, time-bounded liability.

## Why this is a placeholder

The concrete shape of the monitor — sampling cadence, storage substrate,
metric aggregation, alert/STOP integration, dashboard surface, and how it
plugs into `WorkspaceHarness` / `AgentRuntime` boundaries — has not been
designed. This file exists so the requirement is not lost.

## Open questions to resolve in the real proposal

- Where does the monitor live in the daemon architecture? A peer of
  `HarnessRegistry`? A capability provided to every harness? An external
  process consuming the JSONL event stream?
- Sampling: per-event push vs. periodic pull. Each criterion's metrics
  imply different cadences (C1/C4 want sub-second sampling of activity
  state; C2 wants per-invocation; C3 wants per-intervention).
- Storage: piggyback on `EventBus` + JSONL, or a dedicated metric store
  (sqlite / DuckDB / Prometheus-style TSDB)? Trade-off: query convenience
  vs. extra infra surface.
- Counterfactual reachability for C2 — the "if closed-source were cut
  off today" computation is non-trivial; how much of it is offline
  re-execution vs. static analysis of binding configuration?
- Dashboard vs. headless: the monitor is the load-bearing piece; a
  dashboard UI is a derived view. Should they be split into two
  proposals, or land together?
- Integration with `goals/record.md` and the goal-driven review flow:
  metrics inform `✓ / ✗ / unclear` verdicts, but the protocol treats
  the human as the source of truth. How does the monitor contribute
  evidence without claiming verdicts?

## Next step

Replace this placeholder with a real proposal once the questions above
have been thought through enough to land an opinionated shape. Until
then, GOAL.md C1–C4 will remain `unclear` and that is expected.

## References

- `goals/GOAL.md` — success criteria depending on this monitor.
- `design/DESIGN.md` — `EventBus` and JSONL telemetry surfaces this
  monitor will likely build on.
- `design/packages/workspace.md` — `WorkspaceEvent` stream as a
  candidate signal source.
