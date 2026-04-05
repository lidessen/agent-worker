import { describe, expect, test } from "bun:test";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { createMcpToolDefinitions } from "../../src/bridge/tool-adapter.ts";
import { Inbox } from "../../src/inbox.ts";
import { TodoManager } from "../../src/todo.ts";
import { InMemoryNotesStorage } from "../../src/notes.ts";
import { SendGuard } from "../../src/send.ts";
import { ReminderManager } from "../../src/reminder.ts";

function createDeps() {
  const inbox = new Inbox({}, () => {});
  return {
    inbox,
    todos: new TodoManager(),
    notes: new InMemoryNotesStorage(),
    memory: null,
    sendGuard: new SendGuard(inbox, () => {}),
    reminders: new ReminderManager(),
  };
}

describe("createMcpToolDefinitions", () => {
  test("includes builtin tools when enabled", () => {
    const tools = createMcpToolDefinitions({
      deps: createDeps(),
      includeBuiltins: true,
    });

    expect(tools.some((tool) => tool.name === "agent_inbox")).toBe(true);
  });

  test("adapts AI SDK user tools into MCP handlers", async () => {
    const userTools: ToolSet = {
      custom_echo: tool({
        description: "Echo input",
        inputSchema: z.object({
          text: z.string(),
        }),
        execute: async ({ text }) => ({ echoed: text }),
      }),
    };

    const tools = createMcpToolDefinitions({
      deps: createDeps(),
      includeBuiltins: false,
      userTools,
    });

    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("custom_echo");
    expect(tools[0]?.description).toBe("Echo input");
    expect(Object.keys(tools[0]?.inputSchema ?? {})).toEqual(["text"]);

    await expect(tools[0]!.handler({ text: "hello" })).resolves.toEqual({
      content: [{ type: "text", text: '{"echoed":"hello"}' }],
    });
  });
});
