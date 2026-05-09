/**
 * Provider Registry — single source of truth for provider metadata and model resolution.
 *
 * Consolidates:
 * - Provider adapter logic (from agent-worker/loop-factory.ts L43-108)
 * - PROVIDER_KEYS (from loop/utils/models.ts L108-116)
 * - PROVIDER_DEFAULT_MODELS + PROVIDER_PRIORITY (from agent-worker/resolve-runtime.ts L35-54)
 *
 * Design constraints:
 * - Only handles provider metadata + adapter resolution (no use-case presets)
 * - zenmux is an OpenAI-compatible AI gateway (lower priority than direct providers)
 * - Provider defaults and fallback model lists are declared alongside provider metadata
 */

import type { LanguageModel } from "ai";

// ── Types ─────────────────────────────────────────────────────────────────

/** Function that creates a LanguageModel instance for a given model ID. */
export type ProviderAdapter = (
  modelId: string,
  env?: Record<string, string>,
) => Promise<LanguageModel>;

export interface ModelInfo {
  id: string;
  name?: string;
}

export const PROVIDER_DEFAULT_MODELS = {
  anthropic: "anthropic:claude-sonnet-4-6",
  openai: "openai:gpt-5.5",
  google: "google:gemini-2.5-flash",
  deepseek: "deepseek:deepseek-chat",
  "kimi-code": "kimi-code:kimi-for-coding",
  minimax: "minimax:MiniMax-M2.7",
  "ai-gateway": "ai-gateway:anthropic/claude-sonnet-4-6",
  zenmux: "zenmux:openai/gpt-5.5",
} as const;

export const PROVIDER_FALLBACK_MODELS = {
  anthropic: [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5.5", name: "GPT-5.5" },
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
    { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
  ],
  google: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  ],
  "kimi-code": [{ id: "kimi-for-coding", name: "Kimi for Coding" }],
  minimax: [
    { id: "MiniMax-M2.7", name: "MiniMax M2.7" },
    { id: "MiniMax-M2.5", name: "MiniMax M2.5" },
    { id: "MiniMax-M2", name: "MiniMax M2" },
  ],
} as const satisfies Record<string, readonly ModelInfo[]>;

/** Static metadata for a registered provider. */
export interface ProviderMeta {
  /** Environment variable names that hold the API key for this provider. */
  envKeys: string[];
  /** Default model string (provider:modelId format). */
  defaultModel: string;
  /** Known model list used when provider model-list APIs are unavailable. */
  fallbackModels?: readonly ModelInfo[];
  /** Priority for auto-detection (higher = checked first). */
  priority: number;
  /** Factory that creates a LanguageModel. Undefined for reserved providers. */
  adapter?: ProviderAdapter;
}

// ── Env helper ────────────────────────────────────────────────────────────

/** Resolve an env var from agent env overrides, falling back to process.env. */
function resolveEnv(key: string, env?: Record<string, string>): string | undefined {
  return env?.[key] ?? process.env[key];
}

// ── Provider adapters ─────────────────────────────────────────────────────

const anthropicAdapter: ProviderAdapter = async (modelId, env) => {
  const { createAnthropic } = await import("@ai-sdk/anthropic");
  const anthropic = createAnthropic({
    apiKey: resolveEnv("ANTHROPIC_API_KEY", env),
    baseURL: resolveEnv("ANTHROPIC_BASE_URL", env),
  });
  return anthropic(modelId);
};

const openaiAdapter: ProviderAdapter = async (modelId, env) => {
  const { createOpenAI } = await import("@ai-sdk/openai");
  const openai = createOpenAI({
    apiKey: resolveEnv("OPENAI_API_KEY", env),
    baseURL: resolveEnv("OPENAI_BASE_URL", env),
  });
  return openai(modelId);
};

const googleAdapter: ProviderAdapter = async (modelId, env) => {
  const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
  const google = createGoogleGenerativeAI({
    // Back-compat: allow older `GOOGLE_API_KEY` to satisfy google provider detection.
    apiKey: resolveEnv("GOOGLE_GENERATIVE_AI_API_KEY", env) ?? resolveEnv("GOOGLE_API_KEY", env),
    baseURL: resolveEnv("GOOGLE_GENERATIVE_AI_BASE_URL", env),
  });
  return google(modelId);
};

const deepseekAdapter: ProviderAdapter = async (modelId, env) => {
  const { createDeepSeek } = await import("@ai-sdk/deepseek");
  const deepseek = createDeepSeek({
    apiKey: resolveEnv("DEEPSEEK_API_KEY", env),
    baseURL: resolveEnv("DEEPSEEK_BASE_URL", env),
  });
  return deepseek(modelId);
};

const kimiCodeAdapter: ProviderAdapter = async (modelId, env) => {
  const { createAnthropic } = await import("@ai-sdk/anthropic");
  const kimi = createAnthropic({
    baseURL: resolveEnv("KIMI_CODE_BASE_URL", env) ?? "https://api.kimi.com/coding/v1",
    apiKey: resolveEnv("KIMI_CODE_API_KEY", env),
  });
  return kimi(modelId);
};

const minimaxAdapter: ProviderAdapter = async (modelId, env) => {
  const { createAnthropic } = await import("@ai-sdk/anthropic");
  const minimaxBase = resolveEnv("MINIMAX_BASE_URL", env);
  const baseURL = minimaxBase
    ? `${minimaxBase}/anthropic/v1`
    : "https://api.minimax.io/anthropic/v1";
  const minimax = createAnthropic({
    baseURL,
    apiKey: resolveEnv("MINIMAX_API_KEY", env),
  });
  return minimax(modelId);
};

const aiGatewayAdapter: ProviderAdapter = async (modelId) => {
  const { gateway } = await import("ai");
  return gateway(modelId);
};

const zenmuxProviderAdapter: ProviderAdapter = async (modelId, env) => {
  const { zenmuxAdapter } = await import("./zenmux.ts");
  return zenmuxAdapter(modelId, env);
};

// ── Registry ──────────────────────────────────────────────────────────────

const registry = new Map<string, ProviderMeta>();

function register(name: string, meta: ProviderMeta): void {
  registry.set(name, meta);
}

// Register built-in providers (priority: higher = checked first in auto-detect)
register("anthropic", {
  envKeys: ["ANTHROPIC_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS.anthropic,
  fallbackModels: PROVIDER_FALLBACK_MODELS.anthropic,
  priority: 70,
  adapter: anthropicAdapter,
});

register("openai", {
  envKeys: ["OPENAI_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS.openai,
  fallbackModels: PROVIDER_FALLBACK_MODELS.openai,
  priority: 60,
  adapter: openaiAdapter,
});

register("google", {
  envKeys: ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS.google,
  fallbackModels: PROVIDER_FALLBACK_MODELS.google,
  priority: 50,
  adapter: googleAdapter,
});

register("deepseek", {
  envKeys: ["DEEPSEEK_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS.deepseek,
  priority: 40,
  adapter: deepseekAdapter,
});

register("kimi-code", {
  envKeys: ["KIMI_CODE_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS["kimi-code"],
  fallbackModels: PROVIDER_FALLBACK_MODELS["kimi-code"],
  priority: 30,
  adapter: kimiCodeAdapter,
});

register("minimax", {
  envKeys: ["MINIMAX_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS.minimax,
  fallbackModels: PROVIDER_FALLBACK_MODELS.minimax,
  priority: 20,
  adapter: minimaxAdapter,
});

register("ai-gateway", {
  envKeys: ["AI_GATEWAY_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS["ai-gateway"],
  priority: 10,
  adapter: aiGatewayAdapter,
});

register("zenmux", {
  envKeys: ["ZENMUX_API_KEY"],
  defaultModel: PROVIDER_DEFAULT_MODELS.zenmux,
  priority: 0, // utility gateway — not auto-selected for agent runtimes
  adapter: zenmuxProviderAdapter,
});

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Resolve a provider adapter and create a LanguageModel instance.
 * Throws if provider is unknown or has no adapter.
 */
export async function resolveProvider(
  provider: string,
  modelId: string,
  env?: Record<string, string>,
): Promise<LanguageModel> {
  const meta = registry.get(provider);
  if (!meta) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  if (!meta.adapter) {
    throw new Error(`Provider "${provider}" is registered but has no adapter implementation.`);
  }
  return meta.adapter(modelId, env);
}

/**
 * Get the default model string for a provider.
 * Returns undefined for unknown providers.
 */
export function getDefaultModel(provider: string): string | undefined {
  return registry.get(provider)?.defaultModel;
}

/**
 * Get known fallback models for a provider.
 * Returns an empty array for unknown providers or providers without fallback models.
 */
export function getFallbackModels(provider: string): readonly ModelInfo[] {
  return registry.get(provider)?.fallbackModels ?? [];
}

/**
 * Check if the environment has an API key for a given provider.
 * Checks `process.env` only.
 */
export function hasProviderKey(provider: string): boolean {
  const meta = registry.get(provider);
  if (!meta) return false;
  return meta.envKeys.some((v) => !!process.env[v]);
}

/**
 * Extract provider name from a "provider:model" string.
 * Returns null if no colon separator found.
 */
export function extractProvider(model: string): string | null {
  const idx = model.indexOf(":");
  return idx !== -1 ? model.slice(0, idx) : null;
}

/**
 * Get provider metadata. Returns undefined for unknown providers.
 */
export function getProviderMeta(provider: string): ProviderMeta | undefined {
  return registry.get(provider);
}

/**
 * Get all registered provider names, ordered by priority (highest first).
 * Excludes providers with priority 0 (utility gateways like zenmux).
 */
export function getProviderPriority(): string[] {
  return Array.from(registry.entries())
    .filter(([, meta]) => meta.priority > 0)
    .sort((a, b) => b[1].priority - a[1].priority)
    .map(([name]) => name);
}

/**
 * Register a custom provider at runtime.
 * Use this to add new providers without modifying this module.
 */
export function registerProvider(name: string, meta: ProviderMeta): void {
  register(name, meta);
}
