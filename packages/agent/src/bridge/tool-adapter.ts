import type { ToolSet } from "ai";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z, type ZodTypeAny } from "zod";
import { BUILTIN_TOOLS, createToolHandlers, type ToolHandlerDeps } from "../tool-registry.ts";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, ZodTypeAny>;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

export function createMcpToolDefinitions(args: {
  deps: ToolHandlerDeps;
  includeBuiltins: boolean;
  userTools?: ToolSet;
}): McpToolDefinition[] {
  const defs: McpToolDefinition[] = [];

  if (args.includeBuiltins) {
    const handlers = createToolHandlers(args.deps);

    for (const [name, def] of Object.entries(BUILTIN_TOOLS)) {
      if (name === "agent_memory" && !args.deps.memory) continue;
      const handler = handlers[name];
      if (!handler) continue;

      defs.push({
        name,
        description: def.description,
        inputSchema: def.parameters,
        handler: async (toolArgs) => ({
          content: [{ type: "text", text: await handler(toolArgs) }],
        }),
      });
    }
  }

  for (const [name, toolDef] of Object.entries(args.userTools ?? {})) {
    defs.push({
      name,
      description: getToolDescription(toolDef),
      inputSchema: getToolInputSchema(toolDef),
      handler: async (toolArgs) => normalizeToolResult(await runTool(toolDef, toolArgs)),
    });
  }

  return defs;
}

function getToolDescription(toolDef: unknown): string {
  const description = (toolDef as { description?: unknown })?.description;
  return typeof description === "string" && description.trim() ? description : "User-defined tool";
}

function getToolInputSchema(toolDef: unknown): Record<string, ZodTypeAny> {
  const schema = (toolDef as { inputSchema?: unknown })?.inputSchema;
  if (!schema) return {};

  if (isZodObject(schema)) {
    return getZodObjectShape(schema);
  }

  if (isZodTypeRecord(schema)) {
    return schema;
  }

  return {};
}

function isZodObject(value: unknown): value is z.ZodObject<any> {
  return value instanceof z.ZodObject;
}

function isZodTypeRecord(value: unknown): value is Record<string, ZodTypeAny> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => entry instanceof z.ZodType);
}

function getZodObjectShape(schema: z.ZodObject<any>): Record<string, ZodTypeAny> {
  const shape = (schema as unknown as { shape?: unknown }).shape;
  if (typeof shape === "function") {
    return (shape as () => Record<string, ZodTypeAny>)();
  }
  if (shape && typeof shape === "object") {
    return shape as Record<string, ZodTypeAny>;
  }
  return {};
}

async function runTool(toolDef: unknown, args: Record<string, unknown>): Promise<unknown> {
  const execute = (toolDef as { execute?: unknown })?.execute;
  if (typeof execute !== "function") {
    throw new Error("Tool is missing execute()");
  }
  return execute(args);
}

function normalizeToolResult(result: unknown): CallToolResult {
  if (isCallToolResult(result)) {
    return result;
  }

  if (typeof result === "string") {
    return { content: [{ type: "text", text: result }] };
  }

  return {
    content: [
      {
        type: "text",
        text: typeof result === "undefined" ? "null" : JSON.stringify(result),
      },
    ],
  };
}

function isCallToolResult(value: unknown): value is CallToolResult {
  const content = (value as { content?: unknown })?.content;
  return Array.isArray(content);
}
