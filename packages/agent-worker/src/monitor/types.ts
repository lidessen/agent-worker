// Observability monitor — shared shapes (decision 004 slice 1).
//
// The monitor surfaces the metrics named in `goals/GOAL.md` so that
// every C1–C4 verdict the human writes in `goals/record.md` has live
// numeric evidence behind it. The monitor *does not* compute verdicts;
// `MonitorSnapshot` is purely a numeric description plus the GOAL.md
// thresholds that define each criterion.

/** A single 1-second sample of registry-state counters. */
export interface ConcurrencySample {
  /** Millisecond timestamp at which the sample was taken. */
  ts: number;
  /** Number of agent runs currently in flight. */
  activeAgents: number;
  /** Number of running requirements (one per active dispatch / task). */
  activeRequirements: number;
  /** Requirements blocked on user authorization (tool-layer interception). */
  pendingOnAuth: number;
  /** Configured maximum concurrent dispatches across all harnesses. */
  structuralCap: number;
}

/** C1 — multi-requirement concurrency metric block. */
export interface C1Metrics {
  /** Latest sample. */
  current: ConcurrencySample;
  /** Highest `activeRequirements` value observed in the last 30 days. */
  peak30d: number;
  /** Time-share distribution over the last 24 hours of `activeRequirements`. */
  timeShare24h: {
    /** Fraction of sampled time at concurrency ≥ 3. */
    ge3: number;
    /** Fraction of sampled time at concurrency = 2. */
    eq2: number;
    /** Fraction of sampled time at concurrency = 1. */
    eq1: number;
    /** Fraction of sampled time at concurrency = 0. */
    eq0: number;
  };
  /** GOAL.md thresholds, surfaced verbatim for the UI. */
  thresholds: {
    /** Hard: structural cap must be ≥ this. */
    structuralCapMin: number;
    /** Hard: 30-day peak must be ≥ this (≥2 acceptable in startup). */
    peak30dMin: number;
    /** Baseline-then-set: time-share at concurrency ≥ 2 ≥ this from month 4. */
    timeShareGe2Min: number;
  };
}

/** Full snapshot returned by `GET /monitor/snapshot`. */
export interface MonitorSnapshot {
  /** Server-side wall-clock at snapshot generation. */
  ts: number;
  /** Daemon uptime in seconds (samples older than this are not yet observed). */
  uptimeSec: number;
  c1: C1Metrics;
  /** Slice 4 will fill this. */
  c2?: unknown;
  c3?: C3Metrics;
  /** Slice 3 will fill this. */
  c4?: unknown;
}

// ── Interventions (slice 2 / C3) ──────────────────────────────────────────

/**
 * Intervention type taxonomy from GOAL.md C3:
 *   - `authorization` — system actively raises a tool-layer auth request.
 *   - `acceptance`    — system reports "done; please review".
 *   - `rescue`        — system reports "stuck; need direction / hint".
 *                        This is the failure signal.
 *   - `other`         — user-initiated interruption (does NOT count as
 *                        the system bothering the user).
 */
export type InterventionType = "authorization" | "acceptance" | "rescue" | "other";

export interface Intervention {
  /** Stable id (timestamp + nanoid). */
  id: string;
  /** Millisecond timestamp at which the intervention surfaced. */
  ts: number;
  type: InterventionType;
  /** Harness key this intervention came out of (when scoped). */
  harness?: string;
  /** Agent name involved (when scoped). */
  agent?: string;
  /** Free-text reason / context. */
  reason?: string;
  /**
   * Optional response latency in ms — measured on intervention close
   * (e.g. user accepts an acceptance request) when the close path
   * reports back. Slice 2 emits open events; close-side latency is
   * filled by future slices when the close path lands.
   */
  responseLatencyMs?: number;
}

export interface C3Metrics {
  /** Last 30-day intervention totals broken out by type. */
  totals: { authorization: number; acceptance: number; rescue: number; other: number; total: number };
  /** rescue / total — the failure signal. 0 when total is 0. */
  rescueRatio: number;
  /** Rolling per-requirement (auth + acceptance) count over the
   *  last 30 days; an approximation since requirement boundaries are
   *  not first-class yet. */
  perRequirementAuthAcceptance: number;
  /** Recent interventions (most recent first), capped for the panel. */
  recent: Intervention[];
  thresholds: {
    /** From month 4: rescueRatio ≤ this. */
    rescueRatioMax: number;
    /** From month 4: per-requirement (auth + acceptance) ≤ this. */
    perRequirementAuthAcceptanceMax: number;
  };
}

/** SSE event body emitted by `GET /monitor/stream`. */
export type MonitorEvent =
  | { kind: "sample"; sample: ConcurrencySample }
  | { kind: "snapshot"; snapshot: MonitorSnapshot }
  | { kind: "intervention"; intervention: Intervention };
