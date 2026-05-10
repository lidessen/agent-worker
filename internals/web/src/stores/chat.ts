// Chat harness store — conversation transcript + per-turn dispatch.
//
// One signal per harness key (cached) so multiple chat tabs work
// independently without cross-talk. The store is intentionally small:
// load history once on entry, append on send, surface "thinking"
// state while the backend dispatches.

import { signal, type Signal } from "semajsx/signal";
import { client } from "./connection.ts";
import type { ChatTurn } from "../api/types.ts";

interface ChatState {
  turns: Signal<ChatTurn[]>;
  thinking: Signal<boolean>;
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

/** Send one turn; appends user + assistant turns on success. */
export async function sendChatTurn(key: string, content: string): Promise<void> {
  const c = client.value;
  if (!c) return;
  const state = getOrCreate(key);
  if (state.thinking.value) return;
  state.thinking.value = true;
  state.error.value = null;
  try {
    const res = await c.chatTurn(key, content);
    state.turns.update((prev) => [...prev, res.userTurn, res.assistantTurn]);
  } catch (err) {
    state.error.value = err instanceof Error ? err.message : String(err);
  } finally {
    state.thinking.value = false;
  }
}
