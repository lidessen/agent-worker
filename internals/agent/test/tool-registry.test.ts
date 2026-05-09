import { test, expect, describe, mock } from "bun:test";
import { z } from "zod";
import { createToolHandlers, zodParamsToSource, BUILTIN_TOOLS } from "../src/tool-registry.ts";
import type { ToolHandlerDeps } from "../src/tool-registry.ts";
import { Inbox } from "../src/inbox.ts";
import { TodoManager } from "../src/todo.ts";
import { InMemoryNotesStorage } from "../src/notes.ts";
import { SendGuard } from "../src/send.ts";
import { ReminderManager } from "../src/reminder.ts";

describe("tool-registry", () => {
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

  describe("createToolHandlers", () => {
    test("creates all expected tool handlers", () => {
      const deps = createMockDeps();
      const handlers = createToolHandlers(deps);

      expect(handlers.agent_inbox).toBeDefined();
      expect(handlers.agent_send).toBeDefined();
      expect(handlers.agent_todo).toBeDefined();
      expect(handlers.agent_notes).toBeDefined();
      expect(handlers.agent_reminder).toBeDefined();
      expect(handlers.agent_memory).toBeUndefined(); // memory is null
    });

    test("creates agent_memory handler when memory is provided", () => {
      // Create a mock memory manager
      const mockMemory = {
        search: mock(async () => []),
      };
      const deps = createMockDeps({ memory: mockMemory as any });
      const handlers = createToolHandlers(deps);

      expect(handlers.agent_memory).toBeDefined();
    });

    describe("agent_inbox handler", () => {
      test("peek action returns inbox summary", async () => {
        const inbox = new Inbox({}, () => {});
        inbox.push("test message");
        const deps = createMockDeps({ inbox });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_inbox!({ action: "peek" });
        expect(result).toContain("test message");
      });

      test("read action returns message JSON", async () => {
        const inbox = new Inbox({}, () => {});
        const msg = inbox.push("hello");
        const deps = createMockDeps({ inbox });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_inbox!({ action: "read", id: msg.id });
        const parsed = JSON.parse(result);
        expect(parsed.content).toBe("hello");
        expect(parsed.status).toBe("read");
      });

      test("read action returns error for missing id", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_inbox!({ action: "read" });
        expect(result).toContain("Error: id required");
      });

      test("read action returns error for non-existent message", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_inbox!({ action: "read", id: "nonexistent" });
        expect(result).toContain("Error");
      });

      test("wait action sets reminder and returns status", async () => {
        const reminders = new ReminderManager();
        const deps = createMockDeps({ reminders });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_inbox!({ action: "wait", timeoutMs: 5000 });
        const parsed = JSON.parse(result);
        expect(parsed.status).toBe("reminder_set");
        expect(parsed.reminderId).toBeDefined();
        expect(reminders.hasPending).toBe(true);
      });
    });

    describe("agent_send handler", () => {
      test("sends message via sendGuard", async () => {
        const sendGuard = new SendGuard(new Inbox({}, () => {}), () => {});
        const mockSend = mock(() => ({ sent: true }));
        sendGuard.send = mockSend;

        const deps = createMockDeps({ sendGuard });
        const handlers = createToolHandlers(deps);

        await handlers.agent_send!({ target: "user", content: "hello" });
        expect(mockSend).toHaveBeenCalledWith("user", "hello", undefined);
      });

      test("passes force parameter to sendGuard", async () => {
        const sendGuard = new SendGuard(new Inbox({}, () => {}), () => {});
        const mockSend = mock(() => ({ sent: true }));
        sendGuard.send = mockSend;

        const deps = createMockDeps({ sendGuard });
        const handlers = createToolHandlers(deps);

        await handlers.agent_send!({ target: "user", content: "hello", force: true });
        expect(mockSend).toHaveBeenCalledWith("user", "hello", true);
      });
    });

    describe("agent_todo handler", () => {
      test("add action creates todo", async () => {
        const todos = new TodoManager();
        const deps = createMockDeps({ todos });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_todo!({ action: "add", text: "test todo" });
        const parsed = JSON.parse(result);
        expect(parsed.text).toBe("test todo");
        expect(parsed.status).toBe("pending");
      });

      test("add action returns error without text", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_todo!({ action: "add" });
        expect(result).toContain("Error: text required");
      });

      test("complete action marks todo done", async () => {
        const todos = new TodoManager();
        const item = todos.add("test");
        const deps = createMockDeps({ todos });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_todo!({ action: "complete", id: item.id });
        expect(result).toContain("Completed");
      });

      test("complete action returns error for non-existent todo", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_todo!({ action: "complete", id: "nonexistent" });
        expect(result).toContain("Error");
      });

      test("list action returns todos array", async () => {
        const todos = new TodoManager();
        todos.add("test1");
        todos.add("test2");
        const deps = createMockDeps({ todos });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_todo!({ action: "list" });
        const parsed = JSON.parse(result);
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(2);
      });

      test("clear action clears all todos", async () => {
        const todos = new TodoManager();
        todos.add("test1");
        todos.add("test2");
        const deps = createMockDeps({ todos });
        const handlers = createToolHandlers(deps);

        await handlers.agent_todo!({ action: "clear" });
        expect(todos.list()).toHaveLength(0);
      });
    });

    describe("agent_notes handler", () => {
      test("write action saves note", async () => {
        const notes = new InMemoryNotesStorage();
        const deps = createMockDeps({ notes });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_notes!({
          action: "write",
          key: "test",
          content: "hello",
        });
        expect(result).toContain("Written: test");
        expect(await notes.read("test")).toBe("hello");
      });

      test("write action requires both key and content", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_notes!({ action: "write", key: "test" });
        expect(result).toContain("Error: key and content required");
      });

      test("read action retrieves note", async () => {
        const notes = new InMemoryNotesStorage();
        await notes.write("test", "hello");
        const deps = createMockDeps({ notes });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_notes!({ action: "read", key: "test" });
        expect(result).toBe("hello");
      });

      test("read action returns error for missing note", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_notes!({ action: "read", key: "nonexistent" });
        expect(result).toContain("Error");
      });

      test("list action returns all note keys", async () => {
        const notes = new InMemoryNotesStorage();
        await notes.write("key1", "value1");
        await notes.write("key2", "value2");
        const deps = createMockDeps({ notes });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_notes!({ action: "list" });
        const parsed = JSON.parse(result);
        expect(parsed).toContain("key1");
        expect(parsed).toContain("key2");
      });

      test("delete action removes note", async () => {
        const notes = new InMemoryNotesStorage();
        await notes.write("test", "hello");
        const deps = createMockDeps({ notes });
        const handlers = createToolHandlers(deps);

        await handlers.agent_notes!({ action: "delete", key: "test" });
        expect(await notes.read("test")).toBeNull();
      });
    });

    describe("agent_reminder handler", () => {
      test("set action creates reminder", async () => {
        const reminders = new ReminderManager();
        const deps = createMockDeps({ reminders });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_reminder!({ action: "set", label: "test" });
        const parsed = JSON.parse(result);
        expect(parsed.status).toBe("reminder_set");
        expect(parsed.reminderId).toBeDefined();
        expect(parsed.label).toBe("test");
      });

      test("set action requires label", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_reminder!({ action: "set" });
        expect(result).toContain("Error: label required");
      });

      test("list action returns pending reminders", async () => {
        const reminders = new ReminderManager();
        reminders.add("test1", { timeoutMs: 5000 });
        const deps = createMockDeps({ reminders });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_reminder!({ action: "list" });
        expect(result).toContain("test1");
      });

      test("cancel action removes reminder", async () => {
        const reminders = new ReminderManager();
        const { id } = reminders.add("test", { timeoutMs: 5000 });
        const deps = createMockDeps({ reminders });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_reminder!({ action: "cancel", id });
        expect(result).toContain("Cancelled");
        expect(reminders.hasPending).toBe(false);
      });

      test("cancel action returns error for non-existent reminder", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_reminder!({ action: "cancel", id: "nonexistent" });
        expect(result).toContain("Error");
      });
    });

    describe("agent_memory handler", () => {
      test("creates memory handler when memory is provided", async () => {
        const mockSearch = mock(async (_query: string, _limit?: number) => [
          { content: "result", score: 0.9 },
        ]);
        const mockMemory = { search: mockSearch };
        const deps = createMockDeps({ memory: mockMemory as any });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_memory!({ query: "test" });
        const parsed = JSON.parse(result);
        expect(mockSearch).toHaveBeenCalledWith("test", undefined);
        expect(Array.isArray(parsed)).toBe(true);
      });

      test("passes limit to memory search", async () => {
        const mockSearch = mock(async () => []);
        const deps = createMockDeps({ memory: { search: mockSearch } as any });
        const handlers = createToolHandlers(deps);

        await handlers.agent_memory!({ query: "test", limit: 5 });
        expect(mockSearch).toHaveBeenCalledWith("test", 5);
      });
    });

    describe("unknown action handling", () => {
      test("agent_inbox returns unknown for invalid action", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_inbox!({ action: "invalid" });
        expect(result).toBe("Unknown action");
      });

      test("agent_todo returns unknown for invalid action", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_todo!({ action: "invalid" });
        expect(result).toBe("Unknown action");
      });

      test("agent_notes returns unknown for invalid action", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_notes!({ action: "invalid" });
        expect(result).toBe("Unknown action");
      });

      test("agent_reminder returns unknown for invalid action", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_reminder!({ action: "invalid" });
        expect(result).toBe("Unknown action");
      });
    });

    describe("missing required params", () => {
      test("agent_todo complete without id returns error", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_todo!({ action: "complete" });
        expect(result).toContain("Error: id required");
      });

      test("agent_notes read without key returns error", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_notes!({ action: "read" });
        expect(result).toContain("Error: key required");
      });

      test("agent_notes delete without key returns error", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_notes!({ action: "delete" });
        expect(result).toContain("Error: key required");
      });

      test("agent_notes write without content returns error", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_notes!({ action: "write", key: "test" });
        expect(result).toContain("Error: key and content required");
      });

      test("agent_reminder cancel without id returns error", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_reminder!({ action: "cancel" });
        expect(result).toContain("Error: id required");
      });

      test("agent_reminder list with no pending returns message", async () => {
        const deps = createMockDeps();
        const handlers = createToolHandlers(deps);
        const result = await handlers.agent_reminder!({ action: "list" });
        expect(result).toBe("No pending reminders.");
      });

      test("agent_inbox wait without timeout creates reminder without timeout", async () => {
        const reminders = new ReminderManager();
        const deps = createMockDeps({ reminders });
        const handlers = createToolHandlers(deps);

        const result = await handlers.agent_inbox!({ action: "wait" });
        const parsed = JSON.parse(result);
        expect(parsed.status).toBe("reminder_set");
        expect(parsed.message).not.toContain("after");
        reminders.cancelAll();
      });
    });
  });

  describe("zodParamsToSource", () => {
    test("converts simple parameters to source code", () => {
      const params = {
        action: z.enum(["peek", "read"]),
        id: z.string().optional(),
        count: z.number().optional(),
      };

      const source = zodParamsToSource(params);
      expect(source).toContain('action: z.enum(["peek","read"])');
      expect(source).toContain("id: z.string().optional()");
      expect(source).toContain("count: z.number().optional()");
    });

    test("formats output with proper indentation", () => {
      const params = {
        name: z.string(),
      };

      const source = zodParamsToSource(params);
      expect(source).toContain("{\n");
      expect(source).toContain("\n}");
      expect(source).toContain("  name:");
    });

    test("handles boolean parameters", () => {
      const params = {
        enabled: z.boolean().optional(),
      };

      const source = zodParamsToSource(params);
      expect(source).toContain("z.boolean()");
    });

    test("handles number parameters", () => {
      const params = {
        timeout: z.number(),
      };

      const source = zodParamsToSource(params);
      expect(source).toContain("z.number()");
    });

    test("handles string parameters", () => {
      const params = {
        message: z.string(),
      };

      const source = zodParamsToSource(params);
      expect(source).toContain("z.string()");
    });

    test("handles complex enum types", () => {
      const params = {
        action: z.enum(["add", "remove", "update", "delete"]),
      };

      const source = zodParamsToSource(params);
      expect(source).toContain("add");
      expect(source).toContain("remove");
      expect(source).toContain("update");
      expect(source).toContain("delete");
    });

    test("handles multiple parameter types together", () => {
      const params = {
        action: z.enum(["save", "delete"]),
        key: z.string(),
        content: z.string().optional(),
        priority: z.number().optional(),
        force: z.boolean().optional(),
      };

      const source = zodParamsToSource(params);
      expect(source).toContain("action:");
      expect(source).toContain("key:");
      expect(source).toContain("content:");
      expect(source).toContain("priority:");
      expect(source).toContain("force:");
    });
  });

  describe("BUILTIN_TOOLS", () => {
    test("contains all expected tool definitions", () => {
      expect(BUILTIN_TOOLS.agent_inbox).toBeDefined();
      expect(BUILTIN_TOOLS.agent_send).toBeDefined();
      expect(BUILTIN_TOOLS.agent_todo).toBeDefined();
      expect(BUILTIN_TOOLS.agent_notes).toBeDefined();
      expect(BUILTIN_TOOLS.agent_reminder).toBeDefined();
      expect(BUILTIN_TOOLS.agent_memory).toBeDefined();
    });

    test("each tool has description and parameters", () => {
      for (const [, def] of Object.entries(BUILTIN_TOOLS)) {
        expect(def.description).toBeDefined();
        expect(typeof def.description).toBe("string");
        expect(def.description.length).toBeGreaterThan(0);
        expect(def.parameters).toBeDefined();
        expect(typeof def.parameters).toBe("object");
      }
    });

    test("agent_inbox has correct parameters", () => {
      const def = BUILTIN_TOOLS.agent_inbox!;
      expect(def.parameters.action).toBeDefined();
      expect(def.parameters.id).toBeDefined();
      expect(def.parameters.timeoutMs).toBeDefined();
    });

    test("agent_send has correct parameters", () => {
      const def = BUILTIN_TOOLS.agent_send!;
      expect(def.parameters.target).toBeDefined();
      expect(def.parameters.content).toBeDefined();
      expect(def.parameters.force).toBeDefined();
    });

    test("agent_memory has correct parameters", () => {
      const def = BUILTIN_TOOLS.agent_memory!;
      expect(def.parameters.query).toBeDefined();
      expect(def.parameters.limit).toBeDefined();
    });
  });
});
