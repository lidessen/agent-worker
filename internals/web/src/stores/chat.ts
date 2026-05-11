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
import type { ChatTurn, ChatInfo } from "../api/types.ts";

export interface ChatActivity {
  /** Stable id from the loop's `callId`, or a synthetic per-turn key. */
  id: string;
  /** Tool name (`Bash`, `Read`, `Edit`, `shell`, etc.). */
  name: string;
  /** Raw args; the view distils a one-line summary. */
  args?: Record<string, unknown>;
  status: "running" | "done" | "error";
  durationMs?: number;
  error?: string;
}

export interface PendingAssistant {
  /** Text accumulated from `chunk` events; updates in place. */
  content: string;
  /** Tool invocations observed during the current dispatch, in order. */
  activities: ChatActivity[];
  /** Optional error if the stream ended in failure. */
  error?: string;
}

export interface UsageTotals {
  /** Sum of input tokens across all completed turns this session (in-memory). */
  inputTokens: number;
  /** Sum of output tokens across all completed turns. */
  outputTokens: number;
  /** Sum of total tokens. */
  totalTokens: number;
  /** Number of completed assistant turns observed (the `done` count). */
  turns: number;
}

interface ChatState {
  turns: Signal<ChatTurn[]>;
  thinking: Signal<boolean>;
  pending: Signal<PendingAssistant | null>;
  error: Signal<string | null>;
  loaded: Signal<boolean>;
  info: Signal<ChatInfo | null>;
  usage: Signal<UsageTotals>;
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
      info: signal<ChatInfo | null>(null),
      usage: signal<UsageTotals>({
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        turns: 0,
      }),
    };
    cache.set(key, state);
  }
  return state;
}

export function chatInfo(key: string): Signal<ChatInfo | null> {
  return getOrCreate(key).info;
}

export function chatUsage(key: string): Signal<UsageTotals> {
  return getOrCreate(key).usage;
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

/** Load the conversation history + agent info for `key`. Idempotent. */
export async function loadConversation(key: string): Promise<void> {
  const c = client.value;
  if (!c) return;
  const state = getOrCreate(key);
  if (state.loaded.value) return;
  try {
    const [conv, info] = await Promise.all([c.chatConversation(key), c.chatInfo(key)]);
    state.turns.value = conv.conversation;
    state.info.value = info;
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
  state.pending.value = { content: "", activities: [] };
  try {
    for await (const event of c.streamChatTurn(key, content)) {
      if (event.kind === "user_turn") {
        // Commit the user turn immediately so the input clears even
        // before the assistant produces a single token.
        state.turns.update((prev) => [...prev, event.userTurn]);
      } else if (event.kind === "chunk") {
        state.pending.update((prev) => ({
          content: event.accumulated,
          activities: prev?.activities ?? [],
          error: prev?.error,
        }));
      } else if (event.kind === "tool_call") {
        state.pending.update((prev) => ({
          content: prev?.content ?? "",
          error: prev?.error,
          activities: [
            ...(prev?.activities ?? []),
            { id: event.id, name: event.name, args: event.args, status: "running" },
          ],
        }));
      } else if (event.kind === "tool_result") {
        state.pending.update((prev) => ({
          content: prev?.content ?? "",
          error: prev?.error,
          activities: (prev?.activities ?? []).map((a) =>
            a.id === event.id
              ? {
                  ...a,
                  status: event.error ? "error" : "done",
                  durationMs: event.durationMs,
                  error: event.error,
                }
              : a,
          ),
        }));
      } else if (event.kind === "done") {
        // The turn finishes whether or not the provider emitted a
        // matching `tool_result` for every `tool_call` (claude-code
        // sometimes folds the result into the next assistant message
        // without a discrete event). Treat anything still running at
        // `done` time as a successful completion so the UI doesn't
        // strand a "→" marker once the bubble has committed.
        state.turns.update((prev) => [...prev, event.assistantTurn]);
        state.pending.value = null;
        // Flip thinking off synchronously with the commit so the
        // indicator doesn't render for a tick after the assistant
        // bubble appears. The `finally` still covers the
        // exception-on-stream-end path.
        state.thinking.value = false;
        if (event.usage) {
          state.usage.update((prev) => ({
            inputTokens: prev.inputTokens + event.usage!.inputTokens,
            outputTokens: prev.outputTokens + event.usage!.outputTokens,
            totalTokens: prev.totalTokens + event.usage!.totalTokens,
            turns: prev.turns + 1,
          }));
        } else {
          state.usage.update((prev) => ({ ...prev, turns: prev.turns + 1 }));
        }
      } else if (event.kind === "error") {
        state.error.value = event.message;
        state.pending.update((prev) => ({
          content: prev?.content ?? "",
          activities: prev?.activities ?? [],
          error: event.message,
        }));
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
