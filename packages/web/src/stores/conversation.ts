import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { DaemonEvent } from "../api/types.ts";

export const events = signal<DaemonEvent[]>([]);
export const cursor = signal<number>(0);
export const isStreaming = signal<boolean>(false);

let abortController: AbortController | null = null;
let currentSessionId = 0;

export async function loadHistory(agentName: string) {
  const c = client.value;
  if (!c) return;
  try {
    const result = await c.readResponses(agentName);
    events.value = result.entries;
    cursor.value = result.cursor;
  } catch (err) {
    console.error(`Failed to load history for ${agentName}:`, err);
  }
}

export async function startStream(agentName: string) {
  const c = client.value;
  if (!c) return;
  if (isStreaming.value) return;

  const sid = ++currentSessionId;
  abortController = new AbortController();
  isStreaming.value = true;

  try {
    const stream = c.streamResponses(agentName, {
      cursor: cursor.value,
      signal: abortController.signal,
    });

    for await (const event of stream) {
      if (currentSessionId !== sid) break; // stale stream
      events.update((prev) => [...prev, event]);
      if (typeof event.ts === "number") {
        cursor.value = event.ts;
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.error(`Stream error for ${agentName}:`, err);
    }
  } finally {
    isStreaming.value = false;
    abortController = null;
  }
}

export function stopStream() {
  abortController?.abort();
  isStreaming.value = false;
}

export async function sendMessage(agentName: string, text: string) {
  // Optimistic: push a local user event
  const localEvent: DaemonEvent = {
    ts: Date.now(),
    type: "user_message",
    content: text,
  };
  events.update((prev) => [...prev, localEvent]);

  const c = client.value;
  if (!c) return;
  try {
    await c.sendToAgent(agentName, [{ content: text }]);
  } catch (err) {
    console.error(`Failed to send message to ${agentName}:`, err);
  }
}
