import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server } from "node:http";
import { z } from "zod";
import {
  BUILTIN_TOOLS,
  createToolHandlers,
  type ToolHandlerDeps,
} from "../tool-registry.ts";

export type AgentMcpServerDeps = ToolHandlerDeps;

/**
 * Register a tool on the MCP server from a ToolDef.
 *
 * Uses the 3-arg tool() overload (no schema in generics) to avoid TS2589,
 * then patches inputSchema on the returned RegisteredTool. The MCP SDK's
 * generic overloads cause excessively deep type instantiation when given
 * Record<string, ZodTypeAny>.
 */
function registerToolForDef(
  server: McpServer,
  name: string,
  def: import("../tool-registry.ts").ToolDef,
  handler: import("../tool-registry.ts").ToolHandler,
): void {
  const registered = server.tool(name, def.description, async (extra) => {
    const args =
      (extra as { params?: { arguments?: Record<string, unknown> } }).params?.arguments ?? {};
    const text = await handler(args);
    return { content: [{ type: "text" as const, text }] };
  });
  // Attach the input schema so MCP clients can discover tool parameters.
  // Assign via bracket notation to avoid TS2589 deep type instantiation
  // that occurs when TypeScript resolves z.ZodTypeAny against AnySchema.
  (registered as Record<string, unknown>)["inputSchema"] = buildObjectSchema(def.parameters);
}

/** Build a ZodObject without triggering TS2589 deep type instantiation. */
function buildObjectSchema(params: Record<string, z.ZodTypeAny>): z.ZodTypeAny {
  // Use ZodObject constructor directly to avoid z.object()'s deep generic inference
  // on Record<string, ZodTypeAny>.
  return new z.ZodObject({
    shape: () => params,
    unknownKeys: "strip",
    catchall: z.never(),
    typeName: "ZodObject",
  });
}

/**
 * MCP server that exposes agent built-in tools to CLI loops via HTTP.
 *
 * Uses Streamable HTTP transport — the MCP server runs in-process and
 * CLI loops connect to it directly via URL. No subprocess, no bridge.
 */
export class AgentMcpServer {
  private server: McpServer;
  private httpServer: Server | null = null;
  private transport: StreamableHTTPServerTransport | null = null;
  private configPath: string | null = null;
  private _port: number | null = null;

  constructor(private deps: AgentMcpServerDeps) {
    this.server = new McpServer({
      name: "agent-worker",
      version: "0.0.1",
    });

    this.registerTools();
  }

  get port(): number | null {
    return this._port;
  }

  private registerTools(): void {
    const handlers = createToolHandlers(this.deps);

    for (const [name, def] of Object.entries(BUILTIN_TOOLS)) {
      if (name === "agent_memory" && !this.deps.memory) continue;
      const handler = handlers[name];
      if (!handler) continue;

      registerToolForDef(this.server, name, def, handler);
    }
  }

  /**
   * Start the MCP server over Streamable HTTP and write a config file.
   *
   * Returns the config path for `--mcp-config`.
   */
  async startHttp(): Promise<string> {
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
    });

    await this.server.connect(this.transport);

    // Start HTTP server
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
    if (!addr || typeof addr === "string") throw new Error("MCP HTTP server: no address");
    this._port = addr.port;

    const url = `http://127.0.0.1:${this._port}/`;

    // Write MCP config for CLI
    const configPath = `/tmp/agent-mcp-config-${Date.now()}.json`;
    const { writeFile } = await import("node:fs/promises");
    await writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "agent-worker": { type: "http", url },
        },
      }),
      "utf-8",
    );

    this.configPath = configPath;
    return configPath;
  }

  /** Stop the server and clean up temp files */
  async stop(): Promise<void> {
    try {
      await this.server.close();
    } catch {
      /* may not be connected */
    }

    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    this.transport = null;
    this._port = null;

    if (this.configPath) {
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(this.configPath);
      } catch {
        /* ignore */
      }
      this.configPath = null;
    }
  }

  /** Get the MCP server instance for direct tool registration testing */
  get mcpServerInstance(): McpServer {
    return this.server;
  }
}
