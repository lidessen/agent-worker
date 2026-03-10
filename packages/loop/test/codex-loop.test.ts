import { test, expect, describe, afterAll, afterEach, mock } from "bun:test";
import type { CliLoopConfig } from "../src/utils/cli-loop.ts";
import type { LoopRun, PreflightResult } from "../src/types.ts";
import { CodexLoop } from "../src/loops/codex.ts";

// Capture real module exports before any mock.module calls can replace them.
// Spread into plain objects so values are frozen (not live ESM bindings).
import * as _cliLoopMod from "../src/utils/cli-loop.ts";
import * as _cliMod from "../src/utils/cli.ts";
const _realCliLoop = { ..._cliLoopMod };
const _realCli = { ..._cliMod };

function createStubLoopRun(): LoopRun {
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          return { done: true, value: undefined };
        },
      };
    },
    result: Promise.resolve({
      events: [],
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      durationMs: 0,
    }),
  };
}

describe("CodexLoop", () => {
  afterEach(() => {
    mock.restore();
  });

  // mock.module is process-global; restore real modules so later test files aren't poisoned
  afterAll(() => {
    mock.module("../src/utils/cli-loop.ts", () => _realCliLoop);
    mock.module("../src/utils/cli.ts", () => _realCli);
  });

  test("starts with idle status", () => {
    const loop = new CodexLoop();
    expect(loop.status).toBe("idle");
  });

  test("cancel before run is a no-op", () => {
    const loop = new CodexLoop();
    loop.cancel();
    expect(loop.status).toBe("idle");
  });

  test("run transitions to running status", () => {
    const loop = new CodexLoop();
    loop.run("test prompt");
    expect(loop.status).toBe("running");
    loop.cancel();
  });

  test("throws error when run is called while already running", () => {
    const loop = new CodexLoop();
    loop.run("first prompt");
    expect(() => loop.run("second prompt")).toThrow("Already running");
    loop.cancel();
  });

  test("cancel transitions status to cancelled", () => {
    const loop = new CodexLoop();
    loop.run("test prompt");
    loop.cancel();
    expect(loop.status).toBe("cancelled");
  });

  test("accepts options in constructor", () => {
    const loop = new CodexLoop({
      model: "o3",
      fullAuto: true,
      sandbox: "workspace-write",
      extraArgs: ["--test"],
    });
    expect(loop.status).toBe("idle");
  });

  test("run returns LoopRun with async iterator and result promise", () => {
    const loop = new CodexLoop();
    const run = loop.run("test prompt");

    expect(Symbol.asyncIterator in run).toBe(true);
    expect(run.result).toBeInstanceOf(Promise);

    loop.cancel();
  });

  test("can cancel multiple times safely", () => {
    const loop = new CodexLoop();
    loop.run("test prompt");
    loop.cancel();
    loop.cancel();
    expect(loop.status).toBe("cancelled");
  });

  describe("preflight", () => {
    test("returns preflight result", async () => {
      const loop = new CodexLoop();
      const result = await loop.preflight();

      expect(result).toHaveProperty("ok");
      expect(typeof result.ok).toBe("boolean");
      if (result.ok) {
        expect(result).toHaveProperty("version");
      } else {
        expect(result).toHaveProperty("error");
      }
    });

    test("preflight does not change status", async () => {
      const loop = new CodexLoop();
      expect(loop.status).toBe("idle");
      await loop.preflight();
      expect(loop.status).toBe("idle");
    });
  });

  describe("status transitions", () => {
    test("cancel during run sets cancelled", () => {
      const loop = new CodexLoop();
      loop.run("test prompt");
      expect(loop.status).toBe("running");
      loop.cancel();
      expect(loop.status).toBe("cancelled");
    });

    test("status stays cancelled after cancel + await", async () => {
      const loop = new CodexLoop();
      const run = loop.run("test prompt");
      loop.cancel();

      try {
        await run.result;
      } catch {
        /* expected */
      }

      expect(loop.status).toBe("cancelled");
    });
  });

  describe("options handling", () => {
    test("builds args with model option", () => {
      const loop = new CodexLoop({ model: "o3-mini" });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with fullAuto option", () => {
      const loop = new CodexLoop({ fullAuto: true });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with sandbox option", () => {
      const loop = new CodexLoop({ sandbox: "read-only" });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with extraArgs option", () => {
      const loop = new CodexLoop({ extraArgs: ["--verbose", "--debug"] });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with all options combined", () => {
      const loop = new CodexLoop({
        model: "o3",
        fullAuto: true,
        sandbox: "danger-full-access",
        extraArgs: ["--verbose"],
      });
      loop.run("test prompt");
      loop.cancel();
    });

    test("handles empty prompt", () => {
      const loop = new CodexLoop();
      loop.run("");
      loop.cancel();
    });
  });

  describe("CLI integration", () => {
    test("maps MCP tool and agent message events from item lifecycle payloads", async () => {
      let capturedConfig: CliLoopConfig | undefined;

      mock.module("../src/utils/cli-loop.ts", () => ({
        runCliLoop: (config: CliLoopConfig) => {
          capturedConfig = config;
          return createStubLoopRun();
        },
      }));

      const { CodexLoop: MockedCodexLoop } = await import(
        `../src/loops/codex.ts?codex-item-events=${Date.now()}`
      );
      const loop = new MockedCodexLoop();
      loop.run("check mapping");

      expect(capturedConfig?.command).toBe("codex");

      expect(
        capturedConfig?.mapEvent({
          type: "item.started",
          item: {
            type: "mcp_tool_call",
            id: "call_123",
            tool: "agent_todo",
            arguments: { action: "add", text: "Write unit tests" },
          },
        }),
      ).toEqual({
        type: "tool_call_start",
        callId: "call_123",
        name: "agent_todo",
        args: { action: "add", text: "Write unit tests" },
      });

      expect(
        capturedConfig?.mapEvent({
          type: "item.completed",
          item: {
            type: "mcp_tool_call",
            id: "call_123",
            tool: "agent_todo",
            result: {
              content: [{ text: "Created todo `todo_6`" }],
            },
          },
        }),
      ).toEqual({
        type: "tool_call_end",
        callId: "call_123",
        name: "agent_todo",
        result: "Created todo `todo_6`",
      });

      expect(
        capturedConfig?.mapEvent({
          type: "item.completed",
          item: {
            type: "agent_message",
            text: "I added the todo.",
          },
        }),
      ).toEqual({
        type: "text",
        text: "I added the todo.",
      });
    });

    test("preflight requires codex CLI and authentication", async () => {
      const checkCliAvailability = mock(async (command: string) => {
        expect(command).toBe("codex");
        return { available: true, version: "1.2.3" };
      });
      const checkCodexAuth = mock(async () => ({ authenticated: false, error: "Not logged in" }));

      mock.module("../src/utils/cli.ts", () => ({
        checkCliAvailability,
        checkCodexAuth,
      }));

      const { CodexLoop: MockedCodexLoop } = await import(
        `../src/loops/codex.ts?codex-preflight=${Date.now()}`
      );
      const result: PreflightResult = await new MockedCodexLoop().preflight();

      expect(result).toEqual({
        ok: false,
        version: "1.2.3",
        error: "Not logged in",
      });
      expect(checkCliAvailability).toHaveBeenCalledTimes(1);
      expect(checkCodexAuth).toHaveBeenCalledTimes(1);
    });
  });
});
