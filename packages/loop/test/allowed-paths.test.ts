import { test, expect, describe } from "bun:test";
import { AiSdkLoop } from "../src/loops/ai-sdk.ts";
import { createHostSandbox } from "../src/sandbox/host.ts";

// Minimal mock model to avoid real API calls
const mockModel = {
  modelId: "mock:test",
  provider: "mock",
  specificationVersion: "v1" as const,
  doGenerate: async () => ({ text: "ok" }),
  doStream: async () => ({ stream: new ReadableStream() }),
} as any;

describe("AiSdkLoop with HostSandbox", () => {
  test("init with HostSandbox uses real filesystem", async () => {
    const loop = new AiSdkLoop({
      model: mockModel,
      bashToolOptions: {
        sandbox: createHostSandbox({ cwd: import.meta.dir }),
        destination: import.meta.dir,
      },
    });

    await loop.init();
    expect(loop.bashToolkit).not.toBeNull();
    expect(Object.keys(loop.tools).length).toBeGreaterThan(0);
  });

  test("init without bashToolOptions uses default just-bash", async () => {
    const loop = new AiSdkLoop({
      model: mockModel,
    });

    await loop.init();
    expect(loop.bashToolkit).not.toBeNull();
  });
});
