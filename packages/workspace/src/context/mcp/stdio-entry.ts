/**
 * Stdio MCP server entry point for workspace tools.
 *
 * Launched as a subprocess by CLI agents that need stdio-mode MCP
 * (primarily claude-code: --mcp-config doesn't load HTTP in -p mode).
 * Connects back to the daemon HTTP API and proxies every workspace tool
 * call through a single generic dispatch endpoint — `POST
 * /workspaces/:key/tool-call` — so adding a new workspace tool only
 * requires editing `WORKSPACE_TOOL_DEFS` on the daemon side and never
 * this file.
 *
 * Usage: <runtime> stdio-entry.ts <daemon-url> <token> <workspace> <agent>
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WORKSPACE_TOOL_DEFS } from "./server.ts";

const [daemonUrl, token, workspace, agent] = process.argv.slice(2);
if (!daemonUrl || !token || !workspace || !agent) {
  console.error("Usage: stdio-entry.ts <daemon-url> <token> <workspace> <agent>");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

/**
 * Single dispatch path: every tool invocation becomes an HTTP POST to
 * the daemon's `/workspaces/:key/tool-call` endpoint. The daemon
 * materialises the full workspace tool set via `createWorkspaceTools`
 * and calls the requested tool, returning its text response.
 */
async function callViaHttp(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    const res = await fetch(`${daemonUrl}/workspaces/${workspace}/tool-call`, {
      method: "POST",
      headers,
      body: JSON.stringify({ agent, name, args }),
    });
    const data = (await res.json()) as { content?: string; error?: string };
    if (!res.ok) {
      return `Error: ${data.error ?? `HTTP ${res.status}`}`;
    }
    return typeof data.content === "string" ? data.content : String(data.content ?? "");
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Convert a workspace tool def's JSON-schema parameters into a flat
 * z.ZodTypeAny map for the MCP SDK's `server.tool(name, desc, params, handler)`
 * shape. This is the same translation `mcp-server.ts::buildZodParams` does
 * but kept local so stdio-entry doesn't drag in that module's dependencies.
 */
function buildZodParams(
  parameters: Record<string, { type: string; description?: string }>,
  required: Set<string>,
): Record<string, z.ZodTypeAny> {
  const out: Record<string, z.ZodTypeAny> = {};
  for (const [name, def] of Object.entries(parameters)) {
    let schema: z.ZodTypeAny;
    switch (def.type) {
      case "string":
        schema = z.string();
        break;
      case "number":
        schema = z.number();
        break;
      case "boolean":
        schema = z.boolean();
        break;
      case "array":
        schema = z.array(z.unknown());
        break;
      case "object":
        schema = z.record(z.string(), z.unknown());
        break;
      default:
        schema = z.unknown();
    }
    if (def.description) schema = schema.describe(def.description);
    if (!required.has(name)) schema = schema.optional();
    out[name] = schema;
  }
  return out;
}

// Build MCP server and register every tool from WORKSPACE_TOOL_DEFS.
// Every tool routes through the generic /tool-call endpoint — the set
// of tools this stdio subprocess exposes is now always in sync with
// whatever the daemon has wired up via createWorkspaceTools.
const server = new McpServer({ name: `workspace-${agent}`, version: "0.0.1" });

type ToolDef = {
  description: string;
  parameters: Record<string, { type: string; description?: string }>;
  required: readonly string[];
};

const defs = WORKSPACE_TOOL_DEFS as unknown as Record<string, ToolDef>;
for (const [toolName, def] of Object.entries(defs)) {
  const requiredSet = new Set<string>(def.required);
  const params = buildZodParams(def.parameters, requiredSet);
  const handler = async (args: Record<string, unknown>) => {
    const text = await callViaHttp(toolName, args);
    return { content: [{ type: "text" as const, text }] };
  };
  if (Object.keys(params).length > 0) {
    server.tool(toolName, def.description, params, handler);
  } else {
    server.tool(toolName, def.description, handler);
  }
}

// Start stdio transport.
const transport = new StdioServerTransport();
await server.connect(transport);
