/**
 * Provider-level model listing — queries real API endpoints.
 */
import {
  extractProvider as extractProviderFromRegistry,
  getFallbackModels,
  getProviderMeta,
  hasProviderKey as hasProviderKeyFromRegistry,
  type ModelInfo,
} from "../providers/registry.ts";

// ── Anthropic ───────────────────────────────────────────────────────────────

export async function listAnthropicModels(apiKey?: string): Promise<ModelInfo[]> {
  if (!apiKey) return [];

  try {
    const resp = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return [];

    const data = (await resp.json()) as { data?: Array<{ id: string; display_name?: string }> };
    if (!Array.isArray(data.data)) return [];

    return data.data.map((m) => ({ id: m.id, name: m.display_name }));
  } catch {
    return [];
  }
}

// ── OpenAI ──────────────────────────────────────────────────────────────────

export async function listOpenAiModels(apiKey?: string): Promise<ModelInfo[]> {
  if (!apiKey) return [];

  try {
    const resp = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });

    if (!resp.ok) return [];

    const data = (await resp.json()) as { data?: Array<{ id: string }> };
    if (!Array.isArray(data.data)) return [];

    return data.data.map((m) => ({ id: m.id }));
  } catch {
    return [];
  }
}

// ── Google ───────────────────────────────────────────────────────────────────

export async function listGoogleModels(apiKey?: string): Promise<ModelInfo[]> {
  if (!apiKey) return [];

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!resp.ok) return [];

    const data = (await resp.json()) as { models?: Array<{ name: string; displayName?: string }> };
    if (!Array.isArray(data.models)) return [];

    return data.models.map((m) => ({
      id: m.name.replace("models/", ""),
      name: m.displayName,
    }));
  } catch {
    return [];
  }
}

// ── Provider dispatch ───────────────────────────────────────────────────────

const LIST_FNS: Record<string, (key?: string) => Promise<ModelInfo[]>> = {
  anthropic: listAnthropicModels,
  openai: listOpenAiModels,
  google: listGoogleModels,
};

/**
 * List models for a given provider. Tries the real API, falls back to known
 * models if the key is present but the API call fails.
 */
export async function listModelsForProvider(provider: string): Promise<ModelInfo[]> {
  const envVars = getProviderMeta(provider)?.envKeys;
  if (!envVars?.length) return [];

  const key = envVars.map((v) => process.env[v]).find(Boolean);
  if (!key) return [];

  const listFn = LIST_FNS[provider];
  if (listFn) {
    const models = await listFn(key);
    if (models.length > 0) return models;
  }

  return [...getFallbackModels(provider)];
}

/**
 * Extract provider name from AI SDK model strings.
 */
export function extractProvider(model: string): string | null {
  return extractProviderFromRegistry(model);
}

/**
 * Check if the environment has an API key for a given provider.
 */
export function hasProviderKey(provider: string): boolean {
  return hasProviderKeyFromRegistry(provider);
}
