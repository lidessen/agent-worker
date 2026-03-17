/**
 * HTTP MCP server for workspace tools.
 *
 * Exposes workspace tools (channel_send, channel_read, etc.) over HTTP
 * so CLI agents (claude-code, codex, cursor) can access them via --mcp-config.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server } from "node:http";
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
  private configPath: string | null = null;
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

  get mcpConfigPath(): string | null {
    return this.configPath;
  }

  private registerTools(): void {
    const defs = WORKSPACE_TOOL_DEFS as Record<string, ToolDef>;

    for (const [name, fn] of Object.entries(this.tools)) {
      const def = defs[name];
      if (!def) continue;

      const schema = buildZodSchema(def.parameters, def.required);
      const registered = this.server.tool(name, def.description, async (extra) => {
        const args =
          (extra as { params?: { arguments?: Record<string, unknown> } }).params?.arguments ?? {};
        const text = await (fn as (args: Record<string, unknown>) => Promise<string>)(args);
        return { content: [{ type: "text" as const, text }] };
      });
      (registered as Record<string, unknown>)["inputSchema"] = schema;
    }
  }

  async start(): Promise<string> {
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await this.server.connect(this.transport);

    this.httpServer = createServer((req, res) => {
      this.transport!.handleRequest(req, res);
    });

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once("error", reject);
      this.httpServer!.listen({ host: "127.0.0.1", port: 0 }, () => {
        this.httpServer!.removeListener("error", reject);
        resolve();
      });
    });

    const addr = this.httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("Workspace MCP server: no address");
    this._port = addr.port;

    const url = `http://127.0.0.1:${this._port}/`;

    const configPath = `/tmp/workspace-mcp-${this.agentName}-${Date.now()}.json`;
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          workspace: { type: "http", url },
        },
      }),
      "utf-8",
    );

    this.configPath = configPath;
    return configPath;
  }

  async stop(): Promise<void> {
    try {
      await this.server.close();
    } catch {
      /* may not be connected */
    }

    if (this.httpServer) {
      const server = this.httpServer;
      this.httpServer = null;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    this.transport = null;

    if (this.configPath) {
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(this.configPath);
      } catch {
        /* already removed */
      }
      this.configPath = null;
    }
  }
}

function buildZodSchema(
  params: Record<string, { type: string; description?: string }>,
  required: readonly string[],
): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  const requiredSet = new Set(required);

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
    if (!requiredSet.has(name)) field = field.optional();
    shape[name] = field;
  }

  return z.object(shape);
}
