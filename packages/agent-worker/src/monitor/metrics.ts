// Pure metric computation from the rolling sample store.
// Slice 1 covers C1 only; slices 2–4 add c2/c3/c4.

import type { C1Metrics, ConcurrencySample } from "./types.ts";
import type { RollingSampleStore } from "./samples.ts";

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
