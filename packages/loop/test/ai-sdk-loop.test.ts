import { test, expect, describe } from "bun:test";
import { AiSdkLoop } from "../src/loops/ai-sdk.ts";

describe("AiSdkLoop", () => {
  test("starts with idle status", () => {
    const loop = new AiSdkLoop({
      model: "anthropic:claude-sonnet-4-20250514" as any,
    });
    expect(loop.status).toBe("idle");
  });

  test("cancel before run is a no-op", () => {
    const loop = new AiSdkLoop({
      model: "anthropic:claude-sonnet-4-20250514" as any,
    });
    loop.cancel();
    expect(loop.status).toBe("idle");
  });

  test("run transitions to running status", () => {
    const loop = new AiSdkLoop({
      model: "anthropic:claude-sonnet-4-20250514" as any,
      includeBashTools: false,
    });

    const run = loop.run("test prompt");
    expect(loop.status).toBe("running");

    // Cancel immediately so it doesn't actually call the API
    loop.cancel();
  });

  test("cleanup is safe to call multiple times", async () => {
    const loop = new AiSdkLoop({
      model: "anthropic:claude-sonnet-4-20250514" as any,
    });

    // Should not throw
    await loop.cleanup();
    await loop.cleanup();
  });
});
