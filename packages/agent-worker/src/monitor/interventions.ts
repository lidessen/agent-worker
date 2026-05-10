// Intervention log (slice 2 / C3).
//
// Pushes from the EventBus subscription land here. The store is a
// capped list; reads compute aggregates over the window.

import type { Intervention, InterventionType } from "./types.ts";

const MAX_INTERVENTIONS = 10_000;
const RECENT_CAP = 30;

export class InterventionLog {
  private readonly entries: Intervention[] = [];

  push(intv: Intervention): void {
    this.entries.push(intv);
    if (this.entries.length > MAX_INTERVENTIONS) {
      // Drop oldest in chunks to avoid O(n) shift on every push.
      this.entries.splice(0, this.entries.length - MAX_INTERVENTIONS);
    }
  }

  /** Aggregate counts by type over the trailing window (default 30 days). */
  totalsSince(cutoffMs: number): Record<InterventionType, number> & { total: number } {
    const totals = {
      authorization: 0,
      acceptance: 0,
      rescue: 0,
      other: 0,
      total: 0,
    } as Record<InterventionType, number> & { total: number };
    for (const e of this.entries) {
      if (e.ts < cutoffMs) continue;
      totals[e.type]++;
      totals.total++;
    }
    return totals;
  }

  /** Most recent N entries (newest first). */
  recent(n: number = RECENT_CAP): Intervention[] {
    if (this.entries.length === 0) return [];
    const start = Math.max(0, this.entries.length - n);
    return this.entries.slice(start).reverse();
  }
}
