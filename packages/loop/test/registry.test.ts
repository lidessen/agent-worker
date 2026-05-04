import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  extractProvider,
  hasProviderKey,
  getDefaultModel,
  getFallbackModels,
  getProviderMeta,
  getProviderPriority,
  PROVIDER_DEFAULT_MODELS,
  PROVIDER_FALLBACK_MODELS,
  resolveProvider,
  registerProvider,
} from "../src/providers/registry.ts";

// ── extractProvider ───────────────────────────────────────────────────────

describe("registry: extractProvider", () => {
  test("extracts provider from model string", () => {
    expect(extractProvider(PROVIDER_DEFAULT_MODELS.anthropic)).toBe("anthropic");
    expect(extractProvider(PROVIDER_DEFAULT_MODELS.openai)).toBe("openai");
    expect(extractProvider("google:gemini-2.5-pro")).toBe("google");
    expect(extractProvider("deepseek:deepseek-chat")).toBe("deepseek");
    expect(extractProvider("kimi-code:kimi-for-coding")).toBe("kimi-code");
    expect(extractProvider("minimax:MiniMax-M2.5")).toBe("minimax");
    expect(extractProvider(PROVIDER_DEFAULT_MODELS["ai-gateway"])).toBe("ai-gateway");
  });

  test("returns null when no colon present", () => {
    expect(extractProvider("model-without-provider")).toBeNull();
  });

  test("handles empty string", () => {
    expect(extractProvider("")).toBeNull();
  });

  test("handles only provider name with colon", () => {
    expect(extractProvider("anthropic:")).toBe("anthropic");
  });
});

// ── hasProviderKey ────────────────────────────────────────────────────────

describe("registry: hasProviderKey", () => {
  const savedKeys: Record<string, string | undefined> = {};
  const keysToSave = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_API_KEY",
    "DEEPSEEK_API_KEY",
    "KIMI_CODE_API_KEY",
    "MINIMAX_API_KEY",
    "AI_GATEWAY_API_KEY",
    "ZENMUX_API_KEY",
  ];

  beforeEach(() => {
    for (const k of keysToSave) savedKeys[k] = process.env[k];
    for (const k of keysToSave) delete process.env[k];
  });

  afterEach(() => {
    for (const k of keysToSave) {
      if (savedKeys[k] !== undefined) process.env[k] = savedKeys[k];
      else delete process.env[k];
    }
  });

  test("returns true when provider key is set", () => {
    process.env.ANTHROPIC_API_KEY = "test";
    expect(hasProviderKey("anthropic")).toBe(true);
  });

  test("returns true for google with GOOGLE_GENERATIVE_AI_API_KEY", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test";
    expect(hasProviderKey("google")).toBe(true);
  });

  test("ignores env override parameter", () => {
    expect(hasProviderKey("anthropic")).toBe(false);
  });

  test("returns false when no key is set", () => {
    expect(hasProviderKey("anthropic")).toBe(false);
    expect(hasProviderKey("openai")).toBe(false);
  });

  test("returns false for unknown provider", () => {
    expect(hasProviderKey("nonexistent")).toBe(false);
  });

  test("returns false for zenmux when no key set", () => {
    expect(hasProviderKey("zenmux")).toBe(false);
  });
});

// ── getDefaultModel ───────────────────────────────────────────────────────

describe("registry: getDefaultModel", () => {
  test("returns default model for known providers", () => {
    expect(getDefaultModel("anthropic")).toBe(PROVIDER_DEFAULT_MODELS.anthropic);
    expect(getDefaultModel("openai")).toBe(PROVIDER_DEFAULT_MODELS.openai);
    expect(getDefaultModel("google")).toBe(PROVIDER_DEFAULT_MODELS.google);
    expect(getDefaultModel("deepseek")).toBe(PROVIDER_DEFAULT_MODELS.deepseek);
    expect(getDefaultModel("kimi-code")).toBe(PROVIDER_DEFAULT_MODELS["kimi-code"]);
    expect(getDefaultModel("minimax")).toBe(PROVIDER_DEFAULT_MODELS.minimax);
    expect(getDefaultModel("ai-gateway")).toBe(PROVIDER_DEFAULT_MODELS["ai-gateway"]);
  });

  test("returns undefined for unknown provider", () => {
    expect(getDefaultModel("nonexistent")).toBeUndefined();
  });

  test("returns default model for zenmux", () => {
    expect(getDefaultModel("zenmux")).toBe(PROVIDER_DEFAULT_MODELS.zenmux);
  });
});

// ── getFallbackModels ─────────────────────────────────────────────────────

describe("registry: getFallbackModels", () => {
  test("returns fallback models from provider metadata", () => {
    expect(getFallbackModels("openai").map((m) => m.id)).toEqual(
      PROVIDER_FALLBACK_MODELS.openai.map((m) => m.id),
    );
  });

  test("returns empty array for unknown provider", () => {
    expect(getFallbackModels("nonexistent")).toEqual([]);
  });
});

// ── getProviderPriority ───────────────────────────────────────────────────

describe("registry: getProviderPriority", () => {
  test("returns providers sorted by priority (highest first)", () => {
    const priority = getProviderPriority();
    expect(priority[0]).toBe("anthropic");
    expect(priority[priority.length - 1]).toBe("ai-gateway");
  });

  test("excludes zenmux (priority 0, utility gateway)", () => {
    const priority = getProviderPriority();
    expect(priority).not.toContain("zenmux");
  });

  test("contains all 7 active providers", () => {
    const priority = getProviderPriority();
    expect(priority).toHaveLength(7);
    expect(priority).toContain("anthropic");
    expect(priority).toContain("openai");
    expect(priority).toContain("google");
    expect(priority).toContain("deepseek");
    expect(priority).toContain("kimi-code");
    expect(priority).toContain("minimax");
    expect(priority).toContain("ai-gateway");
  });
});

// ── resolveProvider ───────────────────────────────────────────────────────

describe("registry: resolveProvider", () => {
  test("throws for unknown provider", async () => {
    expect(resolveProvider("nonexistent", "some-model")).rejects.toThrow(
      "Unknown provider: nonexistent",
    );
  });

  test("resolves zenmux provider", async () => {
    const model = PROVIDER_DEFAULT_MODELS.zenmux.slice("zenmux:".length);
    await expect(resolveProvider("zenmux", model)).resolves.toBeDefined();
  });

  test("google: uses GOOGLE_API_KEY fallback when GENERATIVE key missing", async () => {
    const originalGeneratedKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const originalApiKey = process.env.GOOGLE_API_KEY;

    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    process.env.GOOGLE_API_KEY = "test-key";

    try {
      await expect(resolveProvider("google", "gemini-2.5-flash")).resolves.toBeDefined();
    } finally {
      if (originalGeneratedKey !== undefined) {
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalGeneratedKey;
      } else {
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      }
      if (originalApiKey !== undefined) process.env.GOOGLE_API_KEY = originalApiKey;
      else delete process.env.GOOGLE_API_KEY;
    }
  });
});

// ── getProviderMeta ───────────────────────────────────────────────────────

describe("registry: getProviderMeta", () => {
  test("returns metadata for known provider", () => {
    const meta = getProviderMeta("anthropic");
    expect(meta).toBeDefined();
    expect(meta!.envKeys).toEqual(["ANTHROPIC_API_KEY"]);
    expect(meta!.priority).toBe(70);
    expect(meta!.adapter).toBeDefined();
  });

  test("returns undefined for unknown provider", () => {
    expect(getProviderMeta("nonexistent")).toBeUndefined();
  });

  test("zenmux has adapter but priority 0 (utility gateway)", () => {
    const meta = getProviderMeta("zenmux");
    expect(meta).toBeDefined();
    expect(meta!.adapter).toBeDefined();
    expect(meta!.priority).toBe(0);
  });
});

// ── registerProvider (runtime extension) ──────────────────────────────────

describe("registry: registerProvider", () => {
  test("can register a custom provider", () => {
    const customAdapter = async () => ({}) as any;
    registerProvider("custom-test", {
      envKeys: ["CUSTOM_TEST_KEY"],
      defaultModel: "custom-test:default",
      priority: 5,
      adapter: customAdapter,
    });
    const meta = getProviderMeta("custom-test");
    expect(meta).toBeDefined();
    expect(meta!.defaultModel).toBe("custom-test:default");
    expect(meta!.adapter).toBe(customAdapter);
  });
});
