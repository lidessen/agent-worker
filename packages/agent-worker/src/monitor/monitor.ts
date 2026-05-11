// Daemon-side observability monitor.
//
// Owned by the daemon as a peer of `HarnessRegistry`. Subscribes to the
// process-level `EventBus` and polls the registry for live state on a
// 1Hz tick. Each tick produces one `ConcurrencySample` that feeds the
// rolling-window store. Snapshots are computed on demand by the HTTP
// route (no precomputed cache; metric work is cheap relative to the
// sample-window size).
//
// Per decision 004, the monitor produces evidence (numeric metrics
// against GOAL.md thresholds), not verdicts. Verdict authoring stays
// human-owned in `goals/record.md`.

import type { EventBus, BusEvent } from "@agent-worker/shared";
import type { HarnessRegistry } from "../harness-registry.ts";
import type { Harness } from "@agent-worker/harness";
import { coordinationRuntime, COORDINATION_HARNESS_TYPE_ID } from "@agent-worker/harness-coordination";
import { RollingSampleStore } from "./samples.ts";
import { InterventionLog } from "./interventions.ts";
import { computeC1, computeC2, computeC3, computeC4 } from "./metrics.ts";
import { buildInventory } from "./bindings.ts";
import type {
  ConcurrencySample,
  Intervention,
  InterventionType,
  MonitorEvent,
  MonitorSnapshot,
} from "./types.ts";

/** How frequently we poll registry state and emit a sample (ms). */
const TICK_MS = 1000;

export interface MonitorOptions {
  /** Override poll cadence — useful for tests. */
  tickMs?: number;
}

/** Subscriber callback for the SSE/WebSocket fan-out. */
export type MonitorSubscriber = (event: MonitorEvent) => void;

export class Monitor {
  private readonly tickMs: number;
  private readonly samples = new RollingSampleStore();
  private readonly interventions = new InterventionLog();
  private readonly subscribers = new Set<MonitorSubscriber>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private busOff: (() => void) | null = null;
  private readonly startedAt = Date.now();
  private interventionSeq = 0;
  private readonly pendingAuthorizations = new Set<string>();

  constructor(
    private readonly registry: HarnessRegistry,
    private readonly bus: EventBus,
    options: MonitorOptions = {},
  ) {
    this.tickMs = options.tickMs ?? TICK_MS;
  }

  /** Start the polling loop and EventBus subscription. */
  start(): void {
    if (this.timer) return;
    this.busOff = this.bus.on((event) => this.onBusEvent(event));
    this.timer = setInterval(() => {
      void this.tick();
    }, this.tickMs);
    // Fire the first tick immediately so /monitor/snapshot doesn't
    // return zeros for the first second of daemon life.
    void this.tick();
  }

  /** Stop the polling loop and unsubscribe. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.busOff) {
      this.busOff();
      this.busOff = null;
    }
  }

  /** Generate a snapshot of all metrics + thresholds. */
  snapshot(): MonitorSnapshot {
    const fallback: ConcurrencySample = {
      ts: Date.now(),
      activeAgents: 0,
      activeRequirements: 0,
      pendingOnAuth: 0,
      structuralCap: 0,
    };
    const c1 = computeC1(this.samples, fallback);
    const inventory = buildInventory(this.registry);
    return {
      ts: Date.now(),
      uptimeSec: Math.floor((Date.now() - this.startedAt) / 1000),
      c1,
      c2: computeC2(inventory),
      c3: computeC3(this.interventions, c1.peak30d),
      c4: computeC4(this.samples),
    };
  }

  /**
   * Record a manually-supplied intervention. Used for paths that
   * don't go through the bus (CLI prompts, future tool-permission
   * dialogs, …).
   */
  recordIntervention(input: {
    type: InterventionType;
    harness?: string;
    agent?: string;
    reason?: string;
    responseLatencyMs?: number;
  }): Intervention {
    const intv: Intervention = {
      id: `intv-${Date.now()}-${this.interventionSeq++}`,
      ts: Date.now(),
      ...input,
    };
    this.interventions.push(intv);
    this.emit({ kind: "intervention", intervention: intv });
    return intv;
  }

  /** Subscribe to live monitor events. Returns an unsubscribe function. */
  subscribe(fn: MonitorSubscriber): () => void {
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    const sample = await this.collectSample();
    this.samples.push(sample);
    this.emit({ kind: "sample", sample });
  }

  private async collectSample(): Promise<ConcurrencySample> {
    const ts = Date.now();
    let activeAgents = 0;
    let activeRequirements = 0;
    const pendingOnAuth = this.pendingAuthorizations.size;
    let structuralCap = 0;

    // Walk every managed harness; sum across them.
    for (const harness of this.iterHarnesses()) {
      try {
        // Active agents: any whose status is "running".
        const statuses = await harness.contextProvider.status.getAll();
        for (const entry of statuses) {
          if (entry.status === "running") activeAgents++;
        }

        if (harness.harnessTypeId === COORDINATION_HARNESS_TYPE_ID) {
          const coord = coordinationRuntime(harness);

          // Active requirements: queued instructions + agents with
          // *pending* inbox entries are both "in flight" from the
          // user-requirement perspective. Inbox entries in `seen`
          // (already processed) or `deferred` (parked) state aren't
          // active work — counting them as such inflates concurrency
          // and pushes C4 silent-ratio toward 100% even when the
          // system has nothing real to do. Approximation overall
          // since today there is no first-class Requirement type
          // (decision 005's Task projection lands one).
          activeRequirements += coord.instructionQueue.listAll().length;
          for (const entry of statuses) {
            const inbox = await harness.contextProvider.inbox.inspect(entry.name);
            const pending = inbox.some((e) => e.state === "pending");
            if (pending) activeRequirements++;
          }

          // Structural cap: each registered agent runs its own
          // orchestrator polling the queue, so the system's structural
          // concurrency ceiling is the agent count. GOAL.md C1 reads
          // "system is configurationally not allowed to be single-
          // threaded" — N agents is exactly that ceiling.
          structuralCap += coord.agentChannels.size;
        }
      } catch (err) {
        // Single-harness failure shouldn't kill the sample.
        console.error(
          `[monitor] sample error for harness ${harness.name}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    return {
      ts,
      activeAgents,
      activeRequirements: activeRequirements + pendingOnAuth,
      pendingOnAuth,
      structuralCap,
    };
  }

  /**
   * Iterate every managed `Harness` instance the daemon knows about.
   * Mirrors the registry's accessors but treats the default harness +
   * registered harnesses uniformly.
   */
  private *iterHarnesses(): Iterable<Harness> {
    // The registry's `list()` returns ManagedHarnessInfo; we need the
    // underlying Harness instance. Use the package-private accessor
    // that managed-harness exposes via its `harness` getter, accessed
    // through the registry's iteration helpers.
    for (const managed of this.registry.iterManaged()) {
      yield managed.harness;
    }
  }

  /**
   * Translate selected `EventBus` events into `Intervention` records
   * (slice 2 / C3). The mapping is deliberately conservative so we
   * don't double-count or treat ordinary error logging as a rescue
   * signal:
   *   - `harness.agent_error` with a fatal-strategy payload → rescue.
   *     Non-fatal errors are recovery-handled by the orchestrator and
   *     never reach the human.
   *   - `harness.kickoff_task_failed` → rescue.
   *   - `harness.completed` → acceptance. The harness reached a
   *     drained state and is asking the human to review.
   *   - `harness.authorization_required` → authorization + pending
   *     C4 auth-wait marker.
   *   - `harness.authorization_resolved` / next run start → clears
   *     the pending marker.
   * Future signal sources (user-initiated stop) will surface as
   * additional types when they land.
   */
  private onBusEvent(event: BusEvent): void {
    const harness = typeof event.harness === "string" ? event.harness : undefined;
    const agent = typeof event.agent === "string" ? event.agent : undefined;
    const pendingKey = this.authorizationKey(harness, agent);

    if (pendingKey && event.type === "harness.agent_run_start") {
      this.pendingAuthorizations.delete(pendingKey);
    }

    if (event.type === "harness.agent_error") {
      const strategy = event.strategy as { fatal?: boolean; reason?: string } | undefined;
      if (strategy?.fatal) {
        this.recordIntervention({
          type: "rescue",
          harness,
          agent,
          reason: `fatal: ${strategy.reason ?? "agent stopped"}`,
        });
      }
      return;
    }

    if (event.type === "harness.authorization_required") {
      if (pendingKey) this.pendingAuthorizations.add(pendingKey);
      this.recordIntervention({
        type: "authorization",
        harness,
        agent,
        reason: typeof event.reason === "string" ? event.reason : "authorization required",
      });
      return;
    }

    if (event.type === "harness.authorization_resolved") {
      if (pendingKey) this.pendingAuthorizations.delete(pendingKey);
      return;
    }

    if (event.type === "harness.kickoff_task_failed") {
      this.recordIntervention({
        type: "rescue",
        harness,
        reason: typeof event.error === "string" ? event.error : "kickoff task failed",
      });
      return;
    }

    if (event.type === "harness.completed") {
      this.clearHarnessAuthorizations(harness);
      this.recordIntervention({
        type: "acceptance",
        harness,
        reason: "harness completed; awaiting review",
      });
      return;
    }

    if (event.type === "harness.failed" || event.type === "harness.stopped") {
      this.clearHarnessAuthorizations(harness);
    }
  }

  private authorizationKey(harness?: string, agent?: string): string | null {
    if (!harness || !agent) return null;
    return `${harness}:${agent}`;
  }

  private clearHarnessAuthorizations(harness?: string): void {
    if (!harness) return;
    const prefix = `${harness}:`;
    for (const key of this.pendingAuthorizations) {
      if (key.startsWith(prefix)) this.pendingAuthorizations.delete(key);
    }
  }

  private emit(event: MonitorEvent): void {
    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {
        // Subscribers must not throw; silently drop.
      }
    }
  }
}
