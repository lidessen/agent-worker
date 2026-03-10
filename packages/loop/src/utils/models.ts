/**
 * Provider-level model listing — queries real API endpoints.
 */

interface ModelInfo {
  id: string;
  name?: string;
}

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

const FALLBACK_MODELS: Record<string, ModelInfo[]> = {
  anthropic: [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "o3", name: "o3" },
    { id: "o4-mini", name: "o4-mini" },
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
    { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
  ],
  google: [
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  ],
};

const PROVIDER_KEYS: Record<string, string[]> = {
  anthropic: ["ANTHROPIC_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GOOGLE_API_KEY"],
  deepseek: ["DEEPSEEK_API_KEY"],
};

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
  const envVars = PROVIDER_KEYS[provider];
  if (!envVars) return [];

  const key = envVars.map((v) => process.env[v]).find(Boolean);
  if (!key) return [];

  const listFn = LIST_FNS[provider];
  if (listFn) {
    const models = await listFn(key);
    if (models.length > 0) return models;
  }

  return FALLBACK_MODELS[provider] ?? [];
}

/**
 * Extract provider name from AI SDK model string like "anthropic:claude-sonnet-4-6".
 */
export function extractProvider(model: string): string | null {
  const idx = model.indexOf(":");
  return idx !== -1 ? model.slice(0, idx) : null;
}

/**
 * Check if the environment has an API key for a given provider.
 */
export function hasProviderKey(provider: string): boolean {
  const envVars = PROVIDER_KEYS[provider];
  if (!envVars) return false;
  return envVars.some((v) => !!process.env[v]);
}
