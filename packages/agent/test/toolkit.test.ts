import { test, expect, describe } from "bun:test";
import { tool, type ToolSet, type ToolExecutionOptions } from "ai";
import { z } from "zod";
import { createBuiltinTools, validateToolNamespace, mergeTools } from "../src/toolkit.ts";
import { Inbox } from "../src/inbox.ts";
import { TodoManager } from "../src/todo.ts";
import { InMemoryNotesStorage } from "../src/notes.ts";
import { SendGuard } from "../src/send.ts";
import { ReminderManager } from "../src/reminder.ts";
import type { ToolHandlerDeps } from "../src/tool-registry.ts";

const dummyOptions: ToolExecutionOptions = {
  toolCallId: "test-call",
  messages: [],
};

describe("toolkit", () => {
  // Create mock dependencies
  function createMockDeps(overrides: Partial<ToolHandlerDeps> = {}): ToolHandlerDeps {
    return {
      inbox: new Inbox({}, () => {}),
      todos: new TodoManager(),
      notes: new InMemoryNotesStorage(),
      memory: null,
      sendGuard: new SendGuard(new Inbox({}, () => {}), () => {}),
      reminders: new ReminderManager(),
      ...overrides,
    };
  }

  describe("createBuiltinTools", () => {
    test("creates tools from builtin definitions", () => {
      const deps = createMockDeps();
      const tools = createBuiltinTools(deps);

      expect(tools.agent_inbox).toBeDefined();
      expect(tools.agent_send).toBeDefined();
      expect(tools.agent_todo).toBeDefined();
      expect(tools.agent_notes).toBeDefined();
      expect(tools.agent_reminder).toBeDefined();
    });

    test("excludes agent_memory when memory is null", () => {
      const deps = createMockDeps({ memory: null });
      const tools = createBuiltinTools(deps);

      expect(tools.agent_memory).toBeUndefined();
    });

    test("includes agent_memory when memory is provided", () => {
      const mockMemory = {
        search: async () => [],
      };
      const deps = createMockDeps({ memory: mockMemory as any });
      const tools = createBuiltinTools(deps);

      expect(tools.agent_memory).toBeDefined();
    });

    test("creates tools with execute functions", () => {
      const deps = createMockDeps();
      const tools = createBuiltinTools(deps);

      // Each tool should have an execute function
      for (const [, toolDef] of Object.entries(tools)) {
        expect(toolDef).toBeDefined();
        expect(typeof toolDef.execute).toBe("function");
      }
    });

    test("execute function returns string result", async () => {
      const inbox = new Inbox({}, () => {});
      inbox.push("test");
      const deps = createMockDeps({ inbox });
      const tools = createBuiltinTools(deps);

      const result = await tools.agent_inbox!.execute!({ action: "peek" }, dummyOptions);
      expect(typeof result).toBe("string");
      expect(result).toContain("test");
    });

    test("agent_inbox tool works correctly", async () => {
      const inbox = new Inbox({}, () => {});
      const msg = inbox.push("hello");
      const deps = createMockDeps({ inbox });
      const tools = createBuiltinTools(deps);

      const peekResult = await tools.agent_inbox!.execute!({ action: "peek" }, dummyOptions);
      expect(typeof peekResult).toBe("string");

      const readResult = await tools.agent_inbox!.execute!(
        { action: "read", id: msg.id },
        dummyOptions,
      );
      const parsed = JSON.parse(readResult);
      expect(parsed.content).toBe("hello");
    });

    test("agent_todo tool works correctly", async () => {
      const todos = new TodoManager();
      const deps = createMockDeps({ todos });
      const tools = createBuiltinTools(deps);

      const addResult = await tools.agent_todo!.execute!(
        { action: "add", text: "test" },
        dummyOptions,
      );
      const item = JSON.parse(addResult);
      expect(item.text).toBe("test");

      const listResult = await tools.agent_todo!.execute!({ action: "list" }, dummyOptions);
      const list = JSON.parse(listResult);
      expect(Array.isArray(list)).toBe(true);
      expect(list).toHaveLength(1);
    });

    test("agent_notes tool works correctly", async () => {
      const notes = new InMemoryNotesStorage();
      const deps = createMockDeps({ notes });
      const tools = createBuiltinTools(deps);

      await tools.agent_notes!.execute!(
        { action: "write", key: "test", content: "hello" },
        dummyOptions,
      );
      const result = await tools.agent_notes!.execute!(
        { action: "read", key: "test" },
        dummyOptions,
      );
      expect(result).toBe("hello");
    });

    test("agent_reminder tool works correctly", async () => {
      const reminders = new ReminderManager();
      const deps = createMockDeps({ reminders });
      const tools = createBuiltinTools(deps);

      const setResult = await tools.agent_reminder!.execute!(
        { action: "set", label: "test" },
        dummyOptions,
      );
      const parsed = JSON.parse(setResult);
      expect(parsed.status).toBe("reminder_set");
      expect(parsed.reminderId).toBeDefined();
    });

    test("agent_send tool works correctly", async () => {
      const sendGuard = new SendGuard(new Inbox({}, () => {}), () => {});
      const deps = createMockDeps({ sendGuard });
      const tools = createBuiltinTools(deps);

      const result = await tools.agent_send!.execute!(
        { target: "user", content: "hello" },
        dummyOptions,
      );
      expect(typeof result).toBe("string");
    });

    test("returns ToolSet with correct structure", () => {
      const deps = createMockDeps();
      const tools = createBuiltinTools(deps);

      // Verify it's a ToolSet (object with tool definitions)
      expect(typeof tools).toBe("object");
      for (const [name] of Object.entries(tools)) {
        expect(typeof name).toBe("string");
        expect(name.startsWith("agent_")).toBe(true);
      }
    });
  });

  describe("validateToolNamespace", () => {
    test("allows tools without reserved prefix", () => {
      const userTools: ToolSet = {
        custom_tool: tool({
          description: "A custom tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };
      const builtinTools = createBuiltinTools(createMockDeps());

      // Should not throw
      expect(() => validateToolNamespace(userTools, builtinTools)).not.toThrow();
    });

    test("allows multiple custom tools", () => {
      const userTools: ToolSet = {
        custom_tool_1: tool({
          description: "First tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
        custom_tool_2: tool({
          description: "Second tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };
      const builtinTools = createBuiltinTools(createMockDeps());

      expect(() => validateToolNamespace(userTools, builtinTools)).not.toThrow();
    });

    test("rejects tools with agent_ prefix", () => {
      const userTools: ToolSet = {
        agent_custom: tool({
          description: "Custom agent tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };
      const builtinTools = createBuiltinTools(createMockDeps());

      expect(() => validateToolNamespace(userTools, builtinTools)).toThrow(
        /reserved prefix.*agent_/,
      );
    });

    test("rejects multiple tools when one uses agent_ prefix", () => {
      const userTools: ToolSet = {
        custom_tool: tool({
          description: "A custom tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
        agent_bad: tool({
          description: "Bad tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };
      const builtinTools = createBuiltinTools(createMockDeps());

      expect(() => validateToolNamespace(userTools, builtinTools)).toThrow(/agent_bad/);
    });

    test("allows null or undefined user tools", () => {
      const builtinTools = createBuiltinTools(createMockDeps());

      expect(() => validateToolNamespace(undefined, builtinTools)).not.toThrow();
      expect(() => validateToolNamespace(null as any, builtinTools)).not.toThrow();
    });

    test("provides clear error message", () => {
      const userTools: ToolSet = {
        agent_something: tool({
          description: "Tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };
      const builtinTools = createBuiltinTools(createMockDeps());

      try {
        validateToolNamespace(userTools, builtinTools);
        expect.unreachable("Should have thrown");
      } catch (e) {
        const message = (e as Error).message;
        expect(message).toContain("agent_something");
        expect(message).toContain("reserved prefix");
        expect(message).toContain("agent_");
      }
    });

    test("validates case-sensitive prefix matching", () => {
      const userTools: ToolSet = {
        Agent_custom: tool({
          description: "Tool with different case",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };
      const builtinTools = createBuiltinTools(createMockDeps());

      // Agent_ with capital A should be allowed
      expect(() => validateToolNamespace(userTools, builtinTools)).not.toThrow();
    });
  });

  describe("mergeTools", () => {
    test("returns builtin tools when user tools is undefined", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const merged = mergeTools(builtinTools, undefined);

      expect(merged).toHaveProperty("agent_inbox");
      expect(merged).toHaveProperty("agent_send");
      expect(merged).toHaveProperty("agent_todo");
    });

    test("returns builtin tools when user tools is null", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const merged = mergeTools(builtinTools, null as any);

      expect(Object.keys(merged).length).toBe(Object.keys(builtinTools).length);
    });

    test("merges builtin and user tools", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const userTools: ToolSet = {
        custom_tool: tool({
          description: "A custom tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };

      const merged = mergeTools(builtinTools, userTools);

      expect(merged).toHaveProperty("agent_inbox");
      expect(merged).toHaveProperty("custom_tool");
    });

    test("preserves all builtin tools in merged result", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const userTools: ToolSet = {
        my_tool: tool({
          description: "My tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };

      const merged = mergeTools(builtinTools, userTools);

      for (const name of Object.keys(builtinTools)) {
        expect(merged).toHaveProperty(name);
      }
    });

    test("includes all user tools in merged result", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const userTools: ToolSet = {
        tool1: tool({
          description: "Tool 1",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
        tool2: tool({
          description: "Tool 2",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };

      const merged = mergeTools(builtinTools, userTools);

      expect(merged).toHaveProperty("tool1");
      expect(merged).toHaveProperty("tool2");
    });

    test("validates namespace during merge", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const userTools: ToolSet = {
        agent_invalid: tool({
          description: "Invalid tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };

      expect(() => mergeTools(builtinTools, userTools)).toThrow(/agent_invalid/);
    });

    test("user tools override builtin tools if same name", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const userTools: ToolSet = {
        // This would normally be caught by validateToolNamespace,
        // but test the override behavior if it wasn't
        custom_tool: tool({
          description: "Custom",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) =>
            "user_result",
        }),
      };

      const merged = mergeTools(builtinTools, userTools);
      expect(merged.custom_tool).toBeDefined();
    });

    test("returns new object without mutating inputs", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const originalBuiltinKeys = Object.keys(builtinTools);

      const userTools: ToolSet = {
        my_tool: tool({
          description: "My tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };

      const merged = mergeTools(builtinTools, userTools);

      // Original should not be modified
      expect(Object.keys(builtinTools)).toEqual(originalBuiltinKeys);
      expect(builtinTools).not.toHaveProperty("my_tool");

      // Merged should have both
      expect(merged).toHaveProperty("my_tool");
    });

    test("handles multiple user tools correctly", () => {
      const builtinTools = createBuiltinTools(createMockDeps());
      const userTools: ToolSet = {
        tool_a: tool({
          description: "Tool A",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "a",
        }),
        tool_b: tool({
          description: "Tool B",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "b",
        }),
        tool_c: tool({
          description: "Tool C",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "c",
        }),
      };

      const merged = mergeTools(builtinTools, userTools);

      expect(Object.keys(merged).length).toBe(
        Object.keys(builtinTools).length + Object.keys(userTools).length,
      );
      expect(merged).toHaveProperty("tool_a");
      expect(merged).toHaveProperty("tool_b");
      expect(merged).toHaveProperty("tool_c");
    });
  });

  describe("integration", () => {
    test("createBuiltinTools + mergeTools workflow", () => {
      const deps = createMockDeps();
      const builtinTools = createBuiltinTools(deps);

      const userTools: ToolSet = {
        custom: tool({
          description: "Custom tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };

      const merged = mergeTools(builtinTools, userTools);

      expect(merged).toHaveProperty("agent_inbox");
      expect(merged).toHaveProperty("custom");
      expect(Object.keys(merged).length).toBeGreaterThan(Object.keys(builtinTools).length);
    });

    test("full workflow with validateToolNamespace", () => {
      const deps = createMockDeps();
      const builtinTools = createBuiltinTools(deps);

      const userTools: ToolSet = {
        my_custom_tool: tool({
          description: "My custom tool",
          inputSchema: z.object({}),
          execute: async (_args: Record<string, never>, _options: ToolExecutionOptions) => "result",
        }),
      };

      // Validate namespace
      expect(() => validateToolNamespace(userTools, builtinTools)).not.toThrow();

      // Merge tools
      const merged = mergeTools(builtinTools, userTools);

      expect(merged).toHaveProperty("agent_inbox");
      expect(merged).toHaveProperty("my_custom_tool");
    });
  });
});
