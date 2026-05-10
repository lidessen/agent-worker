// Pure metric computation from the rolling sample store.
// Slice 1 covers C1; slice 2 adds C3; slice 3 adds C4; slice 4 adds C2.

import type {
  C1Metrics,
  C2Metrics,
  C3Metrics,
  C4Metrics,
  ConcurrencySample,
  BindingEntry,
} from "./types.ts";
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

/** GOAL.md C2 thresholds. */
export const C2_THRESHOLDS: C2Metrics["thresholds"] = {
  uncoveredCountMax: 0,
  failedCountMax: 0,
  reachabilityMin: 0.7,
};

export function computeC2(bindings: BindingEntry[]): C2Metrics {
  const bySource = { closed: 0, open: 0, unknown: 0 };
  let uncoveredCount = 0;
  for (const b of bindings) {
    bySource[b.source]++;
    if (!b.ossFallbackConfigured) uncoveredCount++;
  }
  const total = bindings.length;
  const reachableCount = bindings.filter((b) => b.ossFallbackConfigured).length;
  const reachability = total === 0 ? 0 : reachableCount / total;
  return {
    uncoveredCount,
    failedCount: 0, // observed-success telemetry not collected yet
    reachability,
    totalBindings: total,
    bySource,
    bindings,
    thresholds: C2_THRESHOLDS,
  };
}

/** GOAL.md C4 thresholds, surfaced verbatim. */
export const C4_THRESHOLDS: C4Metrics["thresholds"] = {
  allSilentRatioMax: 0.2,
  authWaitNonBlockingUtilizationMin: 0.8,
  phantomBlockEventsMaxPerMonth: 5,
};

export function computeC4(store: RollingSampleStore): C4Metrics {
  const samples = store.allSeconds();

  let unfinishedSamples = 0;
  let allSilentSamples = 0;
  let authWaitWindowSamples = 0;
  let authWaitNonBlockingSamples = 0;
  let phantomBlockEvents = 0;
  let inPhantomBlock = false;

  for (const sample of samples) {
    const otherRequirements = sample.activeRequirements - sample.pendingOnAuth;
    const unfinished = sample.activeRequirements > 0 || sample.pendingOnAuth > 0;
    const allSilent = unfinished && sample.activeAgents === 0;

    // C4 primary: all-silent ratio.
    if (unfinished) {
      unfinishedSamples++;
      if (allSilent) allSilentSamples++;
    }

    // C4 secondary: auth-wait non-blocking utilization. The window
    // requires auth pending AND another non-blocked requirement.
    const authWaitWindow = sample.pendingOnAuth > 0 && otherRequirements > 0;
    if (authWaitWindow) {
      authWaitWindowSamples++;
      if (sample.activeAgents > 0) authWaitNonBlockingSamples++;
    }

    // Phantom-block: auth pending + other requirement + 0 active.
    // Count each continuous span as one event (transition into the
    // state).
    const phantom = authWaitWindow && sample.activeAgents === 0;
    if (phantom && !inPhantomBlock) phantomBlockEvents++;
    inPhantomBlock = phantom;
  }

  const allSilentRatio = unfinishedSamples === 0 ? 0 : allSilentSamples / unfinishedSamples;
  const authWaitNonBlockingUtilization =
    authWaitWindowSamples === 0 ? 0 : authWaitNonBlockingSamples / authWaitWindowSamples;

  return {
    allSilentRatio,
    authWaitNonBlockingUtilization,
    phantomBlockEvents,
    windowSamples: samples.length,
    thresholds: C4_THRESHOLDS,
  };
}

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
