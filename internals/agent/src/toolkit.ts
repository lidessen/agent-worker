import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { BUILTIN_TOOLS, createToolHandlers, type ToolHandlerDeps } from "./tool-registry.ts";

const RESERVED_PREFIX = "agent_";

/**
 * Build the set of built-in agent tools (AI SDK tool format).
 *
 * Wraps the unified handlers from tool-registry in AI SDK tool() calls.
 */
export function createBuiltinTools(deps: ToolHandlerDeps): ToolSet {
  const handlers = createToolHandlers(deps);
  const tools: ToolSet = {};

  for (const [name, def] of Object.entries(BUILTIN_TOOLS)) {
    if (name === "agent_memory" && !deps.memory) continue;
    const handler = handlers[name];
    if (!handler) continue;

    tools[name] = tool({
      description: def.description,
      inputSchema: z.object(def.parameters),
      execute: async (args) => handler(args),
    });
  }

  return tools;
}

/**
 * Validate that no user/MCP tools collide with reserved agent_* prefix.
 * Throws if collision detected.
 */
export function validateToolNamespace(
  userTools: ToolSet | undefined,
  _builtinTools: ToolSet,
): void {
  if (!userTools) return;
  for (const name of Object.keys(userTools)) {
    if (name.startsWith(RESERVED_PREFIX)) {
      throw new Error(
        `Tool name "${name}" uses reserved prefix "${RESERVED_PREFIX}". ` +
          `Built-in agent tools cannot be overridden. ` +
          `Use a different prefix for your tools.`,
      );
    }
  }
}

/**
 * Merge all tool sources: builtins + user tools.
 */
export function mergeTools(builtinTools: ToolSet, userTools?: ToolSet): ToolSet {
  validateToolNamespace(userTools, builtinTools);
  return { ...builtinTools, ...userTools };
}
