import { test, expect, describe, afterAll, afterEach, mock } from "bun:test";
import type { PreflightResult } from "../src/types.ts";
import { CodexLoop, mapCodexItemEnd, mapCodexItemStart } from "../src/loops/codex.ts";
import * as _cliMod from "../src/utils/cli.ts";
const _realCli = { ..._cliMod };

describe("CodexLoop", () => {
  afterEach(() => {
    mock.restore();
  });

  afterAll(() => {
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

  test("advertises interruptible capability", () => {
    const loop = new CodexLoop();
    expect(loop.supports).toContain("interruptible");
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
    test("maps MCP tool lifecycle items", () => {
      expect(
        mapCodexItemStart({
          type: "mcpToolCall",
          id: "call_123",
          tool: "agent_todo",
          arguments: { action: "add", text: "Write unit tests" },
        }),
      ).toEqual({
        type: "tool_call_start",
        callId: "call_123",
        name: "agent_todo",
        args: { action: "add", text: "Write unit tests" },
      });

      expect(
        mapCodexItemEnd({
          type: "mcpToolCall",
          id: "call_123",
          tool: "agent_todo",
          result: {
            content: [{ text: "Created todo `todo_6`" }],
          },
        }),
      ).toEqual({
        type: "tool_call_end",
        callId: "call_123",
        name: "agent_todo",
        result: {
          content: [{ text: "Created todo `todo_6`" }],
        },
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

  describe("session reuse", () => {
    test("resumes a preset threadId instead of starting a new thread", async () => {
      const requestLog: Array<{ method: string; params?: unknown }> = [];
      let onNotification: ((message: { method: string; params?: unknown }) => void) | null = null;

      class MockJsonRpcClient {
        constructor(_options: unknown) {}

        start(cb: (message: { method: string; params?: unknown }) => void): void {
          onNotification = cb;
        }

        async request(method: string, params?: unknown): Promise<unknown> {
          requestLog.push({ method, params });
          if (method === "initialize") {
            return { userAgent: "test", codexHome: "/tmp", platformFamily: "unix", platformOs: "macos" };
          }
          if (method === "thread/resume") {
            return { thread: { id: "thread-preset" } };
          }
          if (method === "turn/start") {
            setTimeout(() => {
              onNotification?.({
                method: "item/agentMessage/delta",
                params: {
                  threadId: "thread-preset",
                  turnId: "turn-1",
                  itemId: "item-1",
                  delta: "Hello",
                },
              });
              onNotification?.({
                method: "thread/tokenUsage/updated",
                params: {
                  threadId: "thread-preset",
                  turnId: "turn-1",
                  tokenUsage: {
                    last: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
                  },
                },
              });
              onNotification?.({
                method: "turn/completed",
                params: {
                  threadId: "thread-preset",
                  turn: { id: "turn-1", status: "completed", error: null },
                },
              });
            }, 0);
            return { turn: { id: "turn-1" } };
          }
          if (method === "turn/interrupt") return {};
          return {};
        }

        close(): void {}
      }

      mock.module("../src/utils/jsonrpc-stdio.ts", () => ({
        JsonRpcStdioClient: MockJsonRpcClient,
      }));

      const { CodexLoop: MockedCodexLoop } = await import(
        `../src/loops/codex.ts?resume-thread=${Date.now()}`
      );

      const loop = new MockedCodexLoop();
      loop.setThreadId("thread-preset");
      const run = loop.run("continue");
      const result = await run.result;

      expect(
        result.events.some((event: { type: string; text?: string }) => event.type === "text" && event.text === "Hello"),
      ).toBe(
        true,
      );
      expect(requestLog.filter((entry) => entry.method === "thread/resume")).toHaveLength(1);
      expect(requestLog.filter((entry) => entry.method === "thread/start")).toHaveLength(0);
    });

    test("reuses the same thread across runs after cancel", async () => {
      const requestLog: Array<{ method: string; params?: unknown }> = [];
      let onNotification: ((message: { method: string; params?: unknown }) => void) | null = null;
      let turnCounter = 0;
      let closeCount = 0;

      class MockJsonRpcClient {
        constructor(_options: unknown) {}

        start(cb: (message: { method: string; params?: unknown }) => void): void {
          onNotification = cb;
        }

        async request(method: string, params?: unknown): Promise<unknown> {
          requestLog.push({ method, params });
          if (method === "initialize") {
            return { userAgent: "test", codexHome: "/tmp", platformFamily: "unix", platformOs: "macos" };
          }
          if (method === "thread/start") {
            return { thread: { id: "thread-reuse" } };
          }
          if (method === "turn/start") {
            turnCounter++;
            const turnId = `turn-${turnCounter}`;
            setTimeout(() => {
              onNotification?.({
                method: "turn/completed",
                params: {
                  threadId: "thread-reuse",
                  turn: { id: turnId, status: "completed", error: null },
                },
              });
            }, 0);
            return { turn: { id: turnId } };
          }
          if (method === "turn/interrupt") return {};
          return {};
        }

        close(): void {
          closeCount++;
        }
      }

      mock.module("../src/utils/jsonrpc-stdio.ts", () => ({
        JsonRpcStdioClient: MockJsonRpcClient,
      }));

      const { CodexLoop: MockedCodexLoop } = await import(
        `../src/loops/codex.ts?reuse-thread=${Date.now()}`
      );

      const loop = new MockedCodexLoop();
      await loop.run("first").result;
      loop.cancel();
      await loop.run("second").result;

      expect(requestLog.filter((entry) => entry.method === "thread/start")).toHaveLength(1);
      expect(requestLog.filter((entry) => entry.method === "turn/start")).toHaveLength(2);
      expect(closeCount).toBe(0);
    });

    test("cancelled turns reject when app-server reports interrupted", async () => {
      const requestLog: Array<{ method: string; params?: unknown }> = [];
      let onNotification: ((message: { method: string; params?: unknown }) => void) | null = null;

      class MockJsonRpcClient {
        constructor(_options: unknown) {}

        start(cb: (message: { method: string; params?: unknown }) => void): void {
          onNotification = cb;
        }

        async request(method: string, params?: unknown): Promise<unknown> {
          requestLog.push({ method, params });
          if (method === "initialize") {
            return { userAgent: "test", codexHome: "/tmp", platformFamily: "unix", platformOs: "macos" };
          }
          if (method === "thread/start") {
            return { thread: { id: "thread-cancel" } };
          }
          if (method === "turn/start") {
            return { turn: { id: "turn-cancel" } };
          }
          if (method === "turn/interrupt") {
            setTimeout(() => {
              onNotification?.({
                method: "turn/completed",
                params: {
                  threadId: "thread-cancel",
                  turn: {
                    id: "turn-cancel",
                    status: "interrupted",
                    error: { message: "user interrupted" },
                  },
                },
              });
            }, 0);
            return {};
          }
          return {};
        }

        close(): void {}
      }

      mock.module("../src/utils/jsonrpc-stdio.ts", () => ({
        JsonRpcStdioClient: MockJsonRpcClient,
      }));

      const { CodexLoop: MockedCodexLoop } = await import(
        `../src/loops/codex.ts?interrupted=${Date.now()}`
      );

      const loop = new MockedCodexLoop();
      const run = loop.run("cancel me");
      await new Promise((resolve) => setTimeout(resolve, 0));
      loop.cancel();

      await expect(run.result).rejects.toThrow("user interrupted");
      expect(loop.status).toBe("cancelled");
      expect(requestLog.filter((entry) => entry.method === "turn/interrupt")).toHaveLength(1);
    });

    test("interrupt steers the active turn", async () => {
      const requestLog: Array<{ method: string; params?: unknown }> = [];
      let onNotification: ((message: { method: string; params?: unknown }) => void) | null = null;

      class MockJsonRpcClient {
        constructor(_options: unknown) {}

        start(cb: (message: { method: string; params?: unknown }) => void): void {
          onNotification = cb;
        }

        async request(method: string, params?: unknown): Promise<unknown> {
          requestLog.push({ method, params });
          if (method === "initialize") {
            return { userAgent: "test", codexHome: "/tmp", platformFamily: "unix", platformOs: "macos" };
          }
          if (method === "thread/start") {
            return { thread: { id: "thread-steer" } };
          }
          if (method === "turn/start") {
            setTimeout(() => {
              void loop.interrupt?.("focus on tests first");
              setTimeout(() => {
                onNotification?.({
                  method: "turn/completed",
                  params: {
                    threadId: "thread-steer",
                    turn: { id: "turn-steer", status: "completed", error: null },
                  },
                });
              }, 0);
            }, 0);
            return { turn: { id: "turn-steer" } };
          }
          if (method === "turn/steer") {
            return {};
          }
          return {};
        }

        close(): void {}
      }

      mock.module("../src/utils/jsonrpc-stdio.ts", () => ({
        JsonRpcStdioClient: MockJsonRpcClient,
      }));

      const { CodexLoop: MockedCodexLoop } = await import(
        `../src/loops/codex.ts?steer=${Date.now()}`
      );

      const loop = new MockedCodexLoop();
      await loop.run("start").result;

      expect(requestLog.filter((entry) => entry.method === "turn/steer")).toHaveLength(1);
      expect(requestLog.find((entry) => entry.method === "turn/steer")?.params).toEqual({
        threadId: "thread-steer",
        expectedTurnId: "turn-steer",
        input: [{ type: "text", text: "focus on tests first", text_elements: [] }],
      });
    });

    test("interrupt rejects when no active turn exists", async () => {
      const loop = new CodexLoop();
      await expect(loop.interrupt?.("hello")).rejects.toThrow("No active turn to interrupt");
    });
  });
});
