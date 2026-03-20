/**
 * ZenMux provider — OpenAI-compatible AI gateway for utility/small model calls.
 *
 * Usage:
 *   import { zenmux } from "@agent-worker/loop/providers/zenmux";
 *   const model = zenmux("deepseek/deepseek-chat");
 *   const result = await generateText({ model, prompt: "..." });
 *
 * Env vars:
 *   ZENMUX_API_KEY    — API key (sk-ss-v1-... or sk-ai-v1-...)
 *   ZENMUX_BASE_URL   — Override base URL (default: https://zenmux.ai/api/v1)
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Create a LanguageModel backed by ZenMux gateway.
 * Model IDs use `provider/model` format, e.g. "deepseek/deepseek-chat".
 */
export function zenmux(modelId: string, env?: Record<string, string>): LanguageModel {
  const instance = createOpenAI({
    apiKey: env?.ZENMUX_API_KEY ?? process.env.ZENMUX_API_KEY,
    baseURL: env?.ZENMUX_BASE_URL ?? process.env.ZENMUX_BASE_URL ?? "https://zenmux.ai/api/v1",
  });
  return instance(modelId);
}

/** Adapter for the provider registry (async signature). */
export async function zenmuxAdapter(
  modelId: string,
  env?: Record<string, string>,
): Promise<LanguageModel> {
  return zenmux(modelId, env);
}
