/**
 * Workspace MCP server + config generator for CLI agents.
 *
 * Starts an HTTP MCP server exposing workspace tools, then generates
 * config files for each CLI agent type:
 * - claude-code: stdio subprocess (--mcp-config doesn't load HTTP in -p mode)
 * - codex/cursor: HTTP URL (both support HTTP MCP servers)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { z } from "zod";
import type { WorkspaceToolSet } from "./server.ts";
import { WORKSPACE_TOOL_DEFS } from "./server.ts";

type ToolDef = {
  description: string;
  parameters: Record<string, { type: string; description?: string }>;
  required: readonly string[];
};

export class WorkspaceMcpServer {
  private server: McpServer;
  private httpServer: Server | null = null;
  private transport: StreamableHTTPServerTransport | null = null;
  private _port: number | null = null;

  constructor(
    private agentName: string,
    private tools: WorkspaceToolSet,
  ) {
    this.server = new McpServer({
      name: `workspace-${agentName}`,
      version: "0.0.1",
    });
    this.registerTools();
  }

  get port(): number | null {
    return this._port;
  }

  get url(): string | null {
    return this._port ? `http://127.0.0.1:${this._port}/` : null;
  }

  private registerTools(): void {
    const defs = WORKSPACE_TOOL_DEFS as Record<string, ToolDef>;
    for (const [name, fn] of Object.entries(this.tools)) {
      const def = defs[name];
      if (!def) continue;
      const params = buildZodParams(def.parameters);
      const handler = async (args: Record<string, unknown>) => {
        const text = await (fn as (a: Record<string, unknown>) => Promise<string>)(args);
        return { content: [{ type: "text" as const, text }] };
      };
      if (Object.keys(params).length > 0) {
        this.server.tool(name, def.description, params, handler);
      } else {
        this.server.tool(name, def.description, handler);
      }
    }
  }

  async start(): Promise<void> {
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });
    await this.server.connect(this.transport);

    this.httpServer = createServer((req, res) => {
      this.transport!.handleRequest(req, res).catch((err) => {
        console.error(`[workspace-mcp:${this.agentName}] error:`, err?.message ?? err);
        if (!res.headersSent) res.writeHead(500).end();
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once("error", reject);
      this.httpServer!.listen({ host: "127.0.0.1", port: 0 }, () => {
        this.httpServer!.removeListener("error", reject);
        resolve();
      });
    });

    const addr = this.httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("Workspace MCP: no address");
    this._port = addr.port;
  }

  async stop(): Promise<void> {
    try {
      await this.server.close();
    } catch {
      /* may not be connected */
    }
    if (this.httpServer) {
      const s = this.httpServer;
      this.httpServer = null;
      await new Promise<void>((r) => s.close(() => r()));
    }
    this.transport = null;
  }
}

/**
 * Create an MCP config file for a CLI agent.
 *
 * - claude-code: stdio config (spawns bun subprocess proxying through daemon API)
 * - codex/cursor: HTTP config (points to a running WorkspaceMcpServer)
 */
export async function createWorkspaceMcpConfig(
  agentName: string,
  runtime: string,
  opts: {
    /** For HTTP mode (codex/cursor): URL of the running WorkspaceMcpServer */
    httpUrl?: string;
    /** For stdio mode (claude-code): daemon URL for the stdio proxy */
    daemonUrl?: string;
    /** For stdio mode: daemon auth token */
    daemonToken?: string;
    /** Workspace key */
    workspaceKey?: string;
  },
): Promise<{ configPath: string; cleanup: () => Promise<void> }> {
  const { writeFile, unlink } = await import("node:fs/promises");
  const configPath = `/tmp/workspace-mcp-${agentName}-${Date.now()}.json`;

  let config: Record<string, unknown>;

  if (runtime === "claude-code") {
    // Claude Code: stdio subprocess (--mcp-config doesn't load HTTP in -p mode)
    const entryPath = join(dirname(fileURLToPath(import.meta.url)), "stdio-entry.ts");
    config = {
      mcpServers: {
        workspace: {
          command: "bun",
          args: [
            "run",
            entryPath,
            opts.daemonUrl ?? "",
            opts.daemonToken ?? "",
            opts.workspaceKey ?? "global",
            agentName,
          ],
        },
      },
    };
  } else {
    // Codex/Cursor: HTTP URL
    config = {
      mcpServers: {
        workspace: { type: "http", url: opts.httpUrl ?? "" },
      },
    };
  }

  await writeFile(configPath, JSON.stringify(config), "utf-8");

  return {
    configPath,
    async cleanup() {
      try {
        await unlink(configPath);
      } catch {
        /* already removed */
      }
    },
  };
}

function buildZodParams(
  params: Record<string, { type: string; description?: string }>,
): Record<string, z.ZodTypeAny> {
  const result: Record<string, z.ZodTypeAny> = {};
  for (const [name, param] of Object.entries(params)) {
    let field: z.ZodTypeAny;
    switch (param.type) {
      case "number":
        field = z.number();
        break;
      case "boolean":
        field = z.boolean();
        break;
      default:
        field = z.string();
    }
    if (param.description) field = field.describe(param.description);
    result[name] = field;
  }
  return result;
}
