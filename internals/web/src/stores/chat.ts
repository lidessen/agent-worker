// Chat harness store — conversation transcript + per-turn dispatch.
//
// One signal-set per harness key (cached) so multiple chat tabs work
// independently. Streams turns via SSE: while a turn is in flight, a
// `pending` signal carries the partial assistant text so the UI can
// render it growing in real time. On completion, the committed turns
// (returned by the daemon) replace the pending placeholder so the
// transcript reflects the persisted record.

import { signal, type Signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { ChatTurn } from "../api/types.ts";

export interface PendingAssistant {
  /** Text accumulated from `chunk` events; updates in place. */
  content: string;
  /** Optional error if the stream ended in failure. */
  error?: string;
}

interface ChatState {
  turns: Signal<ChatTurn[]>;
  thinking: Signal<boolean>;
  pending: Signal<PendingAssistant | null>;
  error: Signal<string | null>;
  loaded: Signal<boolean>;
}

const cache = new Map<string, ChatState>();

function getOrCreate(key: string): ChatState {
  let state = cache.get(key);
  if (!state) {
    state = {
      turns: signal<ChatTurn[]>([]),
      thinking: signal<boolean>(false),
      pending: signal<PendingAssistant | null>(null),
      error: signal<string | null>(null),
      loaded: signal<boolean>(false),
    };
    cache.set(key, state);
  }
  return state;
}

export function chatTurns(key: string): Signal<ChatTurn[]> {
  return getOrCreate(key).turns;
}

export function chatThinking(key: string): Signal<boolean> {
  return getOrCreate(key).thinking;
}

export function chatPending(key: string): Signal<PendingAssistant | null> {
  return getOrCreate(key).pending;
}

export function chatError(key: string): Signal<string | null> {
  return getOrCreate(key).error;
}

export function chatLoaded(key: string): Signal<boolean> {
  return getOrCreate(key).loaded;
}

/** Load the conversation history for `key` from the daemon. Idempotent. */
export async function loadConversation(key: string): Promise<void> {
  const c = client.value;
  if (!c) return;
  const state = getOrCreate(key);
  if (state.loaded.value) return;
  try {
    const res = await c.chatConversation(key);
    state.turns.value = res.conversation;
    state.loaded.value = true;
  } catch (err) {
    state.error.value = err instanceof Error ? err.message : String(err);
  }
}

/**
 * Send one turn via SSE. The user turn lands as soon as the daemon
 * commits it; the assistant turn grows in `pending` and replaces with
 * the committed record on `done`. On `error`, the persisted error
 * turn (if the dispatcher recorded one) arrives too — we just surface
 * it via the error signal.
 */
export async function sendChatTurn(key: string, content: string): Promise<void> {
  const c = client.value;
  if (!c) return;
  const state = getOrCreate(key);
  if (state.thinking.value) return;
  state.thinking.value = true;
  state.error.value = null;
  state.pending.value = { content: "" };
  try {
    for await (const event of c.streamChatTurn(key, content)) {
      if (event.kind === "user_turn") {
        // Commit the user turn immediately so the input clears even
        // before the assistant produces a single token.
        state.turns.update((prev) => [...prev, event.userTurn]);
      } else if (event.kind === "chunk") {
        state.pending.value = { content: event.accumulated };
      } else if (event.kind === "done") {
        state.turns.update((prev) => [...prev, event.assistantTurn]);
        state.pending.value = null;
        // Flip thinking off synchronously with the commit so the
        // indicator doesn't render for a tick after the assistant
        // bubble appears. The `finally` still covers the
        // exception-on-stream-end path.
        state.thinking.value = false;
      } else if (event.kind === "error") {
        state.error.value = event.message;
        state.pending.value = { content: state.pending.value?.content ?? "", error: event.message };
        state.thinking.value = false;
      }
    }
  } catch (err) {
    state.error.value = err instanceof Error ? err.message : String(err);
  } finally {
    state.thinking.value = false;
    // Pending stays in place if it ended with an error so the UI can
    // show the partial content + error indicator. Clear only when
    // there's nothing useful left to show.
    if (state.pending.value && !state.pending.value.error && !state.pending.value.content) {
      state.pending.value = null;
    }
  }
}
