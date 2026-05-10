/**
 * Process-level event bus.
 *
 * All layers (loop, agent, harness, daemon) emit structured events
 * to a shared bus. Consumers (JSONL writer, console printer, SSE streamer)
 * subscribe independently — emitters never know who's listening.
 *
 * Design decisions:
 * - Synchronous emit (listeners must not throw).
 * - Optional filtering on subscribe.
 * - AsyncIterable subscribe for streaming consumers.
 */

// ── Event types ──────────────────────────────────────────────────────────────

export type EventLevel = "debug" | "info" | "warn" | "error";

export interface BaseBusEvent {
  /** Millisecond timestamp */
  ts: number;
  /** Dot-namespaced type: "agent.run_start", "daemon.started", etc. */
  type: string;
  /** Originating layer */
  source: "loop" | "agent" | "harness" | "daemon";
  /** Log severity. Default: "info" */
  level?: EventLevel;
  /** Correlation ID for tracing a single run end-to-end */
  runId?: string;
  /** Agent name, when applicable */
  agent?: string;
  /** Harness name, when applicable */
  harness?: string;
}

export interface AgentRuntimeEvent extends BaseBusEvent {
  type: "agent.runtime_event";
  source: "agent";
  eventKind: "tool" | "hook" | "usage";
  phase?: string;
  name?: string;
  callId?: string;
  hookEvent?: string;
  durationMs?: number;
  error?: string;
  outcome?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  /** Cumulative token usage (present when eventKind === "usage"). */
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  contextWindow?: number;
  usedRatio?: number;
  usageSource?: "runtime" | "estimate";
  [key: string]: unknown;
}

export interface BusEvent {
  /** Common event envelope */
  ts: number;
  type: string;
  source: "loop" | "agent" | "harness" | "daemon";
  level?: EventLevel;
  runId?: string;
  agent?: string;
  harness?: string;
  /** Arbitrary payload */
  [key: string]: unknown;
}

export type KnownBusEvent = BusEvent | AgentRuntimeEvent;

export type EventFilter = (event: BusEvent) => boolean;

// ── EventBus ─────────────────────────────────────────────────────────────────

export class EventBus {
  private listeners = new Set<(event: BusEvent) => void>();

  /** Emit an event to all listeners. Partial — `ts` is auto-filled if missing. */
  emit(event: BusEvent | (Omit<BusEvent, "ts"> & { ts?: number })): void {
    const full = { ts: Date.now(), level: "info" as EventLevel, ...event } as BusEvent;
    for (const fn of this.listeners) {
      try {
        fn(full);
      } catch {
        // Listeners must not throw; silently ignore.
      }
    }
  }

  /** Register a listener. Returns an unsubscribe function. */
  on(fn: (event: BusEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Remove a specific listener. */
  off(fn: (event: BusEvent) => void): void {
    this.listeners.delete(fn);
  }

  /** Number of active listeners. */
  get size(): number {
    return this.listeners.size;
  }

  /**
   * Subscribe with optional filter. Returns an AsyncIterable that yields
   * matching events until `cancel()` is called on the returned handle.
   */
  subscribe(filter?: EventFilter): EventSubscription {
    const queue: BusEvent[] = [];
    let resolve: (() => void) | null = null;
    let done = false;

    const listener = (event: BusEvent) => {
      if (filter && !filter(event)) return;
      queue.push(event);
      resolve?.();
      resolve = null;
    };

    this.listeners.add(listener);

    const iterable: AsyncIterable<BusEvent> = {
      [Symbol.asyncIterator]() {
        return {
          async next(): Promise<IteratorResult<BusEvent>> {
            while (true) {
              if (queue.length > 0) {
                return { value: queue.shift()!, done: false };
              }
              if (done) {
                return { value: undefined as unknown as BusEvent, done: true };
              }
              await new Promise<void>((r) => {
                resolve = r;
              });
            }
          },
        };
      },
    };

    return {
      [Symbol.asyncIterator]: () => iterable[Symbol.asyncIterator](),
      cancel: () => {
        done = true;
        this.listeners.delete(listener);
        resolve?.();
        resolve = null;
      },
    };
  }

  /** Remove all listeners. */
  clear(): void {
    this.listeners.clear();
  }
}

export interface EventSubscription extends AsyncIterable<BusEvent> {
  cancel(): void;
}

// ── Global singleton ─────────────────────────────────────────────────────────

/** Process-level shared bus. Import this wherever you need to emit or listen. */
export const bus = new EventBus();
