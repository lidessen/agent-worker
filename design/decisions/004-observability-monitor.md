# Observability Monitor

**Status:** proposed
**Date:** 2026-05-09 (placeholder) — 2026-05-10 (proposal)

## Context

`goals/GOAL.md` defines four success criteria (C1–C4) — multi-requirement
concurrency, no irreplaceable closed-source dependence, intervention budget,
async non-blocking — that all rely on a continuously-running observability
**monitor**: a system-level instrumentation surface that samples agent
invocations, requirement state, intervention events, and concurrency, and
that computes the metrics underlying each criterion's verdict.

GOAL.md names this monitor as a first-class engineering deliverable, not a
nice-to-have. Without it, every C1–C4 verdict at every periodic review
degrades to `unclear`, which is exactly the state the project has been in
for 13 consecutive `goals/record.md` entries. With decision 006 (substrate
↔ HarnessType cut) implemented, the monitor is now the single biggest
load-bearing piece left before the goal becomes measurable.

## Recommendation

Build the monitor as **a peer of `HarnessRegistry` inside the daemon**,
sourced from the existing `EventBus` plus periodic state polls, with a
**single in-process rolling-window store** and **HTTP +SSE endpoints
that the existing semajsx web UI consumes**. No new infrastructure
dependency. The monitor is one module under
`packages/agent-worker/src/monitor/`; the web UI gets a new top-level
**Monitor** view on the dashboard that surfaces every C1–C4 metric live.

The monitor is **evidence-producing, not verdict-producing**. It computes
the numeric metrics named in GOAL.md and exposes them; the goal-driven
review flow (`goals/record.md` entries) still owns `✓ / ✗ / unclear`
verdicts. The monitor's contract is: "given the data I sample, here are
the GOAL-defined metrics and their values right now." Whether those
values pass the threshold for a criterion is a human read.

## Architecture

```
┌─────────────────────── Daemon ────────────────────────┐
│                                                        │
│   HarnessRegistry ──► Harness instances                │
│         │                                              │
│         │ (events / state polls)                       │
│         ▼                                              │
│   EventBus ──────► Monitor ◄── periodic state snapshot │
│                       │                                │
│                       ├─ rolling window (in-memory)    │
│                       ├─ binding inventory             │
│                       ├─ intervention log              │
│                       └─ derived metrics (C1–C4)       │
│                       │                                │
│                       ▼                                │
│              HTTP routes + SSE stream                  │
│                       │                                │
└───────────────────────┼────────────────────────────────┘
                        │
                        ▼
              Web UI Monitor view
              (dashboard panel + dedicated /monitor page)
```

### Where it lives

`packages/agent-worker/src/monitor/`:
- `monitor.ts` — `Monitor` class. Subscribes to the `EventBus`, polls
  registry state on a 1-second tick, owns the rolling-window store,
  computes derived metrics on demand (per-request).
- `samples.ts` — in-memory tiered rolling store: 1-second resolution for
  the last hour, 1-minute resolution for the last 24 hours, 1-hour
  resolution for the last 30 days. Older buckets are eagerly aged out.
  All state in-process; restart loses history (acceptable — the goal is
  ongoing visibility, not durable audit).
- `bindings.ts` — static binding inventory. Reads each Harness's resolved
  agent config, tags every binding as `closed | open | unknown`, records
  whether an OSS fallback is configured. Re-reads on harness add/remove.
- `interventions.ts` — pushed log of `authorization | acceptance |
  rescue | other` intervention events with timestamps, requirement ids,
  triggering context, and notification-to-response latency.
- `metrics.ts` — pure functions that turn rolling samples + binding
  inventory + intervention log into the C1–C4 metrics named in
  GOAL.md.
- `types.ts` — `MonitorSnapshot`, `Sample`, `Intervention`,
  `BindingEntry`, the per-criterion metric shapes.

### Sampling strategy

| Source                                | Cadence                        | Stored in              |
|---------------------------------------|--------------------------------|------------------------|
| Active agent count, active-requirement count, pending-on-auth count, structural cap | 1-second poll of registry | rolling-window samples |
| Agent invocation start/end, intervention events (auth / acceptance / rescue), wake terminal | Pushed via EventBus subscription | interventions log + samples |
| Binding configuration                 | On harness add / config reload | binding inventory      |

Sub-second sampling is unnecessary for human-readable verdicts; 1Hz keeps
in-memory cost trivial and matches GOAL.md's metric definitions
(time-share percentages, daily counts).

### Storage

In-process. The rolling-window store holds:
- Last 3600 samples at 1s resolution (1 hour, ~3600 entries × ~50 bytes ≈ 180KB)
- Last 1440 buckets at 1m resolution (24 hours, ~70KB)
- Last 720 buckets at 1h resolution (30 days, ~36KB)
- Intervention events for the last 30 days (capped at 10K entries, ~1MB)

Total memory budget: under 2MB for an active workspace. Daemon restart
loses history — deliberate, since the goal is *ongoing visibility*, not
forensic audit. The existing `events.jsonl` durably records the events
the monitor derives from; offline reconstruction from the JSONL is a
future enhancement, not in scope here.

### HTTP + SSE surface

New routes under `/monitor`:
- `GET /monitor/snapshot` — current snapshot of all metrics + last
  N=20 intervention events. Default page-load read.
- `GET /monitor/stream` — SSE stream of monitor events (sample tick,
  intervention, binding change). Emits a structured `MonitorEvent`
  JSON object per event.
- `GET /monitor/bindings` — full binding inventory.
- `GET /monitor/interventions?limit=N&since=cursor` — cursor-based
  pagination of intervention log.

All routes share the existing daemon auth (bearer token; localhost
exempt). No new auth layer.

### Web UI integration

New top-level page accessible via the sidebar (`/monitor` hash route),
plus a compact summary panel embedded on the dashboard view.

**Monitor page layout (single page):**
- **C1 — Concurrency.** Live counter (active agents / active requirements
  / pending-on-auth), 30-day peak, structural cap, 24-hour concurrency
  time-share distribution as a small inline bar chart.
- **C2 — OSS fallback.** Binding inventory table: each row is one
  binding with closed/open status and OSS-fallback-configured flag.
  Uncovered + failed counts at top. Reachability gauge (counterfactual
  share — see Open question 1 below for the pragmatic implementation).
- **C3 — Intervention budget.** Rescue ratio (rescue / total
  interventions), per-requirement (auth + acceptance) average,
  response-latency histogram. Live feed of recent interventions
  underneath, color-coded by type (rescue is the failure signal).
- **C4 — Async non-blocking.** All-silent ratio, auth-wait non-blocking
  utilization, phantom-block events count. Live activity sparkline
  showing active-agent count over the last hour.

The dashboard summary panel shows a compact "C1 ✓ · C2 ✓ · C3 ⚠ · C4 ✓"
strip with one-line metric values, linking through to the full Monitor
page.

The web UI subscribes to `/monitor/stream` for live updates and falls
back to polling `/monitor/snapshot` every 5 seconds when SSE is
unavailable (existing pattern in the dashboard's events panel).

### Verdict policy

The monitor renders metric values, not verdicts. The Monitor page
shows the relevant GOAL.md threshold next to each metric value (e.g.
"all-silent ratio: 12% — threshold ≤ 20% from month 4") so a human
reading the page immediately sees compliance, but the page does not
print `✓` / `✗` next to a criterion. Recording a `✓` / `✗` /
`unclear` entry into `goals/record.md` remains a human-author
operation backed by the metric values the monitor has rendered.

### Inv-2 hard check

Inv-2 ("every agent capability binding has an OSS fallback configured")
is structurally checked by the binding inventory at harness add /
config-reload time. Violations emit a `binding.uncovered` event onto
the bus and surface on the Monitor page; downstream tooling (future
slice) can enforce by rejecting harness configs that fail the check.
For this slice, surfacing is enough.

Inv-1 and Inv-3 are intrinsically guaranteed by code structure and the
acceptance protocol respectively; the monitor does not check them at
runtime.

## Alternatives seriously considered

- **Sidecar process consuming JSONL.** Strongest case: cleanest
  separation, monitor crash can't take down the daemon, future-proof
  for scaling out. Rejected: the daemon is the single source of truth
  for live registry state, and re-reading + reconstructing the live
  state from JSONL is more code than just owning the in-process
  monitor. Restart loses rolling history either way; durability isn't
  what the JSONL gives us here.
- **Dedicated TSDB (Prometheus / DuckDB / sqlite).** Strongest case:
  rich queries, alerting, integration with off-the-shelf dashboards.
  Rejected for now: introduces a new infra dependency and a new
  surface to operate. The metrics named in GOAL.md are simple enough
  to compute from a small in-memory rolling store; we can promote to
  a TSDB if and when query patterns outgrow the simple computation.
- **Per-criterion verdict in code.** Strongest case: the monitor
  could just print `✓` / `✗` and remove human bookkeeping. Rejected:
  the goal-driven protocol explicitly treats the human as the
  verdict source of truth; the monitor's job is to reduce
  `unclear` by providing data, not to eliminate the review.
- **Bigger first slice (all four criteria + UI in one go).**
  Rejected: too large to land cleanly in one verifiable cut. The
  staged plan below lands one criterion end-to-end first, then
  fills the rest as bounded follow-ups.

## Open questions (resolved at proposal time)

1. **Counterfactual reachability for C2.** Pragmatic implementation:
   reachability = `(invocations whose binding has an OSS fallback
   configured AND the fallback's configured success rate over the last
   30 days is non-zero) / (total invocations)`. Counterfactual replay
   is out of scope; the metric is a static-config + observed-success
   blend, which is honest about what we can compute cheaply.
2. **Sample-write contention.** Single-writer model: only the
   `Monitor` instance writes samples; readers (HTTP routes) snapshot a
   slice. No locks beyond JS's single-threaded event loop.
3. **Binding inventory invalidation.** Re-read on every Harness add,
   remove, or YAML reload (file watcher already exists in the
   harness-registry). Cache otherwise.
4. **Goal review integration.** The Monitor page links to
   `goals/record.md` (via a project-relative link displayed on the
   page) and prints the threshold each metric is being measured
   against. This is the integration: data on one side, human review
   protocol on the other side, neither swallowing the other.

## Implementation plan

Five slices, each independently verifiable:

1. **Backend skeleton + C1 metric + Monitor page shell.** New
   `monitor/` module, `Monitor` class subscribing to bus + 1Hz polling,
   `MonitorSnapshot` type, `/monitor/snapshot` and `/monitor/stream`
   routes, web UI Monitor page with the C1 panel and the dashboard
   summary strip. Verifiable by: snapshot endpoint returns sane data,
   web UI shows live concurrency counters, peak persists across
   active-window samples.
2. **C3 intervention tracking.** Wire EventBus events for `agent.run.*`
   and a new `agent.intervention.*` family; intervention log writes;
   compute rescue-ratio + per-requirement counts + response-latency
   distribution. Web UI fills the C3 panel.
3. **C4 silence tracking.** Compute all-silent ratio, auth-wait
   non-blocking utilization, phantom-block events. Web UI fills the
   C4 panel.
4. **C2 binding inventory + reachability.** Read harness config on
   add/reload, build the binding table, compute uncovered + failed
   counts and the (static-config + observed-success) reachability
   metric. Web UI fills the C2 panel.
5. **Inv-2 enforcement hook.** Surface uncovered-binding events as
   sidebar warnings; optionally refuse harness creates that fail the
   check (gated behind a config flag at first).

Each slice is an end-to-end vertical: backend metric + HTTP route +
web UI panel, no scaffolding-only work. The scope of *this proposal*
is approval for the architecture; slice 1 lands as the first
implementing commit.

## Non-goals

- Durable historical metric storage (sqlite/parquet/TSDB). In-process
  rolling window is enough for daily visibility; promote later if needed.
- Cross-daemon aggregation (multi-host). Single-daemon is the only
  current deployment.
- Alerting / paging integrations (PagerDuty, Slack alarms). Surfacing
  on the web UI is the only output channel for this slice.
- Replacing `goals/record.md` review. The monitor produces evidence;
  humans still record verdicts.
- Inv-1 and Inv-3 runtime checks. Both are guaranteed structurally;
  runtime instrumentation would be ceremony.

## References

- `goals/GOAL.md` — success criteria depending on this monitor; metric
  definitions and thresholds.
- `design/DESIGN.md` — `EventBus` and JSONL telemetry surfaces.
- `design/packages/harness.md` — substrate's `eventLog` and
  `harnessTypeRegistry`.
- `design/packages/web.md` — semajsx web UI conventions the new
  Monitor view follows.
- `006-harness-as-agent-environment.md` — implemented; the monitor
  reads from the now-stable substrate ↔ HarnessType boundary.
