/**
 * agent-worker daemon — persistent HTTP server that manages agents and workspaces.
 *
 * Provides a stable process for CLI, web, and MCP interfaces to connect to.
 *
 * Routes:
 *   GET  /health                 — daemon status
 *   POST /shutdown               — graceful shutdown
 *
 *   GET  /agents                 — list agents
 *   POST /agents                 — create ephemeral agent
 *   GET  /agents/:name           — get agent info
 *   DELETE /agents/:name         — remove ephemeral agent
 *
 *   POST /run                    — send message to agent, get response
 *   POST /send                   — async message to agent inbox
 *
 *   GET  /workspaces             — list workspaces
 *   POST /workspaces             — create workspace from YAML
 *   GET  /workspaces/:key        — get workspace info
 *   DELETE /workspaces/:key      — stop workspace
 *   POST /workspaces/:key/send   — send message to workspace channel
 *
 *   GET  /events                 — read event log (cursor-based)
 */
import type { DaemonConfig, DaemonInfo, DaemonEvent } from "./types.ts";
import { AgentRegistry } from "./agent-registry.ts";
import { WorkspaceRegistry } from "./workspace-registry.ts";
import { DaemonEventLog } from "./event-log.ts";
import { writeDaemonInfo, removeDaemonInfo, generateToken, defaultDataDir } from "./discovery.ts";

export class Daemon {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private readonly agents: AgentRegistry;
  private readonly workspaces: WorkspaceRegistry;
  private readonly eventLog: DaemonEventLog;
  private readonly config: Required<DaemonConfig>;
  private startedAt = 0;

  constructor(config: DaemonConfig = {}) {
    const dataDir = config.dataDir ?? defaultDataDir();
    this.config = {
      port: config.port ?? 0,
      host: config.host ?? "127.0.0.1",
      dataDir,
      token: config.token ?? generateToken(),
    };

    this.agents = new AgentRegistry();
    this.workspaces = new WorkspaceRegistry(dataDir);
    this.eventLog = new DaemonEventLog(dataDir);

    // Wire event sinks
    const sink = (event: DaemonEvent) => this.eventLog.append(event.type, event);
    this.agents.setEventSink(sink);
    this.workspaces.setEventSink(sink);
  }

  /** Start the daemon server. Returns connection info. */
  async start(): Promise<DaemonInfo> {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(this.config.dataDir, { recursive: true });

    await this.eventLog.init();
    this.startedAt = Date.now();

    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,
      fetch: (req) => this.handleRequest(req),
    });

    const actualPort = this.server.port;
    const info: DaemonInfo = {
      pid: process.pid,
      host: this.config.host,
      port: actualPort,
      token: this.config.token,
      startedAt: this.startedAt,
    };

    await writeDaemonInfo(info, this.config.dataDir);

    this.eventLog.append("daemon_started", {
      host: this.config.host,
      port: actualPort,
    });

    return info;
  }

  /** Graceful shutdown. */
  async shutdown(): Promise<void> {
    this.eventLog.append("daemon_stopped");

    await this.agents.stopAll();
    await this.workspaces.stopAll();

    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }

    await removeDaemonInfo(this.config.dataDir);
  }

  /** Direct access to registries (for programmatic use). */
  get agentRegistry(): AgentRegistry {
    return this.agents;
  }

  get workspaceRegistry(): WorkspaceRegistry {
    return this.workspaces;
  }

  get events(): DaemonEventLog {
    return this.eventLog;
  }

  get port(): number {
    return this.server?.port ?? 0;
  }

  // ── Request routing ─────────────────────────────────────────────────────

  private async handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Auth check (skip for health)
    if (path !== "/health") {
      const authHeader = req.headers.get("authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== this.config.token) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    try {
      // Health
      if (path === "/health" && method === "GET") {
        return this.handleHealth();
      }

      // Shutdown
      if (path === "/shutdown" && method === "POST") {
        return this.handleShutdown();
      }

      // Agents
      if (path === "/agents" && method === "GET") {
        return this.handleListAgents();
      }
      if (path === "/agents" && method === "POST") {
        return await this.handleCreateAgent(req);
      }

      const agentMatch = path.match(/^\/agents\/([^/]+)$/);
      if (agentMatch) {
        const name = decodeURIComponent(agentMatch[1]!);
        if (method === "GET") return this.handleGetAgent(name);
        if (method === "DELETE") return await this.handleRemoveAgent(name);
      }

      // Run / Send
      if (path === "/run" && method === "POST") {
        return await this.handleRun(req);
      }
      if (path === "/send" && method === "POST") {
        return await this.handleSend(req);
      }

      // Workspaces
      if (path === "/workspaces" && method === "GET") {
        return this.handleListWorkspaces();
      }
      if (path === "/workspaces" && method === "POST") {
        return await this.handleCreateWorkspace(req);
      }

      const wsMatch = path.match(/^\/workspaces\/([^/]+)$/);
      if (wsMatch) {
        const key = decodeURIComponent(wsMatch[1]!);
        if (method === "GET") return this.handleGetWorkspace(key);
        if (method === "DELETE") return await this.handleRemoveWorkspace(key);
      }

      const wsSendMatch = path.match(/^\/workspaces\/([^/]+)\/send$/);
      if (wsSendMatch && method === "POST") {
        return await this.handleWorkspaceSend(decodeURIComponent(wsSendMatch[1]!), req);
      }

      // Events
      if (path === "/events" && method === "GET") {
        return await this.handleEvents(url);
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────

  private handleHealth(): Response {
    return Response.json({
      status: "ok",
      pid: process.pid,
      uptime: Date.now() - this.startedAt,
      agents: this.agents.size,
      workspaces: this.workspaces.size,
    });
  }

  // ── Shutdown ────────────────────────────────────────────────────────────

  private handleShutdown(): Response {
    // Defer actual shutdown so response gets sent
    setTimeout(() => this.shutdown(), 100);
    return Response.json({ shutting_down: true });
  }

  // ── Agents ──────────────────────────────────────────────────────────────

  private handleListAgents(): Response {
    return Response.json({ agents: this.agents.list() });
  }

  private async handleCreateAgent(req: Request): Promise<Response> {
    const body = (await req.json()) as {
      name: string;
      instructions?: string;
    };

    if (!body.name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    // Creating an ephemeral agent requires a loop — for now, we create
    // a placeholder that callers can configure. In practice, a real loop
    // would be injected by the CLI or caller.
    // For API-created agents, we store a "pending" handle that needs a loop.
    if (this.agents.has(body.name)) {
      return Response.json({ error: `Agent "${body.name}" already exists` }, { status: 409 });
    }

    // Return the info — actual loop wiring happens when /run is called
    // with a loop config, or via programmatic API.
    return Response.json(
      {
        error:
          "Creating agents via HTTP requires a loop backend. Use the programmatic API or provide a runtime config.",
      },
      { status: 501 },
    );
  }

  private handleGetAgent(name: string): Response {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }
    return Response.json(handle.info);
  }

  private async handleRemoveAgent(name: string): Promise<Response> {
    try {
      await this.agents.remove(name);
      return Response.json({ removed: true });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 400 });
    }
  }

  // ── Run / Send ──────────────────────────────────────────────────────────

  private async handleRun(req: Request): Promise<Response> {
    const body = (await req.json()) as {
      agent: string;
      message: string;
    };

    if (!body.agent || !body.message) {
      return Response.json({ error: "agent and message are required" }, { status: 400 });
    }

    const handle = this.agents.get(body.agent);
    if (!handle) {
      return Response.json({ error: `Agent "${body.agent}" not found` }, { status: 404 });
    }

    const result = await handle.run(body.message);
    return Response.json({
      agent: body.agent,
      text: result.text,
      eventCount: result.events.length,
    });
  }

  private async handleSend(req: Request): Promise<Response> {
    const body = (await req.json()) as {
      agent: string;
      message: string;
      from?: string;
    };

    if (!body.agent || !body.message) {
      return Response.json({ error: "agent and message are required" }, { status: 400 });
    }

    const handle = this.agents.get(body.agent);
    if (!handle) {
      return Response.json({ error: `Agent "${body.agent}" not found` }, { status: 404 });
    }

    handle.push({ content: body.message, from: body.from });
    return Response.json({ sent: true, state: handle.state });
  }

  // ── Workspaces ──────────────────────────────────────────────────────────

  private handleListWorkspaces(): Response {
    return Response.json({ workspaces: this.workspaces.list() });
  }

  private async handleCreateWorkspace(req: Request): Promise<Response> {
    const body = (await req.json()) as {
      source: string;
      tag?: string;
      vars?: Record<string, string>;
    };

    if (!body.source) {
      return Response.json({ error: "source (YAML) is required" }, { status: 400 });
    }

    try {
      const handle = await this.workspaces.create(body);
      await handle.startLoops();
      await handle.kickoff();
      return Response.json(handle.info);
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 400 });
    }
  }

  private handleGetWorkspace(key: string): Response {
    const handle = this.workspaces.get(key);
    if (!handle) {
      return Response.json({ error: `Workspace "${key}" not found` }, { status: 404 });
    }
    return Response.json(handle.info);
  }

  private async handleRemoveWorkspace(key: string): Promise<Response> {
    try {
      await this.workspaces.remove(key);
      return Response.json({ removed: true });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 400 });
    }
  }

  private async handleWorkspaceSend(key: string, req: Request): Promise<Response> {
    const handle = this.workspaces.get(key);
    if (!handle) {
      return Response.json({ error: `Workspace "${key}" not found` }, { status: 404 });
    }

    const body = (await req.json()) as {
      channel?: string;
      from?: string;
      content: string;
    };

    if (!body.content) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const channel = body.channel ?? (handle.resolved.def.default_channel ?? "general");
    await handle.send(channel, body.from ?? "user", body.content);
    return Response.json({ sent: true, channel });
  }

  // ── Events ──────────────────────────────────────────────────────────────

  private async handleEvents(url: URL): Promise<Response> {
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const result = await this.eventLog.read(cursor);
    return Response.json(result);
  }
}

// ── Convenience starter ───────────────────────────────────────────────────

/** Start a daemon and return its info. */
export async function startDaemon(config?: DaemonConfig): Promise<{
  daemon: Daemon;
  info: DaemonInfo;
}> {
  const daemon = new Daemon(config);
  const info = await daemon.start();
  return { daemon, info };
}
