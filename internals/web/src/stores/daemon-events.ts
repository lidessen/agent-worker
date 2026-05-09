import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { DaemonEvent } from "../api/types.ts";

export const daemonEvents = signal<DaemonEvent[]>([]);
export const daemonEventsCursor = signal<number>(0);
export const isDaemonStreaming = signal<boolean>(false);

let abortController: AbortController | null = null;
let currentSessionId = 0;

export async function loadDaemonEvents() {
  const c = client.value;
  if (!c) return;
  try {
    const result = await c.readDaemonEvents();
    daemonEvents.value = result.entries;
    daemonEventsCursor.value = result.cursor;
  } catch (err) {
    console.error("Failed to load daemon events:", err);
  }
}

export async function startDaemonEventStream() {
  const c = client.value;
  if (!c) return;
  if (isDaemonStreaming.value) return;

  const sid = ++currentSessionId;
  abortController = new AbortController();
  isDaemonStreaming.value = true;

  let pendingEvents: DaemonEvent[] = [];
  let flushScheduled = false;

  function flushPending() {
    flushScheduled = false;
    if (pendingEvents.length === 0) return;
    const batch = pendingEvents;
    pendingEvents = [];
    daemonEvents.update((prev) => [...prev, ...batch]);
  }

  try {
    const stream = c.streamDaemonEvents({
      cursor: daemonEventsCursor.value,
      signal: abortController.signal,
    });

    for await (const evt of stream) {
      if (currentSessionId !== sid) break;
      pendingEvents.push(evt);
      if (!flushScheduled) {
        flushScheduled = true;
        requestAnimationFrame(flushPending);
      }
    }
    flushPending();
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.error("Daemon event stream error:", err);
    }
  } finally {
    isDaemonStreaming.value = false;
    abortController = null;
  }
}

export function stopDaemonEventStream() {
  abortController?.abort();
  isDaemonStreaming.value = false;
}
