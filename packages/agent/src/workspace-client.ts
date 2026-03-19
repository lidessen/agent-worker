/**
 * Workspace MCP Client — connects an agent to a workspace MCP server.
 *
 * Provides a typed interface over the MCP client for calling workspace
 * tools (channels, inbox, documents, resources, status).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface WorkspaceClientOptions {
  /** Agent name — used to build the MCP endpoint path. */
  agentName: string;
  /** Base URL of the workspace MCP server (e.g. "http://127.0.0.1:3100"). */
  workspaceUrl: string;
}

/**
 * MCP client that connects to a workspace server and provides access
 * to workspace collaboration tools.
 *
 * The agent identifies itself via the URL path — connecting to
 * `{workspaceUrl}/mcp/{agentName}`. The workspace server auto-registers
 * the agent on first connection.
 *
 * Usage:
 * ```ts
 * const client = new WorkspaceClient({ agentName: "designer", workspaceUrl: "http://localhost:3100" });
 * await client.connect();
 * const tools = await client.listTools();
 * const result = await client.callTool("channel_send", { channel: "general", content: "hello" });
 * await client.disconnect();
 * ```
 */
export class WorkspaceClient {
  readonly agentName: string;
  readonly workspaceUrl: string;

  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private _connected = false;

  constructor(opts: WorkspaceClientOptions) {
    this.agentName = opts.agentName;
    this.workspaceUrl = opts.workspaceUrl;

    const mcpUrl = new URL(`/mcp/${encodeURIComponent(opts.agentName)}`, opts.workspaceUrl);
    this.transport = new StreamableHTTPClientTransport(mcpUrl);
    this.client = new Client({
      name: `agent-${opts.agentName}`,
      version: "0.0.1",
    });
  }

  get connected(): boolean {
    return this._connected;
  }

  /** The full MCP endpoint URL this client connects to. */
  get mcpUrl(): string {
    return new URL(`/mcp/${encodeURIComponent(this.agentName)}`, this.workspaceUrl).toString();
  }

  /** Connect to the workspace MCP server. */
  async connect(): Promise<void> {
    await this.client.connect(this.transport);
    this._connected = true;
  }

  /** List all available workspace tools. */
  async listTools(): Promise<{ tools: Array<{ name: string; description?: string }> }> {
    const result = await this.client.listTools();
    return {
      tools: result.tools.map((t) => ({ name: t.name, description: t.description })),
    };
  }

  /** Call a workspace tool by name. Returns the text content of the result. */
  async callTool(name: string, args?: Record<string, unknown>): Promise<string> {
    const result = await this.client.callTool({ name, arguments: args ?? {} });
    // Extract text from MCP tool result content
    const texts: string[] = [];
    if (result.content && Array.isArray(result.content)) {
      for (const item of result.content) {
        if (typeof item === "object" && item !== null && "text" in item) {
          texts.push(String(item.text));
        }
      }
    }
    return texts.join("\n");
  }

  /** Disconnect from the workspace MCP server. */
  async disconnect(): Promise<void> {
    try {
      await this.client.close();
    } catch {
      /* may not be connected */
    }
    try {
      await this.transport.close();
    } catch {
      /* may not be open */
    }
    this._connected = false;
  }

  /** Get the underlying MCP client for advanced usage. */
  get mcpClient(): Client {
    return this.client;
  }
}
