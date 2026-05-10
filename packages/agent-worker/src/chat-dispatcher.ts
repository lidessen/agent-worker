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
 * Run one chat turn against a chat-typed Harness. Throws if the
 * harness isn't chat-typed (caller must have validated) or if a turn
 * is already in flight on the same harness.
 */
export async function runChatTurn(
  harness: Harness,
  input: ChatTurnInput,
): Promise<ChatTurnResult> {
  const runtime = chatRuntime(harness);

  if (runtime.state !== "idle") {
    throw new Error(
      `chat busy: ${harness.name} already has a turn in flight (state=${runtime.state})`,
    );
  }

  const runId = input.runId ?? `chat-${Date.now()}-${nanoid()}`;
  runtime.beginThinking();
  let userTurn: ChatTurn | undefined;
  try {
    userTurn = await runtime.appendTurn({ role: "user", content: input.content, runId });
    const prompt = buildChatPrompt(runtime, input.content);
    const loopConfig = buildRuntimeConfig(runtime);
    const loop = await createLoopFromConfig(loopConfig);

    let collected = "";
    const startedAt = Date.now();
    const run = loop.run({
      system: runtime.instructions ?? "",
      prompt,
    });
    for await (const event of run) {
      if (event.type === "text") collected += event.text;
    }
    const result = await run.result;

    const assistantTurn = await runtime.appendTurn({
      role: "assistant",
      content: collected,
      runId,
    });
    return {
      userTurn,
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
    // Persist the failure so the conversation transcript reflects
    // what actually happened — silent dropping leaves the user
    // wondering why nothing came back.
    const message = err instanceof Error ? err.message : String(err);
    if (userTurn) {
      await runtime.appendTurn({
        role: "assistant",
        content: "",
        runId,
        error: message,
      });
    }
    throw err;
  } finally {
    runtime.endThinking();
  }
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

function buildRuntimeConfig(runtime: ChatRuntime): RuntimeConfig {
  return {
    type: runtime.runtimeId as RuntimeConfig["type"],
    model: runtime.model?.full,
    instructions: runtime.instructions,
  };
}
