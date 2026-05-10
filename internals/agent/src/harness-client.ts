/**
 * Harness MCP Client — connects an agent to a harness MCP server.
 *
 * Provides a typed interface over the MCP client for calling harness
 * tools (channels, inbox, documents, resources, status).
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface HarnessClientOptions {
  /** Agent name — used to build the MCP endpoint path. */
  agentName: string;
  /** Base URL of the harness MCP server (e.g. "http://127.0.0.1:3100"). */
  harnessUrl: string;
}

/**
 * MCP client that connects to a harness server and provides access
 * to harness collaboration tools.
 *
 * The agent identifies itself via the URL path — connecting to
 * `{harnessUrl}/mcp/{agentName}`. The harness server auto-registers
 * the agent on first connection.
 *
 * Usage:
 * ```ts
 * const client = new HarnessClient({ agentName: "designer", harnessUrl: "http://localhost:3100" });
 * await client.connect();
 * const tools = await client.listTools();
 * const result = await client.callTool("channel_send", { channel: "general", content: "hello" });
 * await client.disconnect();
 * ```
 */
export class HarnessClient {
  readonly agentName: string;
  readonly harnessUrl: string;

  private client: Client;
  private transport: StreamableHTTPClientTransport;
  private _connected = false;

  constructor(opts: HarnessClientOptions) {
    this.agentName = opts.agentName;
    this.harnessUrl = opts.harnessUrl;

    const mcpUrl = new URL(`/mcp/${encodeURIComponent(opts.agentName)}`, opts.harnessUrl);
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
    return new URL(`/mcp/${encodeURIComponent(this.agentName)}`, this.harnessUrl).toString();
  }

  /** Connect to the harness MCP server. */
  async connect(): Promise<void> {
    await this.client.connect(this.transport);
    this._connected = true;
  }

  /** List all available harness tools. */
  async listTools(): Promise<{ tools: Array<{ name: string; description?: string }> }> {
    const result = await this.client.listTools();
    return {
      tools: result.tools.map((t) => ({ name: t.name, description: t.description })),
    };
  }

  /** Call a harness tool by name. Returns the text content of the result. */
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

  /** Disconnect from the harness MCP server. */
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
