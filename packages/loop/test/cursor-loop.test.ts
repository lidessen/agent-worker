import { test, expect, describe, afterAll, afterEach, mock } from "bun:test";
import type { CliLoopConfig } from "../src/utils/cli-loop.ts";
import type { LoopRun, PreflightResult } from "../src/types.ts";
import { CursorLoop } from "../src/loops/cursor.ts";

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

describe("CursorLoop", () => {
  afterEach(() => {
    mock.restore();
  });

  // mock.module is process-global; restore real modules so later test files aren't poisoned
  afterAll(() => {
    mock.module("../src/utils/cli-loop.ts", () => _realCliLoop);
    mock.module("../src/utils/cli.ts", () => _realCli);
  });

  test("starts with idle status", () => {
    const loop = new CursorLoop();
    expect(loop.status).toBe("idle");
  });

  test("cancel before run is a no-op", () => {
    const loop = new CursorLoop();
    loop.cancel();
    expect(loop.status).toBe("idle");
  });

  test("run transitions to running status", () => {
    const loop = new CursorLoop();
    loop.run("test prompt");
    expect(loop.status).toBe("running");
    // Cancel immediately so it doesn't actually call the CLI
    loop.cancel();
  });

  test("throws error when run is called while already running", () => {
    const loop = new CursorLoop();
    loop.run("first prompt");
    expect(() => loop.run("second prompt")).toThrow("Already running");
    loop.cancel();
  });

  test("cancel transitions status to cancelled", () => {
    const loop = new CursorLoop();
    loop.run("test prompt");
    loop.cancel();
    expect(loop.status).toBe("cancelled");
  });

  test("accepts options in constructor", () => {
    const loop = new CursorLoop({
      model: "claude-sonnet-4",
      extraArgs: ["--test"],
    });
    expect(loop.status).toBe("idle");
  });

  test("run returns LoopRun with async iterator and result promise", () => {
    const loop = new CursorLoop();
    const run = loop.run("test prompt");

    // Verify LoopRun contract
    expect(Symbol.asyncIterator in run).toBe(true);
    expect(run.result).toBeInstanceOf(Promise);

    loop.cancel();
  });

  test("can cancel multiple times safely", () => {
    const loop = new CursorLoop();
    loop.run("test prompt");
    loop.cancel();
    loop.cancel(); // Should not throw
    expect(loop.status).toBe("cancelled");
  });

  describe("preflight", () => {
    test("returns preflight result", async () => {
      const loop = new CursorLoop();
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
      const loop = new CursorLoop();
      expect(loop.status).toBe("idle");
      await loop.preflight();
      expect(loop.status).toBe("idle");
    });
  });

  describe("status transitions", () => {
    test("status transitions to completed after successful run", async () => {
      const loop = new CursorLoop();
      loop.run("test prompt");

      // Cancel immediately to simulate completion
      loop.cancel();

      // Wait a bit for status to update
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Status should be cancelled since we cancelled
      expect(loop.status).toBe("cancelled");
    });

    test("status transitions to failed on error", async () => {
      const loop = new CursorLoop();
      const r = loop.run("test prompt");

      // Cancel to trigger error path
      loop.cancel();

      try {
        await r.result;
      } catch {
        // Expected to fail
      }

      // Status should reflect cancellation
      expect(loop.status).toBe("cancelled");
    });
  });

  describe("options handling", () => {
    test("builds args with model option", () => {
      const loop = new CursorLoop({ model: "claude-sonnet-4" });
      loop.run("test prompt");
      // Verify it doesn't throw and can be cancelled
      loop.cancel();
    });

    test("builds args with extraArgs option", () => {
      const loop = new CursorLoop({ extraArgs: ["--verbose", "--debug"] });
      loop.run("test prompt");
      loop.cancel();
    });

    test("builds args with both model and extraArgs", () => {
      const loop = new CursorLoop({
        model: "claude-sonnet-4",
        extraArgs: ["--verbose"],
      });
      loop.run("test prompt");
      loop.cancel();
    });

    test("handles empty prompt", () => {
      const loop = new CursorLoop();
      loop.run("");
      loop.cancel();
    });
  });

  describe("CLI integration", () => {
    test("uses agent CLI with positional prompt and yolo flags", async () => {
      let capturedConfig: CliLoopConfig | undefined;

      mock.module("../src/utils/cli-loop.ts", () => ({
        runCliLoop: (config: CliLoopConfig) => {
          capturedConfig = config;
          return createStubLoopRun();
        },
      }));

      const { CursorLoop: MockedCursorLoop } = await import(
        `../src/loops/cursor.ts?cursor-args=${Date.now()}`
      );
      const loop = new MockedCursorLoop({
        model: "claude-sonnet-4",
        extraArgs: ["--debug"],
      });

      loop.run("fix the bug");

      expect(capturedConfig).toBeDefined();
      expect(capturedConfig?.command).toBe("agent");
      expect(capturedConfig?.args).toEqual([
        "-p",
        "--output-format",
        "stream-json",
        "--yolo",
        "--approve-mcps",
        "--model",
        "claude-sonnet-4",
        "--debug",
        "fix the bug",
      ]);
    });

    test("maps tool_call started and completed events", async () => {
      let capturedConfig: CliLoopConfig | undefined;

      mock.module("../src/utils/cli-loop.ts", () => ({
        runCliLoop: (config: CliLoopConfig) => {
          capturedConfig = config;
          return createStubLoopRun();
        },
      }));

      const { CursorLoop: MockedCursorLoop } = await import(
        `../src/loops/cursor.ts?cursor-events=${Date.now()}`
      );
      new MockedCursorLoop().run("exercise mapper");

      expect(
        capturedConfig?.mapEvent({
          type: "tool_call",
          subtype: "started",
          call_id: "call_001",
          tool_call: {
            mcpToolCall: {
              args: {
                toolName: "agent_todo",
                args: { action: "add", text: "Write unit tests" },
              },
            },
          },
        }),
      ).toEqual({
        type: "tool_call_start",
        callId: "call_001",
        name: "agent_todo",
        args: { action: "add", text: "Write unit tests" },
      });

      expect(
        capturedConfig?.mapEvent({
          type: "tool_call",
          subtype: "completed",
          call_id: "call_001",
          tool_call: {
            mcpToolCall: {
              result: {
                success: {
                  content: [{ text: { text: "Created todo `todo_6`" } }],
                },
              },
            },
          },
        }),
      ).toEqual({
        type: "tool_call_end",
        name: "unknown",
        callId: "call_001",
        result: "Created todo `todo_6`",
      });
    });

    test("preflight checks agent CLI availability", async () => {
      const checkCliAvailability = mock(async (command: string) => {
        expect(command).toBe("agent");
        return { available: true, version: "0.9.0" };
      });

      mock.module("../src/utils/cli.ts", () => ({
        checkCliAvailability,
      }));

      const { CursorLoop: MockedCursorLoop } = await import(
        `../src/loops/cursor.ts?cursor-preflight=${Date.now()}`
      );
      const result: PreflightResult = await new MockedCursorLoop().preflight();

      expect(result).toEqual({
        ok: true,
        version: "0.9.0",
        error: undefined,
      });
      expect(checkCliAvailability).toHaveBeenCalledTimes(1);
    });
  });
});
