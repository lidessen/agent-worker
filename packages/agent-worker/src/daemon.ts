/**
 * agent-worker daemon — persistent HTTP server that manages agents and workspaces.
 *
 * Provides a stable process for CLI, web, and MCP interfaces to connect to.
 *
 * Routes:
 *   GET  /health                 — daemon status
 *   POST /shutdown               — graceful shutdown
 *
 *   GET  /agents                       — list agents
 *   POST /agents                       — create agent (not yet implemented)
 *   GET  /agents/:name                 — get agent info
 *   DELETE /agents/:name               — remove agent
 *   POST   /agents/:name/send           — send message(s) to agent
 *   POST   /agents/:name/run           — send + wait for response
 *   GET    /agents/:name/responses     — incremental response log (cursor-based)
 *   GET    /agents/:name/events        — incremental event log (cursor-based)
 *   GET    /agents/:name/state         — agent state, inbox, todos
 *
 *   GET  /workspaces             — list workspaces
 *   POST /workspaces             — create workspace from YAML
 *   GET  /workspaces/:key        — get workspace info
 *   DELETE /workspaces/:key      — stop workspace
 *   POST /workspaces/:key/send   — send message to workspace channel
 *
 *   GET  /events                 — read event log (cursor-based)
 */
import type { DaemonConfig, DaemonInfo } from "./types.ts";
import { EventBus } from "@agent-worker/shared";
import type { BusEvent } from "@agent-worker/shared";
import { AgentRegistry } from "./agent-registry.ts";
import { WorkspaceRegistry } from "./workspace-registry.ts";
import { DaemonEventLog } from "./event-log.ts";
import { writeDaemonInfo, removeDaemonInfo, generateToken, defaultDataDir } from "./discovery.ts";

export class Daemon {
  private server: ReturnType<typeof Bun.serve> | null = null;
  private readonly agents: AgentRegistry;
  private readonly workspaces: WorkspaceRegistry;
  private readonly eventLog: DaemonEventLog;
  private readonly _bus: EventBus;
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

    this._bus = new EventBus();
    this.agents = new AgentRegistry();
    this.workspaces = new WorkspaceRegistry(dataDir);
    this.eventLog = new DaemonEventLog(dataDir);

    // Wire registries
    this.agents.setBus(this._bus);
    this.agents.setDataDir(dataDir);
    this.workspaces.setBus(this._bus);

    // Wire event bus → JSONL event log (single consumer persists all events)
    this._bus.on((event: BusEvent) => {
      this.eventLog.append(event.type, event);
    });
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

    this._bus.emit({
      type: "daemon.started",
      source: "daemon",
      host: this.config.host,
      port: actualPort,
    });

    return info;
  }

  /** Graceful shutdown. */
  async shutdown(): Promise<void> {
    this._bus.emit({ type: "daemon.stopped", source: "daemon" });

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

  /** Shared event bus. Subscribe for real-time streaming or add custom consumers. */
  get bus(): EventBus {
    return this._bus;
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

      const agentMatch = path.match(/^\/agents\/([^/]+)(\/.*)?$/);
      if (agentMatch) {
        const name = decodeURIComponent(agentMatch[1]!);
        const sub = agentMatch[2] ?? "";

        if (!sub) {
          if (method === "GET") return this.handleGetAgent(name);
          if (method === "DELETE") return await this.handleRemoveAgent(name);
        }
        if (sub === "/send" && method === "POST") return await this.handleAgentSend(name, req);
        if (sub === "/run" && method === "POST") return await this.handleAgentRun(name, req);
        if (sub === "/responses" && method === "GET") return await this.handleAgentResponses(name, url);
        if (sub === "/events" && method === "GET") return await this.handleAgentEvents(name, url);
        if (sub === "/state" && method === "GET") return this.handleAgentState(name);
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

  // ── Agent sub-routes ────────────────────────────────────────────────────

  private async handleAgentSend(name: string, req: Request): Promise<Response> {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }

    const body = (await req.json()) as {
      messages: Array<{ content: string; from?: string; delayMs?: number }>;
    };

    if (!body.messages?.length) {
      return Response.json({ error: "messages array is required" }, { status: 400 });
    }

    let sent = 0;
    for (const msg of body.messages) {
      if (msg.delayMs && msg.delayMs > 0) {
        await new Promise((r) => setTimeout(r, msg.delayMs));
      }
      handle.push({ content: msg.content, from: msg.from });
      sent++;
    }

    return Response.json({ sent, state: handle.state });
  }

  private async handleAgentRun(name: string, req: Request): Promise<Response> {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }

    const body = (await req.json()) as { message: string; from?: string };
    if (!body.message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }

    const result = await handle.run(body.message, body.from);
    return Response.json({
      text: result.text,
      eventCount: result.events.length,
    });
  }

  private async handleAgentResponses(name: string, url: URL): Promise<Response> {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const result = await handle.readResponses(cursor);
    return Response.json(result);
  }

  private async handleAgentEvents(name: string, url: URL): Promise<Response> {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const result = await handle.readEvents(cursor);
    return Response.json(result);
  }

  private handleAgentState(name: string): Response {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }
    return Response.json({
      state: handle.state,
      inbox: handle.agent.inboxMessages.map((m) => ({
        id: m.id,
        status: m.status,
        from: m.from,
        content: m.content,
        timestamp: m.timestamp,
      })),
      todos: handle.agent.todos.map((t) => ({
        id: t.id,
        status: t.status,
        text: t.text,
      })),
      history: handle.agent.context.length,
    });
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

    const channel = body.channel ?? handle.resolved.def.default_channel ?? "general";
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
