// Monitor store — subscribes to /monitor/stream + falls back to
// /monitor/snapshot polling. Exposes a `snapshot` signal the
// MonitorView and dashboard summary strip read from.

import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { ConcurrencySample, MonitorSnapshot } from "../api/types.ts";

export const monitorSnapshot = signal<MonitorSnapshot | null>(null);
export const monitorRecentSamples = signal<ConcurrencySample[]>([]);
export const isMonitorStreaming = signal<boolean>(false);

let abortController: AbortController | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let currentSessionId = 0;

const RECENT_SAMPLE_CAP = 60; // last 60 samples ≈ 1 minute at 1Hz

export async function loadMonitorSnapshot(): Promise<void> {
  const c = client.value;
  if (!c) return;
  try {
    const snap = await c.monitorSnapshot();
    monitorSnapshot.value = snap;
    if (snap.c1.current) {
      monitorRecentSamples.update((prev) => {
        const next = [...prev, snap.c1.current];
        return next.length > RECENT_SAMPLE_CAP ? next.slice(-RECENT_SAMPLE_CAP) : next;
      });
    }
  } catch (err) {
    console.error("Failed to load monitor snapshot:", err);
  }
}

export async function startMonitorStream(): Promise<void> {
  const c = client.value;
  if (!c) return;
  if (isMonitorStreaming.value) return;

  const sid = ++currentSessionId;
  abortController = new AbortController();
  isMonitorStreaming.value = true;

  try {
    const stream = c.streamMonitor({ signal: abortController.signal });
    for await (const evt of stream) {
      if (sid !== currentSessionId) break;
      if (evt.kind === "snapshot") {
        monitorSnapshot.value = evt.snapshot;
        const sample = evt.snapshot.c1.current;
        if (sample) {
          monitorRecentSamples.update((prev) => {
            const next = [...prev, sample];
            return next.length > RECENT_SAMPLE_CAP ? next.slice(-RECENT_SAMPLE_CAP) : next;
          });
        }
      } else if (evt.kind === "sample") {
        monitorRecentSamples.update((prev) => {
          const next = [...prev, evt.sample];
          return next.length > RECENT_SAMPLE_CAP ? next.slice(-RECENT_SAMPLE_CAP) : next;
        });
        // Keep snapshot's current sample in sync without an extra request.
        const snap = monitorSnapshot.value;
        if (snap) {
          monitorSnapshot.value = {
            ...snap,
            c1: { ...snap.c1, current: evt.sample },
          };
        }
      } else if (evt.kind === "intervention") {
        // A new intervention surfaced; nudge the snapshot so the C3
        // panel re-renders. Cheaper than a full GET; only the c3
        // slice changes.
        const snap = monitorSnapshot.value;
        if (snap?.c3) {
          const totalsCopy = { ...snap.c3.totals };
          totalsCopy[evt.intervention.type]++;
          totalsCopy.total++;
          const rescueRatio =
            totalsCopy.total === 0 ? 0 : totalsCopy.rescue / totalsCopy.total;
          monitorSnapshot.value = {
            ...snap,
            c3: {
              ...snap.c3,
              totals: totalsCopy,
              rescueRatio,
              recent: [evt.intervention, ...snap.c3.recent].slice(0, 30),
            },
          };
        } else {
          // Snapshot didn't have C3 yet (first event in life) — pull a
          // fresh snapshot. Cheap and rare.
          void loadMonitorSnapshot();
        }
      }
    }
  } catch (err) {
    // AbortError is expected on stop; anything else is logged.
    if ((err as { name?: string })?.name !== "AbortError") {
      console.error("Monitor stream error; falling back to polling:", err);
      startMonitorPolling();
    }
  } finally {
    if (sid === currentSessionId) {
      isMonitorStreaming.value = false;
    }
  }
}

export function stopMonitorStream(): void {
  currentSessionId++;
  abortController?.abort();
  abortController = null;
  isMonitorStreaming.value = false;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Polling fallback when SSE is unavailable. */
function startMonitorPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void loadMonitorSnapshot();
  }, 5000);
}
