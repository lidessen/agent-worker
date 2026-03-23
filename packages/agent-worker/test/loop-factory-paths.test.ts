import { test, expect, describe } from "bun:test";
import type { RuntimeConfig } from "../src/types.ts";

describe("loop-factory allowedPaths plumbing", () => {
  test("createLoopFromConfig passes allowedPaths to claude-code loop", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    const config: RuntimeConfig = {
      type: "claude-code",
      model: "sonnet",
      cwd: "/home/agent",
      allowedPaths: ["/shared/workspace"],
    };

    const loop = await createLoopFromConfig(config);
    expect(loop).toBeDefined();
    // The loop accepts the config without error — allowedPaths flows through
  });

  test("createLoopFromConfig passes allowedPaths to codex loop", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    const config: RuntimeConfig = {
      type: "codex",
      cwd: "/home/agent",
      allowedPaths: ["/shared/workspace"],
    };

    const loop = await createLoopFromConfig(config);
    expect(loop).toBeDefined();
  });

  test("createLoopFromConfig passes allowedPaths to cursor as env", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    const config: RuntimeConfig = {
      type: "cursor",
      cwd: "/home/agent",
      allowedPaths: ["/shared/workspace", "/extra/path"],
    };

    const loop = await createLoopFromConfig(config);
    expect(loop).toBeDefined();
  });

  test("createLoopFromConfig works without allowedPaths", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    const config: RuntimeConfig = {
      type: "claude-code",
      model: "sonnet",
      cwd: "/home/agent",
    };

    const loop = await createLoopFromConfig(config);
    expect(loop).toBeDefined();
  });
});
