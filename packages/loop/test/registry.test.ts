import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  extractProvider,
  hasProviderKey,
  getDefaultModel,
  getProviderMeta,
  getProviderPriority,
  resolveProvider,
  registerProvider,
  type ProviderMeta,
} from "../src/providers/registry.ts";

// ── extractProvider ───────────────────────────────────────────────────────

describe("registry: extractProvider", () => {
  test("extracts provider from model string", () => {
    expect(extractProvider("anthropic:claude-sonnet-4-6")).toBe("anthropic");
    expect(extractProvider("openai:gpt-4.1")).toBe("openai");
    expect(extractProvider("google:gemini-2.5-pro")).toBe("google");
    expect(extractProvider("deepseek:deepseek-chat")).toBe("deepseek");
    expect(extractProvider("kimi-code:kimi-for-coding")).toBe("kimi-code");
    expect(extractProvider("minimax:MiniMax-M2.5")).toBe("minimax");
    expect(extractProvider("ai-gateway:anthropic/claude-sonnet-4-6")).toBe("ai-gateway");
  });

  test("returns null when no colon present", () => {
    expect(extractProvider("claude-sonnet-4-6")).toBeNull();
    expect(extractProvider("gpt-4")).toBeNull();
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

  test("returns false for zenmux (reserved, no key set)", () => {
    expect(hasProviderKey("zenmux")).toBe(false);
  });
});

// ── getDefaultModel ───────────────────────────────────────────────────────

describe("registry: getDefaultModel", () => {
  test("returns default model for known providers", () => {
    expect(getDefaultModel("anthropic")).toBe("anthropic:claude-sonnet-4-6");
    expect(getDefaultModel("openai")).toBe("openai:gpt-4.1");
    expect(getDefaultModel("google")).toBe("google:gemini-2.5-flash");
    expect(getDefaultModel("deepseek")).toBe("deepseek:deepseek-chat");
    expect(getDefaultModel("kimi-code")).toBe("kimi-code:kimi-for-coding");
    expect(getDefaultModel("minimax")).toBe("minimax:MiniMax-M2.7");
    expect(getDefaultModel("ai-gateway")).toBe("ai-gateway:anthropic/claude-sonnet-4-6");
  });

  test("returns undefined for unknown provider", () => {
    expect(getDefaultModel("nonexistent")).toBeUndefined();
  });

  test("returns default model for reserved zenmux", () => {
    expect(getDefaultModel("zenmux")).toBe("zenmux:default");
  });
});

// ── getProviderPriority ───────────────────────────────────────────────────

describe("registry: getProviderPriority", () => {
  test("returns providers sorted by priority (highest first)", () => {
    const priority = getProviderPriority();
    expect(priority[0]).toBe("anthropic");
    expect(priority[priority.length - 1]).toBe("ai-gateway");
  });

  test("excludes zenmux (priority 0)", () => {
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

  test("throws for zenmux (no adapter)", async () => {
    expect(resolveProvider("zenmux", "some-model")).rejects.toThrow(
      'Provider "zenmux" is registered but has no adapter implementation.',
    );
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

  test("zenmux has no adapter", () => {
    const meta = getProviderMeta("zenmux");
    expect(meta).toBeDefined();
    expect(meta!.adapter).toBeUndefined();
    expect(meta!.priority).toBe(0);
  });
});

// ── registerProvider (runtime extension) ──────────────────────────────────

describe("registry: registerProvider", () => {
  test("can register a custom provider", () => {
    const customAdapter = async () => ({} as any);
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
