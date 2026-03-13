import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  BUILTIN_TOOLS,
  createToolHandlers,
  zodParamsToSource,
  type ToolHandlerDeps,
} from "../tool-registry.ts";
import type { BridgeTransport } from "./tool-bridge.ts";

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
 * MCP server that exposes agent built-in tools to CLI loops.
 *
 * Two modes:
 *
 * 1. In-process (startStdio): registerTools() binds directly to deps.
 *    Used for testing or when the MCP server runs in the same process.
 *
 * 2. CLI bridge (startAndWriteConfig): generates a proxy entry script
 *    that forwards every tool call to the agent's ToolBridge HTTP server.
 *    The CLI loop spawns this script as a subprocess. Because tool calls
 *    go through the bridge, side-effects (todos, notes, inbox reads,
 *    sends) hit the real agent subsystems — not a disconnected copy.
 */
export class AgentMcpServer {
  private server: McpServer;
  private configPath: string | null = null;
  private entryPath: string | null = null;

  constructor(private deps: AgentMcpServerDeps) {
    this.server = new McpServer({
      name: "agent-worker",
      version: "0.0.1",
    });

    this.registerTools();
  }

  private registerTools(): void {
    const handlers = createToolHandlers(this.deps);

    for (const [name, def] of Object.entries(BUILTIN_TOOLS)) {
      if (name === "agent_memory" && !this.deps.memory) continue;
      const handler = handlers[name];
      if (!handler) continue;

      // Register each tool individually. We call registerTool via a helper
      // function to prevent TS2589 from deeply resolving the generic params
      // against Record<string, ZodTypeAny>.
      registerToolForDef(this.server, name, def, handler);
    }
  }

  /**
   * Start the MCP server using stdio transport (connects to process stdin/stdout).
   * Used when this code runs as the MCP subprocess entry point.
   */
  async startStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Write the MCP proxy entry script and config to /tmp, returning the config path.
   *
   * The entry script is a thin proxy: every tool call does a fetch() to the
   * agent's ToolBridge HTTP server. This ensures the subprocess doesn't maintain
   * its own state — all side-effects flow through the real agent subsystems.
   *
   * @param transport - How to reach the agent's ToolBridge server (unix socket or tcp)
   * @param hasMemory - Whether the agent has memory configured (adds agent_memory tool)
   * @param includeBuiltins - Whether to include built-in agent tools. When false,
   *        the entry script is a minimal MCP server with no tools. The bridge
   *        transport still exists (transport != tools).
   */
  async startAndWriteConfig(
    transport: BridgeTransport,
    hasMemory: boolean,
    includeBuiltins = true,
  ): Promise<string> {
    const timestamp = Date.now();
    const entryPath = `/tmp/agent-mcp-entry-${timestamp}.ts`;
    const configPath = `/tmp/agent-mcp-config-${timestamp}.json`;

    const entryScript = includeBuiltins
      ? this.buildProxyScript(transport, hasMemory)
      : this.buildMinimalScript();

    const { writeFile } = await import("node:fs/promises");
    await writeFile(entryPath, entryScript, "utf-8");

    // Write MCP config for CLI
    await writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "agent-worker": {
            command: "npx",
            args: ["tsx", entryPath],
          },
        },
      }),
      "utf-8",
    );

    this.configPath = configPath;
    this.entryPath = entryPath;
    return configPath;
  }

  /** Stop the server and clean up temp files */
  async stop(): Promise<void> {
    try {
      await this.server.close();
    } catch {
      /* may not be connected */
    }

    // Clean up temp files
    const { unlink } = await import("node:fs/promises");
    if (this.configPath) {
      try {
        await unlink(this.configPath);
      } catch {
        /* ignore */
      }
      this.configPath = null;
    }
    if (this.entryPath) {
      try {
        await unlink(this.entryPath);
      } catch {
        /* ignore */
      }
      this.entryPath = null;
    }
  }

  /** Get the MCP server instance for direct tool registration testing */
  get mcpServerInstance(): McpServer {
    return this.server;
  }

  // ── Entry script generators ───────────────────────────────────────────

  /** Full proxy script with all built-in tools routed through the bridge. */
  private buildProxyScript(transport: BridgeTransport, hasMemory: boolean): string {
    // Generate the correct fetch call based on transport type
    const fetchBlock =
      transport.type === "unix"
        ? `import { request as httpRequest } from "node:http";

const BRIDGE_SOCKET = "${transport.socketPath}";

async function callBridge(tool: string, args: Record<string, unknown>): Promise<string> {
  const body = JSON.stringify(args);
  return new Promise<string>((resolve, reject) => {
    const req = httpRequest({
      socketPath: BRIDGE_SOCKET,
      path: \`/\${tool}\`,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        const data = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { result?: string; error?: string };
        if (data.error) reject(new Error(data.error));
        else resolve(data.result ?? "");
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}`
        : `const BRIDGE_URL = "http://${transport.host}:${transport.port}";

async function callBridge(tool: string, args: Record<string, unknown>): Promise<string> {
  const res = await fetch(\`\${BRIDGE_URL}/\${tool}\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json() as { result?: string; error?: string };
  if (data.error) throw new Error(data.error);
  return data.result ?? "";
}`;

    // Generate tool registration blocks from the registry
    const toolBlocks = Object.entries(BUILTIN_TOOLS)
      .filter(([name]) => name !== "agent_memory" || hasMemory)
      .map(([name, def]) => {
        const paramsSource = zodParamsToSource(def.parameters);
        return `server.tool(${JSON.stringify(name)}, ${JSON.stringify(def.description)}, ${paramsSource}, async (args) => {
  const text = await callBridge(${JSON.stringify(name)}, args);
  return { content: [{ type: "text", text }] };
});`;
      })
      .join("\n\n");

    return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

${fetchBlock}

const server = new McpServer({ name: "agent-worker", version: "0.0.1" });

${toolBlocks}

const transport = new StdioServerTransport();
await server.connect(transport);
`;
  }

  /** Minimal MCP server with no tools — bridge transport exists but no builtins exposed. */
  private buildMinimalScript(): string {
    return `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({ name: "agent-worker", version: "0.0.1" });

const transport = new StdioServerTransport();
await server.connect(transport);
`;
  }
}
