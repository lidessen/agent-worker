import { tmpdir } from "node:os";
import { createToolHandlers, type ToolHandlerDeps } from "../tool-registry.ts";

/**
 * Which transport the bridge is using. The entry script generator
 * needs this to build the correct fetch() call.
 */
export type BridgeTransport =
  | { type: "unix"; socketPath: string }
  | { type: "tcp"; host: string; port: number };

/**
 * HTTP server that bridges MCP subprocess tool calls back to the agent's
 * in-process state.
 *
 * Tries multiple transport strategies in order:
 * 1. Unix socket in OS tmpdir (fastest, no port conflicts)
 * 2. Unix socket in cwd (if tmpdir is restricted)
 * 3. TCP on 127.0.0.1:0 with retry (universal fallback)
 *
 * This is purely a transport layer. Which tools the MCP entry script
 * exposes is a separate concern.
 */
export class ToolBridge {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private _transport: BridgeTransport | null = null;
  private _socketPath: string | null = null; // for cleanup

  constructor(private deps: ToolHandlerDeps) {}

  get transport(): BridgeTransport | null {
    return this._transport;
  }

  async start(): Promise<BridgeTransport> {
    const fetchHandler = this.buildFetchHandler();
    const suffix = `${Date.now()}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

    // Strategy 1: Unix socket in OS tmpdir
    const sysTmp = tmpdir();
    const sock1 = `${sysTmp}/agent-bridge-${suffix}.sock`;
    const unix1 = await this.tryUnix(sock1, fetchHandler);
    if (unix1) return unix1;

    // Strategy 2: Unix socket in cwd (if tmpdir restricted)
    const sock2 = `.agent-bridge-${suffix}.sock`;
    const unix2 = await this.tryUnix(sock2, fetchHandler);
    if (unix2) return unix2;

    // Strategy 3: TCP on 127.0.0.1 with retry
    const tcp = await this.tryTcp(fetchHandler);
    if (tcp) return tcp;

    throw new Error(
      "ToolBridge: all transport strategies failed. " +
      "Tried Unix socket (tmpdir, cwd) and TCP (127.0.0.1). " +
      "Check filesystem permissions and available ports.",
    );
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
    if (this._socketPath) {
      try {
        const { unlink } = await import("node:fs/promises");
        await unlink(this._socketPath);
      } catch { /* already removed or never created */ }
      this._socketPath = null;
    }
    this._transport = null;
  }

  // ── Transport strategies ──────────────────────────────────────────────

  private async tryUnix(
    socketPath: string,
    fetch: (req: Request) => Promise<Response>,
  ): Promise<BridgeTransport | null> {
    // Clean up stale socket from a previous crash
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(socketPath);
    } catch { /* doesn't exist — expected */ }

    try {
      this.server = Bun.serve({ unix: socketPath, fetch });
      this._socketPath = socketPath;
      this._transport = { type: "unix", socketPath };
      return this._transport;
    } catch {
      return null;
    }
  }

  private async tryTcp(
    fetch: (req: Request) => Promise<Response>,
  ): Promise<BridgeTransport | null> {
    const attempts = [0, 0, 0]; // 3 attempts with port: 0
    for (const _ of attempts) {
      try {
        this.server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch });
        this._transport = { type: "tcp", host: "127.0.0.1", port: this.server.port };
        return this._transport;
      } catch {
        // port: 0 failed, try again (OS might free one up)
        await new Promise((r) => setTimeout(r, 10));
      }
    }
    return null;
  }

  // ── Request handler ───────────────────────────────────────────────────

  private buildFetchHandler(): (req: Request) => Promise<Response> {
    const handlers = createToolHandlers(this.deps);

    return async (req: Request) => {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const toolName = new URL(req.url).pathname.slice(1);
      const handler = handlers[toolName];
      if (!handler) {
        return Response.json({ error: `Unknown tool: ${toolName}` }, { status: 404 });
      }

      try {
        const args = await req.json();
        const result = await handler(args);
        return Response.json({ result });
      } catch (err) {
        return Response.json({ error: String(err) }, { status: 500 });
      }
    };
  }
}
