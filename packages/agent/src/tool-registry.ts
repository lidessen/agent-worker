/**
 * Single source of truth for built-in agent tool definitions and handlers.
 *
 * Previously the same tool logic was duplicated in four places:
 *   1. toolkit.ts      — AI SDK tool() wrappers
 *   2. mcp-server.ts   — in-process MCP server.tool() calls
 *   3. tool-bridge.ts  — HTTP bridge fetch handlers
 *   4. mcp-server.ts   — proxy entry script string template
 *
 * This module centralises:
 *   - BUILTIN_TOOLS:        metadata (name, description, zod parameters)
 *   - createToolHandlers(): handler factory (string-returning)
 *   - zodParamsToSource():  codegen helper for proxy script
 */
import { z, type ZodTypeAny } from "zod";
import type { Inbox } from "./inbox.ts";
import type { TodoManager } from "./todo.ts";
import type { NotesStorage } from "./types.ts";
import type { MemoryManager } from "./memory.ts";
import type { SendGuard } from "./send.ts";

// ── Deps ────────────────────────────────────────────────────────────────────

export interface ToolHandlerDeps {
  inbox: Inbox;
  todos: TodoManager;
  notes: NotesStorage;
  memory: MemoryManager | null;
  sendGuard: SendGuard;
}

// ── Tool definitions ────────────────────────────────────────────────────────

export interface ToolDef {
  description: string;
  parameters: Record<string, ZodTypeAny>;
}

/**
 * All built-in agent tools. The `agent_memory` entry is always present
 * in the registry; consumers skip it when memory is null.
 */
export const BUILTIN_TOOLS: Record<string, ToolDef> = {
  agent_inbox: {
    description:
      "Interact with the message inbox. Actions: peek (refresh inbox summary), read (get full message by ID), wait (block until new message arrives or timeout).",
    parameters: {
      action: z.enum(["peek", "read", "wait"]),
      id: z.string().optional().describe("Message ID (for read action)"),
      timeoutMs: z.number().optional().describe("Timeout in ms (for wait action)"),
    },
  },
  agent_send: {
    description:
      "Send a message to a target. The guard checks for new unread messages before sending — if new messages arrived, you'll get a warning. Use force=true to send anyway.",
    parameters: {
      target: z.string().describe("Who to send to (e.g. 'user', agent name)"),
      content: z.string().describe("Message content"),
      force: z.boolean().optional().describe("Bypass the new-message guard"),
    },
  },
  agent_todo: {
    description:
      "Manage your working memory (todos). Actions: add (create pending item), complete (mark done by ID), clear (discard all), list (show current state).",
    parameters: {
      action: z.enum(["add", "complete", "clear", "list"]),
      text: z.string().optional().describe("Todo text (for add action)"),
      id: z.string().optional().describe("Todo ID (for complete action)"),
    },
  },
  agent_notes: {
    description:
      "Persistent key-value notes. Actions: write (save a note), read (retrieve by key), list (show all keys), delete (remove a note).",
    parameters: {
      action: z.enum(["write", "read", "list", "delete"]),
      key: z.string().optional().describe("Note key"),
      content: z.string().optional().describe("Note content (for write)"),
    },
  },
  agent_memory: {
    description:
      "Search your memories. Read-only — memories are managed automatically.",
    parameters: {
      query: z.string().describe("Search query"),
      limit: z.number().optional().describe("Max results (default: 10)"),
    },
  },
};

// ── Handler factory ─────────────────────────────────────────────────────────

export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

/**
 * Create handlers for all built-in tools. Each handler returns a string.
 * When `deps.memory` is null, `agent_memory` is omitted from the map.
 */
export function createToolHandlers(deps: ToolHandlerDeps): Record<string, ToolHandler> {
  const { inbox, todos, notes, memory, sendGuard } = deps;

  const handlers: Record<string, ToolHandler> = {
    agent_inbox: async ({ action, id, timeoutMs }) => {
      switch (action) {
        case "peek":
          return inbox.peek();
        case "read": {
          if (!id) return "Error: id required";
          const msg = inbox.read(id as string);
          return msg ? JSON.stringify(msg) : `Error: message ${id} not found`;
        }
        case "wait":
          return JSON.stringify(await inbox.wait(timeoutMs as number | undefined));
        default:
          return "Unknown action";
      }
    },

    agent_send: async ({ target, content, force }) => {
      return JSON.stringify(sendGuard.send(target as string, content as string, force as boolean | undefined));
    },

    agent_todo: async ({ action, text, id }) => {
      switch (action) {
        case "add": {
          if (!text) return "Error: text required";
          return JSON.stringify(todos.add(text as string));
        }
        case "complete": {
          if (!id) return "Error: id required";
          return todos.complete(id as string) ? `Completed ${id}` : `Error: ${id} not found`;
        }
        case "clear":
          todos.clear();
          return "Cleared all todos";
        case "list":
          return JSON.stringify(todos.list());
        default:
          return "Unknown action";
      }
    },

    agent_notes: async ({ action, key, content }) => {
      switch (action) {
        case "write": {
          if (!key || !content) return "Error: key and content required";
          await notes.write(key as string, content as string);
          return `Written: ${key}`;
        }
        case "read": {
          if (!key) return "Error: key required";
          const val = await notes.read(key as string);
          return val !== null ? val : `Error: note "${key}" not found`;
        }
        case "list":
          return JSON.stringify(await notes.list());
        case "delete": {
          if (!key) return "Error: key required";
          await notes.delete(key as string);
          return `Deleted: ${key}`;
        }
        default:
          return "Unknown action";
      }
    },
  };

  if (memory) {
    const mem = memory;
    handlers.agent_memory = async ({ query, limit }) => {
      return JSON.stringify(await mem.search(query as string, limit as number | undefined));
    };
  }

  return handlers;
}

// ── Codegen helpers (for proxy entry script) ────────────────────────────────

/**
 * Serialize a flat record of zod params to source code.
 * Only supports the simple types used by built-in tools.
 */
export function zodParamsToSource(params: Record<string, ZodTypeAny>): string {
  const entries = Object.entries(params).map(([name, schema]) => {
    return `  ${name}: ${zodTypeToSource(schema)},`;
  });
  return `{\n${entries.join("\n")}\n}`;
}

function zodTypeToSource(schema: ZodTypeAny): string {
  const def = schema._def;

  if (def.typeName === "ZodOptional") {
    return `${zodTypeToSource(def.innerType)}.optional()`;
  }
  if (def.typeName === "ZodString") return "z.string()";
  if (def.typeName === "ZodNumber") return "z.number()";
  if (def.typeName === "ZodBoolean") return "z.boolean()";
  if (def.typeName === "ZodEnum") {
    return `z.enum(${JSON.stringify(def.values)})`;
  }

  throw new Error(`zodTypeToSource: unsupported type "${def.typeName}"`);
}
