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
  /** Slice 2+ will fill these in. Present in the type so the UI can render
   *  "not yet measured" placeholders consistently. */
  c2?: unknown;
  c3?: unknown;
  c4?: unknown;
}

/** SSE event body emitted by `GET /monitor/stream`. */
export type MonitorEvent =
  | { kind: "sample"; sample: ConcurrencySample }
  | { kind: "snapshot"; snapshot: MonitorSnapshot };
