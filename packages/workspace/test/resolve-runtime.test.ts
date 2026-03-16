import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { resolveRuntime, detectAiSdkModel } from "../src/config/resolve-runtime.ts";

// ── detectAiSdkModel ─────────────────────────────────────────────────────

describe("detectAiSdkModel", () => {
  const savedEnv: Record<string, string | undefined> = {};
  const envKeys = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GOOGLE_API_KEY",
    "DEEPSEEK_API_KEY",
    "KIMI_CODE_API_KEY",
    "MINIMAX_API_KEY",
    "AI_GATEWAY_API_KEY",
  ];

  beforeEach(() => {
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test("returns undefined when no API keys set", () => {
    expect(detectAiSdkModel()).toBeUndefined();
  });

  test("returns anthropic model when ANTHROPIC_API_KEY is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    expect(detectAiSdkModel()).toBe("anthropic:claude-sonnet-4-6");
  });

  test("returns openai model when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(detectAiSdkModel()).toBe("openai:gpt-4.1");
  });

  test("returns google model when GOOGLE_API_KEY is set", () => {
    process.env.GOOGLE_API_KEY = "test-key";
    expect(detectAiSdkModel()).toBe("google:gemini-2.5-flash");
  });

  test("returns deepseek model when DEEPSEEK_API_KEY is set", () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    expect(detectAiSdkModel()).toBe("deepseek:deepseek-chat");
  });

  test("prefers anthropic over openai when both are set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant";
    process.env.OPENAI_API_KEY = "sk-oai";
    expect(detectAiSdkModel()).toBe("anthropic:claude-sonnet-4-6");
  });
});

// ── resolveRuntime ────────────────────────────────────────────────────────

describe("resolveRuntime", () => {
  test("model specified without runtime → ai-sdk", async () => {
    const r = await resolveRuntime(undefined, "anthropic:claude-sonnet-4-5");
    expect(r.runtime).toBe("ai-sdk");
    expect(r.model).toBe("anthropic:claude-sonnet-4-5");
  });

  test("runtime 'auto' with model → ai-sdk (treated as unspecified)", async () => {
    const r = await resolveRuntime("auto", "anthropic:claude-sonnet-4-5");
    expect(r.runtime).toBe("ai-sdk");
    expect(r.model).toBe("anthropic:claude-sonnet-4-5");
  });

  test("both specified → pass through", async () => {
    const r = await resolveRuntime("claude-code", "sonnet");
    expect(r.runtime).toBe("claude-code");
    expect(r.model).toBe("sonnet");
  });

  test("CLI runtime without model → no model", async () => {
    const r = await resolveRuntime("claude-code", undefined);
    expect(r.runtime).toBe("claude-code");
    expect(r.model).toBeUndefined();
  });

  test("cursor runtime without model → no model", async () => {
    const r = await resolveRuntime("cursor", undefined);
    expect(r.runtime).toBe("cursor");
    expect(r.model).toBeUndefined();
  });

  test("codex runtime without model → no model", async () => {
    const r = await resolveRuntime("codex", undefined);
    expect(r.runtime).toBe("codex");
    expect(r.model).toBeUndefined();
  });

  describe("ai-sdk without model", () => {
    const savedEnv: Record<string, string | undefined> = {};
    const envKeys = [
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "GOOGLE_API_KEY",
      "DEEPSEEK_API_KEY",
      "KIMI_CODE_API_KEY",
      "MINIMAX_API_KEY",
      "AI_GATEWAY_API_KEY",
    ];

    beforeEach(() => {
      for (const key of envKeys) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    });

    afterEach(() => {
      for (const key of envKeys) {
        if (savedEnv[key] !== undefined) {
          process.env[key] = savedEnv[key];
        } else {
          delete process.env[key];
        }
      }
    });

    test("auto-detects model from ANTHROPIC_API_KEY", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-test";
      const r = await resolveRuntime("ai-sdk", undefined);
      expect(r.runtime).toBe("ai-sdk");
      expect(r.model).toBe("anthropic:claude-sonnet-4-6");
    });

    test("auto-detects model from OPENAI_API_KEY", async () => {
      process.env.OPENAI_API_KEY = "sk-test";
      const r = await resolveRuntime("ai-sdk", undefined);
      expect(r.runtime).toBe("ai-sdk");
      expect(r.model).toBe("openai:gpt-4.1");
    });

    test("throws when no API key available", async () => {
      await expect(resolveRuntime("ai-sdk", undefined)).rejects.toThrow(
        "requires a model or API key",
      );
    });
  });
});
