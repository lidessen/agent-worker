import { signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { ChannelMessage } from "../api/types.ts";

export const channelMessages = signal<ChannelMessage[]>([]);
export const channelCursor = signal<number>(0);
export const isChannelStreaming = signal<boolean>(false);
export const isChannelSending = signal<boolean>(false);

let abortController: AbortController | null = null;
let currentSessionId = 0;

export async function loadChannelHistory(wsKey: string, ch: string) {
  const c = client.value;
  if (!c) return;
  try {
    const messages = await c.readChannel(wsKey, ch, { limit: 20 });
    channelMessages.value = messages;
    channelCursor.value = messages.length;
  } catch (err) {
    console.error(`Failed to load channel history for ${wsKey}/${ch}:`, err);
  }
}

export async function startChannelStream(wsKey: string, ch: string) {
  const c = client.value;
  if (!c) return;
  if (isChannelStreaming.value) return;

  const sid = ++currentSessionId;
  abortController = new AbortController();
  isChannelStreaming.value = true;

  // Batch incoming SSE messages to avoid per-message DOM rebuilds.
  // Messages are collected in a buffer and flushed to the signal
  // at most once per animation frame.
  let pendingMessages: ChannelMessage[] = [];
  let flushScheduled = false;

  function flushPending() {
    flushScheduled = false;
    if (pendingMessages.length === 0) return;
    const batch = pendingMessages;
    pendingMessages = [];
    channelMessages.update((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const newMsgs = batch.filter((m) => !ids.has(m.id));
      return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
    });
  }

  try {
    const stream = c.streamChannel(wsKey, ch, {
      cursor: channelCursor.value,
      signal: abortController.signal,
    });

    for await (const msg of stream) {
      if (currentSessionId !== sid) break;
      pendingMessages.push(msg);
      if (!flushScheduled) {
        flushScheduled = true;
        requestAnimationFrame(flushPending);
      }
    }
    // Flush any remaining messages after stream ends
    flushPending();
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.error(`Channel stream error for ${wsKey}/${ch}:`, err);
    }
  } finally {
    isChannelStreaming.value = false;
    abortController = null;
  }
}

export function stopChannelStream() {
  abortController?.abort();
  isChannelStreaming.value = false;
}

export async function sendChannelMessage(wsKey: string, ch: string, text: string) {
  isChannelSending.value = true;

  // Optimistic: push a local message
  const localMsg: ChannelMessage = {
    id: `local-${Date.now()}`,
    channel: ch,
    from: "user",
    content: text,
    timestamp: new Date().toISOString(),
  };
  channelMessages.update((prev) => [...prev, localMsg]);

  const c = client.value;
  if (!c) {
    isChannelSending.value = false;
    return;
  }
  try {
    await c.sendToWorkspace(wsKey, text, { channel: ch });
  } catch (err) {
    console.error(`Failed to send to ${wsKey}/${ch}:`, err);
  } finally {
    isChannelSending.value = false;
  }
}
