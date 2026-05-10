// Single-flight dispatcher for chat-typed harnesses (decision 008).
//
// One user message in, one assistant reply out. No polling, no
// queue, no orchestrator — just the agent loop run once with the
// conversation history as context. Acquires the chat runtime's
// `thinking` slot for the duration; concurrent turns on the same
// chat are rejected (per-chat singleflight is intentional).

import type { Harness } from "@agent-worker/harness";
import { chatRuntime } from "@agent-worker/harness-chat";
import type { ChatRuntime, ChatTurn } from "@agent-worker/harness-chat";
import { nanoid } from "@agent-worker/harness";
import { createLoopFromConfig } from "./loop-factory.ts";
import type { RuntimeConfig } from "./types.ts";

export interface ChatTurnInput {
  /** User-authored message content. */
  content: string;
  /** Optional override for the dispatch run id (for correlation in events). */
  runId?: string;
}

export interface ChatTurnResult {
  userTurn: ChatTurn;
  assistantTurn: ChatTurn;
  /** Total assistant durationMs returned by the loop. */
  durationMs: number;
  /** Token usage if the runtime reports it. */
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

/**
 * Stream events emitted by the streaming chat dispatcher. The
 * lifecycle is: one `user_turn` (immediately after persisting the
 * user message), zero-or-more `chunk` events (each carrying the
 * incremental text the loop produced), then exactly one `done` (or
 * `error`). After `done`/`error` the iterator completes; consumers
 * should treat anything after as a protocol violation.
 */
export type ChatStreamEvent =
  | { kind: "user_turn"; userTurn: ChatTurn }
  | { kind: "chunk"; text: string; accumulated: string }
  | {
      kind: "done";
      assistantTurn: ChatTurn;
      durationMs: number;
      usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
    }
  | { kind: "error"; message: string };

/**
 * Run one chat turn against a chat-typed Harness. Throws if the
 * harness isn't chat-typed (caller must have validated) or if a turn
 * is already in flight on the same harness. Internally drives the
 * streaming generator to completion so persistence + state-machine
 * handling lives in exactly one place.
 */
export async function runChatTurn(
  harness: Harness,
  input: ChatTurnInput,
): Promise<ChatTurnResult> {
  let userTurn: ChatTurn | undefined;
  let assistantTurn: ChatTurn | undefined;
  let durationMs = 0;
  let usage: ChatTurnResult["usage"] | undefined;
  for await (const event of streamChatTurn(harness, input)) {
    if (event.kind === "user_turn") {
      userTurn = event.userTurn;
    } else if (event.kind === "done") {
      assistantTurn = event.assistantTurn;
      durationMs = event.durationMs;
      usage = event.usage;
    } else if (event.kind === "error") {
      throw new Error(event.message);
    }
  }
  if (!userTurn || !assistantTurn) {
    throw new Error("chat dispatch ended without producing user + assistant turns");
  }
  return { userTurn, assistantTurn, durationMs, usage };
}

/**
 * Project the conversation history into a flat prompt the loop
 * understands. Slice 1 keeps the projection minimal — `User:` /
 * `Assistant:` prefixes followed by the latest user turn. AI-SDK and
 * the CLI runtimes both accept this format; richer
 * provider-native multi-turn formats can land later.
 */
function buildChatPrompt(runtime: ChatRuntime, latestUserText: string): string {
  const history = runtime.conversation.slice(0, -1); // exclude the just-appended user turn
  const lines: string[] = [];
  for (const turn of history) {
    const prefix = turn.role === "user" ? "User" : turn.role === "assistant" ? "Assistant" : "System";
    lines.push(`${prefix}: ${turn.content}`);
  }
  lines.push(`User: ${latestUserText}`);
  lines.push("Assistant:");
  return lines.join("\n\n");
}

/**
 * Streaming variant of `runChatTurn`. Yields events as the loop
 * produces them — the consumer is responsible for either driving
 * the iterator to completion or aborting (via the abort signal on
 * the underlying request) and the dispatcher's `endThinking` /
 * persistence still runs in the `finally` even on abort. The
 * non-streaming path delegates to this same generator now to keep
 * the persistence + state-machine handling in one place.
 */
export async function* streamChatTurn(
  harness: Harness,
  input: ChatTurnInput,
): AsyncGenerator<ChatStreamEvent> {
  const runtime = chatRuntime(harness);
  if (runtime.state !== "idle") {
    yield {
      kind: "error",
      message: `chat busy: ${harness.name} already has a turn in flight (state=${runtime.state})`,
    };
    return;
  }

  const runId = input.runId ?? `chat-${Date.now()}-${nanoid()}`;
  runtime.beginThinking();
  let userTurn: ChatTurn | undefined;
  let collected = "";
  try {
    userTurn = await runtime.appendTurn({ role: "user", content: input.content, runId });
    yield { kind: "user_turn", userTurn };

    const prompt = buildChatPrompt(runtime, input.content);
    const loopConfig = buildRuntimeConfig(runtime);
    const loop = await createLoopFromConfig(loopConfig);

    const startedAt = Date.now();
    const run = loop.run({ system: runtime.instructions ?? "", prompt });
    for await (const event of run) {
      if (event.type === "text") {
        collected += event.text;
        yield { kind: "chunk", text: event.text, accumulated: collected };
      }
    }
    const result = await run.result;

    const assistantTurn = await runtime.appendTurn({
      role: "assistant",
      content: collected,
      runId,
    });
    yield {
      kind: "done",
      assistantTurn,
      durationMs: result.durationMs ?? Date.now() - startedAt,
      usage: result.usage
        ? {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
            totalTokens: result.usage.totalTokens ?? 0,
          }
        : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (userTurn) {
      // Persist failure as an assistant turn carrying the error so
      // the transcript reflects the attempt.
      try {
        await runtime.appendTurn({
          role: "assistant",
          content: collected,
          runId,
          error: message,
        });
      } catch {
        // Persisting the error turn shouldn't mask the original.
      }
    }
    yield { kind: "error", message };
  } finally {
    runtime.endThinking();
  }
}

function buildRuntimeConfig(runtime: ChatRuntime): RuntimeConfig {
  return {
    type: runtime.runtimeId as RuntimeConfig["type"],
    model: runtime.model?.full,
    instructions: runtime.instructions,
    cwd: runtime.cwd,
  };
}
