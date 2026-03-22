import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { DaemonEvent } from "../api/types.ts";

export const events = signal<DaemonEvent[]>([]);
export const cursor = signal<number>(0);
export const isStreaming = signal<boolean>(false);
export const isSending = signal<boolean>(false);
export const sendError = signal<string | null>(null);
export const streamError = signal<string | null>(null);

let abortController: AbortController | null = null;
let currentSessionId = 0;
let streamRetryCount = 0;
const MAX_STREAM_RETRIES = 3;
const STREAM_RETRY_DELAY = 3000;

export async function loadHistory(agentName: string) {
  const c = client.value;
  if (!c) return;
  try {
    const result = await c.readAgentEvents(agentName);
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
  streamRetryCount = 0;

  await runStream(agentName, sid);
}

async function runStream(agentName: string, sid: number) {
  const c = client.value;
  if (!c) return;

  try {
    const stream = c.streamAgentEvents(agentName, {
      cursor: cursor.value,
      signal: abortController!.signal,
    });

    for await (const event of stream) {
      if (currentSessionId !== sid) break; // stale stream
      events.update((prev) => [...prev, event]);
      if (typeof event.ts === "number") {
        cursor.value = event.ts;
      }
    }
    // Stream ended normally — clear any previous stream error
    streamError.value = null;
    streamRetryCount = 0;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      // Intentional abort, no retry
      streamError.value = null;
    } else {
      console.error(`Stream error for ${agentName}:`, err);
      if (currentSessionId === sid && streamRetryCount < MAX_STREAM_RETRIES) {
        streamRetryCount++;
        streamError.value = `Connection lost. Reconnecting (${streamRetryCount}/${MAX_STREAM_RETRIES})...`;
        await new Promise((r) => setTimeout(r, STREAM_RETRY_DELAY));
        if (currentSessionId === sid) {
          await runStream(agentName, sid);
          return; // skip the finally-like cleanup below
        }
      } else if (streamRetryCount >= MAX_STREAM_RETRIES) {
        streamError.value = "Connection lost. Please refresh the page.";
      }
    }
  } finally {
    isStreaming.value = false;
    abortController = null;
  }
}

export function stopStream() {
  abortController?.abort();
  isStreaming.value = false;
  streamError.value = null;
  streamRetryCount = 0;
}

export async function sendMessage(agentName: string, text: string) {
  // Clear previous send error
  sendError.value = null;
  isSending.value = true;

  // Optimistic: push a local user event
  const localEvent: DaemonEvent = {
    ts: Date.now(),
    type: "user_message",
    content: text,
  };
  events.update((prev) => [...prev, localEvent]);

  const c = client.value;
  if (!c) { isSending.value = false; return; }
  try {
    await c.sendToAgent(agentName, [{ content: text }]);
  } catch (err) {
    console.error(`Failed to send message to ${agentName}:`, err);
    // Remove the optimistic user event
    events.update((prev) =>
      prev.filter((e) => e !== localEvent),
    );
    sendError.value =
      err instanceof Error ? err.message : "Failed to send message";
  } finally {
    isSending.value = false;
  }
}
