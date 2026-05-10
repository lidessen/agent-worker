// Pure metric computation from the rolling sample store.
// Slice 1 covers C1; slice 2 adds C3; slices 3–4 add c4/c2.

import type { C1Metrics, C3Metrics, ConcurrencySample } from "./types.ts";
import type { RollingSampleStore } from "./samples.ts";
import type { InterventionLog } from "./interventions.ts";

/**
 * GOAL.md C1 thresholds, surfaced verbatim so the UI can render the
 * threshold next to each metric value without duplicating numbers.
 */
export const C1_THRESHOLDS: C1Metrics["thresholds"] = {
  structuralCapMin: 3,
  peak30dMin: 3,
  // From month 4 the threshold tightens; the UI knows the date and
  // labels the value accordingly. The number itself is GOAL.md's.
  timeShareGe2Min: 0.2,
};

export function computeC1(store: RollingSampleStore, fallback: ConcurrencySample): C1Metrics {
  const current = store.latest() ?? fallback;
  return {
    current,
    peak30d: store.peakRequirements30d(),
    timeShare24h: store.timeShare24h(),
    thresholds: C1_THRESHOLDS,
  };
}

/** GOAL.md C3 thresholds, surfaced verbatim. */
export const C3_THRESHOLDS: C3Metrics["thresholds"] = {
  rescueRatioMax: 0.05,
  perRequirementAuthAcceptanceMax: 3,
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function computeC3(log: InterventionLog, peak30d: number): C3Metrics {
  const now = Date.now();
  const totals = log.totalsSince(now - THIRTY_DAYS_MS);
  const rescueRatio = totals.total === 0 ? 0 : totals.rescue / totals.total;
  // Per-requirement count uses the 30-day peak as a coarse proxy for
  // requirement volume — acceptable until we wire requirement IDs in
  // a future slice (today the system doesn't tag a "requirement id"
  // through the dispatch path; we approximate with peak volume).
  const requirementCount = Math.max(1, peak30d);
  const perRequirementAuthAcceptance =
    (totals.authorization + totals.acceptance) / requirementCount;
  return {
    totals,
    rescueRatio,
    perRequirementAuthAcceptance,
    recent: log.recent(),
    thresholds: C3_THRESHOLDS,
  };
}
