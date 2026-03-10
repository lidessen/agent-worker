import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { extractProvider, hasProviderKey, listModelsForProvider } from "../src/utils/models.ts";

describe("extractProvider", () => {
  test("extracts provider from model string", () => {
    expect(extractProvider("anthropic:claude-sonnet-4-6")).toBe("anthropic");
    expect(extractProvider("openai:gpt-4")).toBe("openai");
    expect(extractProvider("google:gemini-2.5-pro")).toBe("google");
  });

  test("returns null when no colon present", () => {
    expect(extractProvider("claude-sonnet-4-6")).toBeNull();
    expect(extractProvider("gpt-4")).toBeNull();
  });

  test("handles empty string", () => {
    expect(extractProvider("")).toBeNull();
  });

  test("handles only provider name", () => {
    expect(extractProvider("anthropic:")).toBe("anthropic");
  });
});

describe("hasProviderKey", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save original env vars
    originalEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    originalEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    originalEnv.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    originalEnv.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalEnv.ANTHROPIC_API_KEY !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (originalEnv.OPENAI_API_KEY !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    if (originalEnv.GOOGLE_GENERATIVE_AI_API_KEY !== undefined) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnv.GOOGLE_GENERATIVE_AI_API_KEY;
    } else {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
    if (originalEnv.GOOGLE_API_KEY !== undefined) {
      process.env.GOOGLE_API_KEY = originalEnv.GOOGLE_API_KEY;
    } else {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  test("returns true when ANTHROPIC_API_KEY is set", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(hasProviderKey("anthropic")).toBe(true);
  });

  test("returns true when OPENAI_API_KEY is set", () => {
    process.env.OPENAI_API_KEY = "test-key";
    expect(hasProviderKey("openai")).toBe(true);
  });

  test("returns true when GOOGLE_GENERATIVE_AI_API_KEY is set", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
    expect(hasProviderKey("google")).toBe(true);
  });

  test("returns true when GOOGLE_API_KEY is set", () => {
    process.env.GOOGLE_API_KEY = "test-key";
    expect(hasProviderKey("google")).toBe(true);
  });

  test("returns false when no key is set", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    expect(hasProviderKey("anthropic")).toBe(false);
    expect(hasProviderKey("openai")).toBe(false);
    expect(hasProviderKey("google")).toBe(false);
  });

  test("returns false for unknown provider", () => {
    expect(hasProviderKey("unknown-provider")).toBe(false);
  });
});

describe("listModelsForProvider", () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    originalEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    originalEnv.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    originalEnv.GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    originalEnv.GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  });

  afterEach(() => {
    if (originalEnv.ANTHROPIC_API_KEY !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
    if (originalEnv.OPENAI_API_KEY !== undefined) {
      process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
    if (originalEnv.GOOGLE_GENERATIVE_AI_API_KEY !== undefined) {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalEnv.GOOGLE_GENERATIVE_AI_API_KEY;
    } else {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    }
    if (originalEnv.GOOGLE_API_KEY !== undefined) {
      process.env.GOOGLE_API_KEY = originalEnv.GOOGLE_API_KEY;
    } else {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  test("returns empty array when no key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const models = await listModelsForProvider("anthropic");
    expect(models).toEqual([]);
  });

  test("returns empty array for unknown provider", async () => {
    const models = await listModelsForProvider("unknown-provider");
    expect(models).toEqual([]);
  });

  test("returns fallback models when key is set but API fails", async () => {
    process.env.ANTHROPIC_API_KEY = "invalid-key";
    const models = await listModelsForProvider("anthropic");
    // Should return fallback models after API call fails
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toHaveProperty("id");
  });
});
