import { test, expect, describe } from "bun:test";
import { getDefaultModel } from "@agent-worker/loop";
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

  test("createLoopFromConfig passes allowedPaths to cursor loop options", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    const config: RuntimeConfig = {
      type: "cursor",
      cwd: "/home/agent",
      allowedPaths: ["/shared/workspace", "/extra/path"],
    };

    const loop = await createLoopFromConfig(config);
    expect(loop).toBeDefined();
    const internal = loop as unknown as { options: { allowedPaths?: string[] } };
    expect(internal.options.allowedPaths).toEqual(["/shared/workspace", "/extra/path"]);
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

  test("createLoopFromConfig writes temp MCP config for config-file runtimes", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    const config: RuntimeConfig = {
      type: "codex",
      cwd: "/home/agent",
      mcpServers: {
        sentry: {
          type: "http",
          url: "https://mcp.sentry.dev/mcp",
        },
      },
    };

    const loop = (await createLoopFromConfig(config)) as {
      _mcpConfigPath?: string;
      cleanup?: () => Promise<void>;
    };
    expect(typeof loop._mcpConfigPath).toBe("string");
    expect(await Bun.file(loop._mcpConfigPath!).exists()).toBe(true);

    await loop.cleanup?.();

    expect(await Bun.file(loop._mcpConfigPath!).exists()).toBe(false);
  });

  test("createLoopFromConfig rejects MCP OAuth config", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    await expect(
      createLoopFromConfig({
        type: "claude-code",
        model: "sonnet",
        mcpServers: {
          figma: {
            type: "http",
            url: "https://mcp.figma.com/mcp",
            oauth: { clientId: "client-123" },
          } as unknown as NonNullable<RuntimeConfig["mcpServers"]>[string],
        },
      }),
    ).rejects.toThrow("Remote MCP OAuth is not supported");
  });

  test("createLoopFromConfig rejects external MCP for ai-sdk", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");

    await expect(
      createLoopFromConfig({
        type: "ai-sdk",
        model: getDefaultModel("openai"),
        mcpServers: {
          remote: {
            type: "http",
            url: "https://example.com/mcp",
          },
        },
      }),
    ).rejects.toThrow("supported only for SDK-native or config-file runtimes");
  });
});

describe("phase-3 policy plumbing", () => {
  test("claude-code uses bypassPermissions by default when no permissionMode is set", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");
    const loop = await createLoopFromConfig({
      type: "claude-code",
      model: "sonnet",
    });
    // The loop's internal options are private; the field we
    // care about is observable on the underlying options object.
    // We cast narrowly — the whole point of this test is to
    // lock the wiring down.
    const internal = loop as unknown as { options: { permissionMode?: string } };
    expect(internal.options.permissionMode).toBe("bypassPermissions");
  });

  test("claude-code honors an explicit permissionMode override", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");
    const loop = await createLoopFromConfig({
      type: "claude-code",
      model: "sonnet",
      permissionMode: "acceptEdits",
    });
    const internal = loop as unknown as { options: { permissionMode?: string } };
    expect(internal.options.permissionMode).toBe("acceptEdits");
  });

  test("codex uses fullAuto=true by default when no policy is set", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");
    const loop = await createLoopFromConfig({
      type: "codex",
    });
    const internal = loop as unknown as { options: { fullAuto?: boolean; sandbox?: string } };
    expect(internal.options.fullAuto).toBe(true);
    // sandbox is deliberately left undefined so CodexLoop picks
    // its own default based on fullAuto at ensureThread() time.
    expect(internal.options.sandbox).toBeUndefined();
  });

  test("codex honors fullAuto=false and an explicit sandbox", async () => {
    const { createLoopFromConfig } = await import("../src/loop-factory.ts");
    const loop = await createLoopFromConfig({
      type: "codex",
      fullAuto: false,
      sandbox: "read-only",
    });
    const internal = loop as unknown as { options: { fullAuto?: boolean; sandbox?: string } };
    expect(internal.options.fullAuto).toBe(false);
    expect(internal.options.sandbox).toBe("read-only");
  });
});
