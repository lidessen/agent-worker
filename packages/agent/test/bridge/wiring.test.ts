import { test, expect, describe, afterEach, mock } from "bun:test";
import { LoopWiring, type LoopWiringDeps } from "../../src/bridge/wiring.ts";
import type { AgentLoop } from "../../src/types.ts";
import { Inbox } from "../../src/inbox.ts";
import { TodoManager } from "../../src/todo.ts";
import { InMemoryNotesStorage } from "../../src/notes.ts";
import { SendGuard } from "../../src/send.ts";
import { RunCoordinator } from "../../src/run-coordinator.ts";
import { ContextEngine } from "../../src/context-engine.ts";
import { ReminderManager } from "../../src/reminder.ts";
import { tool, type ToolSet } from "ai";
import { z } from "zod";

function createMockLoop(
  supports: string[] = [],
  opts: { sdkMcp?: boolean; cliMcp?: boolean } = {},
): AgentLoop {
  const mockLoop: AgentLoop = {
    supports: supports as any,
    run: mock(() => ({}) as any),
    cancel: mock(() => {}),
    get status() {
      return "idle" as any;
    },
    setTools: mock(() => {}),
    setPrepareStep: mock(() => {}),
    setMcpConfig: opts.cliMcp === false ? undefined : mock(() => {}),
    setMcpServers: opts.sdkMcp ? mock(() => {}) : undefined,
    setHooks: mock(() => {}),
  };
  return mockLoop;
}

function createDeps(
  loop: AgentLoop,
  toolkit?: { tools?: ToolSet; includeBuiltins?: boolean },
  runtimeHooks?: { hooks?: Record<string, unknown> },
): LoopWiringDeps {
  const inbox = new Inbox({}, () => {});
  const todos = new TodoManager();
  const notes = new InMemoryNotesStorage();
  const sendGuard = new SendGuard(inbox, () => {});
  const reminders = new ReminderManager();
  const contextEngine = new ContextEngine();
  const coordinator = new RunCoordinator({
    loop,
    inbox,
    todos,
    notes,
    contextEngine,
    memory: null,
    reminders,
    instructions: "",
    maxRuns: 10,
  });

  return {
    loop,
    coordinator,
    inbox,
    todos,
    notes,
    memory: null,
    sendGuard,
    reminders,
    toolkit,
    runtimeHooks,
  };
}

describe("LoopWiring", () => {
  let wiring: LoopWiring;
  let mockLoop: AgentLoop;

  afterEach(async () => {
    await wiring?.stop();
  });

  describe("directTools capability", () => {
    test("sets tools when loop supports directTools", async () => {
      mockLoop = createMockLoop(["directTools"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setTools).toHaveBeenCalledTimes(1);
      const tools = (mockLoop.setTools as any).mock.calls[0][0];
      expect(tools).toBeDefined();
      expect(typeof tools).toBe("object");
    });

    test("includes builtin tools by default", async () => {
      mockLoop = createMockLoop(["directTools"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      const tools = (mockLoop.setTools as any).mock.calls[0][0];
      expect(Object.keys(tools).length).toBeGreaterThan(0);
      expect(Object.keys(tools).some((k: string) => k.startsWith("agent_"))).toBe(true);
    });

    test("excludes builtin tools when includeBuiltins is false", async () => {
      mockLoop = createMockLoop(["directTools"]);
      wiring = new LoopWiring(createDeps(mockLoop, { includeBuiltins: false }));
      await wiring.init();

      // When includeBuiltins is false and no user tools, setTools should not be called
      expect(mockLoop.setTools).not.toHaveBeenCalled();
    });

    test("merges user tools with builtins", async () => {
      mockLoop = createMockLoop(["directTools"]);
      const userTools: ToolSet = {
        custom_tool: tool({
          description: "A custom tool",
          inputSchema: z.object({}),
          execute: async (
            _args: Record<string, never>,
            _options: import("ai").ToolExecutionOptions,
          ) => "result",
        }),
      };
      wiring = new LoopWiring(createDeps(mockLoop, { tools: userTools }));
      await wiring.init();

      const tools = (mockLoop.setTools as any).mock.calls[0][0];
      expect(tools.custom_tool).toBeDefined();
      expect(Object.keys(tools).some((k: string) => k.startsWith("agent_"))).toBe(true);
    });

    test("validates user tool namespace against builtins", async () => {
      mockLoop = createMockLoop(["directTools"]);
      const userTools: ToolSet = {
        agent_todo: tool({
          description: "Should fail",
          inputSchema: z.object({}),
          execute: async (
            _args: Record<string, never>,
            _options: import("ai").ToolExecutionOptions,
          ) => "result",
        }),
      };

      wiring = new LoopWiring(createDeps(mockLoop, { tools: userTools }));
      await expect(wiring.init()).rejects.toThrow(/reserved prefix/);
    });

    test("validates reserved prefix even for MCP-backed loops", async () => {
      mockLoop = createMockLoop([], { sdkMcp: true });
      const userTools: ToolSet = {
        agent_reserved: tool({
          description: "Should fail",
          inputSchema: z.object({}),
          execute: async () => "result",
        }),
      };

      wiring = new LoopWiring(createDeps(mockLoop, { tools: userTools, includeBuiltins: false }));
      await expect(wiring.init()).rejects.toThrow(/reserved prefix/);
    });

    test("does not call setTools when tools object is empty", async () => {
      mockLoop = createMockLoop(["directTools"]);
      wiring = new LoopWiring(createDeps(mockLoop, { includeBuiltins: false }));
      await wiring.init();

      // Should not call setTools when no tools
      expect(mockLoop.setTools).not.toHaveBeenCalled();
    });
  });

  describe("prepareStep capability", () => {
    test("sets prepareStep hook when loop supports prepareStep", async () => {
      mockLoop = createMockLoop(["prepareStep"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setPrepareStep).toHaveBeenCalledTimes(1);
      expect(typeof (mockLoop.setPrepareStep as any).mock.calls[0][0]).toBe("function");
    });

    test("prepareStep hook calls coordinator.assembleForStep", async () => {
      mockLoop = createMockLoop(["prepareStep"]);
      const deps = createDeps(mockLoop);
      wiring = new LoopWiring(deps);
      await wiring.init();

      const prepareStepFn = (mockLoop.setPrepareStep as any).mock.calls[0][0];
      const assembleSpy = mock(deps.coordinator.assembleForStep.bind(deps.coordinator));
      deps.coordinator.assembleForStep = assembleSpy as any;

      // assembleForStep may throw if contextEngine is not properly set up, so we just verify it's called
      try {
        await prepareStepFn({
          steps: [],
          stepNumber: 1,
          model: {},
          messages: [],
          experimental_context: {},
        });
      } catch {
        // Expected if contextEngine dependencies aren't fully mocked
      }
      expect(assembleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("hooks capability", () => {
    test("sets default runtime hooks when loop supports hooks", async () => {
      mockLoop = createMockLoop(["hooks"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setHooks).toHaveBeenCalledTimes(1);
      const hooks = (mockLoop.setHooks as any).mock.calls[0][0];
      expect(hooks.Notification).toBeDefined();
      expect(hooks.PreCompact).toBeDefined();
      expect(hooks.Stop).toBeDefined();
    });

    test("merges configured hooks when loop supports hooks", async () => {
      mockLoop = createMockLoop(["hooks"]);
      const hooks = {
        Notification: [{ hooks: [async () => ({ continue: true })] }],
      };
      wiring = new LoopWiring(createDeps(mockLoop, undefined, { hooks }));
      await wiring.init();

      expect(mockLoop.setHooks).toHaveBeenCalledTimes(1);
      const merged = (mockLoop.setHooks as any).mock.calls[0][0];
      expect(merged.Notification.length).toBeGreaterThan(1);
      expect(merged.PreCompact).toBeDefined();
      expect(merged.Stop).toBeDefined();
    });
  });

  describe("CLI bridge setup", () => {
    test("starts bridge and MCP server for CLI loops", async () => {
      mockLoop = createMockLoop([]); // No capabilities = CLI loop
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setMcpConfig).toHaveBeenCalledTimes(1);
      const configPath = (mockLoop.setMcpConfig as any).mock.calls[0][0];
      expect(typeof configPath).toBe("string");
      expect(configPath.length).toBeGreaterThan(0);
    });

    test("bridge starts even when includeBuiltins is false", async () => {
      mockLoop = createMockLoop([]);
      wiring = new LoopWiring(createDeps(mockLoop, { includeBuiltins: false }));
      await wiring.init();

      // Bridge should still start (transport is independent of tool selection)
      expect(mockLoop.setMcpConfig).toHaveBeenCalledTimes(1);
    });

    test("does not start bridge for directTools loops", async () => {
      mockLoop = createMockLoop(["directTools"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setMcpConfig).not.toHaveBeenCalled();
    });

    test("prefers sdk-native MCP servers when loop supports setMcpServers", async () => {
      mockLoop = createMockLoop([], { sdkMcp: true });
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setMcpServers).toHaveBeenCalledTimes(1);
      expect(mockLoop.setMcpConfig).not.toHaveBeenCalled();

      const servers = (mockLoop.setMcpServers as any).mock.calls[0][0];
      expect(servers).toBeDefined();
      expect(typeof servers["agent-worker"]).toBe("object");
    });
  });

  describe("combined capabilities", () => {
    test("handles loop with both directTools and prepareStep", async () => {
      mockLoop = createMockLoop(["directTools", "prepareStep"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setTools).toHaveBeenCalledTimes(1);
      expect(mockLoop.setPrepareStep).toHaveBeenCalledTimes(1);
      expect(mockLoop.setMcpServers).toBeUndefined();
      expect(mockLoop.setMcpConfig).not.toHaveBeenCalled();
    });

    test("handles loop with prepareStep only", async () => {
      mockLoop = createMockLoop(["prepareStep"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      expect(mockLoop.setPrepareStep).toHaveBeenCalledTimes(1);
      expect(mockLoop.setTools).not.toHaveBeenCalled();
      // CLI loops (without directTools) still get bridge setup if setMcpConfig exists
      // This is correct behavior - prepareStep doesn't prevent CLI bridge setup
      if (mockLoop.setMcpConfig) {
        expect(mockLoop.setMcpConfig).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe("stop", () => {
    test("stops bridge and MCP server", async () => {
      mockLoop = createMockLoop([]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      await wiring.stop();
      // Should not throw and should clean up resources
    });

    test("stop is idempotent", async () => {
      mockLoop = createMockLoop([]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      await wiring.stop();
      await wiring.stop(); // Should not throw
    });

    test("stop works even if bridge was not started", async () => {
      mockLoop = createMockLoop(["directTools"]);
      wiring = new LoopWiring(createDeps(mockLoop));
      await wiring.init();

      await wiring.stop(); // Should not throw
    });
  });
});
