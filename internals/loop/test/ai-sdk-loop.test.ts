import { test, expect, describe } from "bun:test";
import { AiSdkLoop } from "../src/loops/ai-sdk.ts";
import { getDefaultModel } from "../src/providers/registry.ts";

const model = getDefaultModel("anthropic") as any;

describe("AiSdkLoop", () => {
  test("starts with idle status", () => {
    const loop = new AiSdkLoop({
      model,
    });
    expect(loop.status).toBe("idle");
  });

  test("cancel before run is a no-op", () => {
    const loop = new AiSdkLoop({
      model,
    });
    loop.cancel();
    expect(loop.status).toBe("idle");
  });

  test("run transitions to running status", async () => {
    const loop = new AiSdkLoop({
      model,
    });

    const run = loop.run("test prompt");
    expect(loop.status).toBe("running");

    // Cancel immediately so it doesn't actually call the API
    loop.cancel();

    // Await the result to handle the cancellation error
    try {
      await run.result;
    } catch {
      // Expected: cancellation causes AbortError
    }
  });

  test("cleanup is safe to call multiple times", async () => {
    const loop = new AiSdkLoop({
      model,
    });

    // Should not throw
    await loop.cleanup();
    await loop.cleanup();
  });
});
