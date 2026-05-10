// Tiered rolling-window store for monitor samples.
//
// Three resolutions cover the GOAL.md windows without exploding memory:
//   - 1-second resolution for the last hour     (3600 entries)
//   - 1-minute resolution for the last 24 hours (1440 entries)
//   - 1-hour resolution for the last 30 days    (720 entries)
//
// On each 1Hz tick the monitor pushes one sample; aggregation into the
// minute and hour buckets happens inline. Older buckets are aged out
// eagerly so memory stays roughly bounded.

import type { ConcurrencySample } from "./types.ts";

const SECOND_MS = 1000;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SECOND_WINDOW_MS = HOUR_MS;
const MINUTE_WINDOW_MS = DAY_MS;
const HOUR_WINDOW_MS = 30 * DAY_MS;

/** Aggregated bucket — peak / mean over a window. */
export interface AggBucket {
  /** Bucket start timestamp (ms, aligned to minute or hour boundary). */
  bucketStart: number;
  /** Maximum `activeRequirements` observed in the bucket. */
  peakRequirements: number;
  /** Maximum `activeAgents` observed in the bucket. */
  peakAgents: number;
  /** Number of samples folded into the bucket. */
  count: number;
}

export class RollingSampleStore {
  private seconds: ConcurrencySample[] = [];
  private minutes: AggBucket[] = [];
  private hours: AggBucket[] = [];

  /** Push the latest 1-second sample; ages out older entries inline. */
  push(sample: ConcurrencySample): void {
    this.seconds.push(sample);
    this.foldInto(this.minutes, sample, MINUTE_MS);
    this.foldInto(this.hours, sample, HOUR_MS);

    const now = sample.ts;
    this.dropBefore(this.seconds, now - SECOND_WINDOW_MS);
    this.dropBucketsBefore(this.minutes, now - MINUTE_WINDOW_MS);
    this.dropBucketsBefore(this.hours, now - HOUR_WINDOW_MS);
  }

  /** Latest sample, or `null` if no samples have been pushed yet. */
  latest(): ConcurrencySample | null {
    return this.seconds[this.seconds.length - 1] ?? null;
  }

  /** Highest `activeRequirements` observed across the 30-day hour buckets. */
  peakRequirements30d(): number {
    let peak = 0;
    for (const b of this.hours) {
      if (b.peakRequirements > peak) peak = b.peakRequirements;
    }
    // The current hour bucket is in `this.hours`; minute/second covers
    // the same window so peak30d already includes today.
    return peak;
  }

  /** Time-share distribution over the last 24 hours (aggregated minute buckets). */
  timeShare24h(): { ge3: number; eq2: number; eq1: number; eq0: number } {
    let ge3 = 0;
    let eq2 = 0;
    let eq1 = 0;
    let eq0 = 0;
    let total = 0;
    for (const b of this.minutes) {
      const c = b.peakRequirements;
      if (c >= 3) ge3 += b.count;
      else if (c === 2) eq2 += b.count;
      else if (c === 1) eq1 += b.count;
      else eq0 += b.count;
      total += b.count;
    }
    if (total === 0) return { ge3: 0, eq2: 0, eq1: 0, eq0: 0 };
    return {
      ge3: ge3 / total,
      eq2: eq2 / total,
      eq1: eq1 / total,
      eq0: eq0 / total,
    };
  }

  /** Most recent N seconds-resolution samples (for sparkline rendering). */
  recentSeconds(n: number): ConcurrencySample[] {
    if (n >= this.seconds.length) return this.seconds.slice();
    return this.seconds.slice(this.seconds.length - n);
  }

  /** Full seconds-resolution buffer (last hour). */
  allSeconds(): ConcurrencySample[] {
    return this.seconds.slice();
  }

  // ── internal ──────────────────────────────────────────────────────────

  private foldInto(buckets: AggBucket[], sample: ConcurrencySample, bucketMs: number): void {
    const bucketStart = Math.floor(sample.ts / bucketMs) * bucketMs;
    const last = buckets[buckets.length - 1];
    if (last && last.bucketStart === bucketStart) {
      if (sample.activeRequirements > last.peakRequirements)
        last.peakRequirements = sample.activeRequirements;
      if (sample.activeAgents > last.peakAgents) last.peakAgents = sample.activeAgents;
      last.count++;
    } else {
      buckets.push({
        bucketStart,
        peakRequirements: sample.activeRequirements,
        peakAgents: sample.activeAgents,
        count: 1,
      });
    }
  }

  private dropBefore(samples: ConcurrencySample[], cutoff: number): void {
    while (samples.length > 0 && samples[0]!.ts < cutoff) samples.shift();
  }

  private dropBucketsBefore(buckets: AggBucket[], cutoff: number): void {
    while (buckets.length > 0 && buckets[0]!.bucketStart < cutoff) buckets.shift();
  }
}

// Tests / future replay code may reach in for these constants.
export const __INTERNAL = { SECOND_MS, MINUTE_MS, HOUR_MS, DAY_MS };
