/**
 * agent-worker daemon — persistent HTTP server that manages agents and workspaces.
 *
 * Routes:
 *   GET  /health                                — daemon status
 *   POST /shutdown                              — graceful shutdown
 *
 *   GET    /agents                              — list agents
 *   POST   /agents                              — create agent (with RuntimeConfig)
 *   GET    /agents/:name                        — get agent info
 *   DELETE /agents/:name                        — remove agent
 *   POST   /agents/:name/send                   — send message(s) to agent
 *   GET    /agents/:name/responses              — incremental response log (cursor-based)
 *   GET    /agents/:name/responses/stream       — SSE: real-time responses
 *   GET    /agents/:name/events                 — incremental event log (cursor-based)
 *   GET    /agents/:name/events/stream          — SSE: real-time agent events
 *   GET    /agents/:name/state                  — agent state, inbox, todos
 *
 *   GET    /workspaces                          — list workspaces
 *   POST   /workspaces                          — create workspace from YAML
 *   GET    /workspaces/:key                     — get workspace info
 *   GET    /workspaces/:key/wait                — block until task workspace completes
 *   DELETE /workspaces/:key                     — stop workspace
 *   POST   /workspaces/:key/send               — send to workspace (channel/agent/both)
 *   GET    /workspaces/:key/channels/:ch        — read channel messages (cursor-based)
 *   GET    /workspaces/:key/channels/:ch/stream — SSE: real-time channel messages
 *   GET    /workspaces/:key/events              — workspace events (cursor-based)
 *   GET    /workspaces/:key/events/stream       — SSE: workspace events
 *
 *   GET    /workspaces/:key/docs                — list documents
 *   GET    /workspaces/:key/docs/:name          — read document
 *   PUT    /workspaces/:key/docs/:name          — write document
 *   PATCH  /workspaces/:key/docs/:name          — append to document
 *
 *   GET    /events                              — daemon event log (cursor-based)
 *   GET    /events/stream                       — SSE: all daemon events
 */
import type { DaemonConfig, DaemonInfo, RuntimeConfig } from "./types.ts";
import { EventBus } from "@agent-worker/shared";
import type { BusEvent } from "@agent-worker/shared";
import { AgentRegistry } from "./agent-registry.ts";
import { WorkspaceRegistry } from "./workspace-registry.ts";
import { ManagedWorkspace } from "./managed-workspace.ts";
import { DaemonEventLog } from "./event-log.ts";
import { createLoopFromConfig } from "./loop-factory.ts";
import { writeDaemonInfo, removeDaemonInfo, generateToken, defaultDataDir } from "./discovery.ts";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

export class Daemon {
  private server: ServerType | null = null;
  private _port = 0;
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
    await this.workspaces.ensureDefault();
    this.startedAt = Date.now();

    const app = new Hono();
    app.all("*", async (c) => {
      const response = await this.handleRequest(c.req.raw);
      return response;
    });
    const actualPort = await new Promise<number>((resolve) => {
      this.server = serve(
        {
          fetch: app.fetch,
          port: this.config.port,
          hostname: this.config.host,
        },
        (info) => {
          resolve(info.port);
        },
      );
    });
    this._port = actualPort;
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
      this.server.close();
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
    return this._port;
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
        if (sub === "/responses" && method === "GET")
          return await this.handleAgentResponses(name, url);
        if (sub === "/responses/stream" && method === "GET")
          return this.handleAgentResponsesStream(name, url);
        if (sub === "/events" && method === "GET") return await this.handleAgentEvents(name, url);
        if (sub === "/events/stream" && method === "GET") return this.handleAgentEventsStream(name);
        if (sub === "/state" && method === "GET") return this.handleAgentState(name);
      }

      // Workspaces
      if (path === "/workspaces" && method === "GET") {
        return this.handleListWorkspaces();
      }
      if (path === "/workspaces" && method === "POST") {
        return await this.handleCreateWorkspace(req);
      }

      // Workspace sub-routes: /workspaces/:key/...
      const wsSubMatch = path.match(/^\/workspaces\/([^/]+)(\/.+)?$/);
      if (wsSubMatch) {
        const key = decodeURIComponent(wsSubMatch[1]!);
        const sub = wsSubMatch[2] ?? "";

        if (!sub) {
          if (method === "GET") return this.handleGetWorkspace(key);
          if (method === "DELETE") return await this.handleRemoveWorkspace(key);
        }
        if (sub === "/send" && method === "POST") {
          return await this.handleWorkspaceSend(key, req);
        }
        if (sub === "/wait" && method === "GET") {
          return await this.handleWorkspaceWait(key, url);
        }
        if (sub === "/status" && method === "GET") {
          return this.handleWorkspaceStatus(key);
        }
        if (sub === "/channels" && method === "GET") {
          return this.handleListChannels(key);
        }
        if (sub === "/events" && method === "GET") {
          return await this.handleWorkspaceEvents(key, url);
        }
        if (sub === "/events/stream" && method === "GET") {
          return this.handleWorkspaceEventsStream(key);
        }

        // Inbox route: /workspaces/:key/inbox/:agent
        const inboxMatch = sub.match(/^\/inbox\/([^/]+)$/);
        if (inboxMatch && method === "GET") {
          return await this.handleWorkspaceInbox(key, decodeURIComponent(inboxMatch[1]!));
        }

        // Channel routes: /workspaces/:key/channels/:ch[/stream]
        const chMatch = sub.match(/^\/channels\/([^/]+)(\/stream)?$/);
        if (chMatch) {
          const ch = decodeURIComponent(chMatch[1]!);
          if (chMatch[2] === "/stream" && method === "GET") {
            return this.handleWorkspaceChannelStream(key, ch, url);
          }
          if (method === "GET") {
            return await this.handleWorkspaceChannel(key, ch, url);
          }
        }

        // Doc routes: /workspaces/:key/docs[/:name]
        if (sub === "/docs" && method === "GET") {
          return await this.handleListDocs(key);
        }
        const docMatch = sub.match(/^\/docs\/([^/]+)$/);
        if (docMatch) {
          const docName = decodeURIComponent(docMatch[1]!);
          if (method === "GET") return await this.handleReadDoc(key, docName);
          if (method === "PUT") return await this.handleWriteDoc(key, docName, req);
          if (method === "PATCH") return await this.handleAppendDoc(key, docName, req);
        }
      }

      // Events
      if (path === "/events" && method === "GET") {
        return await this.handleEvents(url);
      }
      if (path === "/events/stream" && method === "GET") {
        return this.handleEventsStream();
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (err) {
      console.error("[daemon] request error:", err);
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
      runtime: RuntimeConfig;
    };

    if (!body.name) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }
    if (!body.runtime?.type) {
      return Response.json({ error: "runtime.type is required" }, { status: 400 });
    }

    if (this.agents.has(body.name)) {
      return Response.json({ error: `Agent "${body.name}" already exists` }, { status: 409 });
    }

    try {
      const loop = await createLoopFromConfig(body.runtime);
      const handle = await this.agents.create({
        name: body.name,
        instructions: body.runtime.instructions,
        loop,
        kind: "ephemeral",
        runtime: body.runtime.type,
      });
      return Response.json(handle.info, { status: 201 });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 422 });
    }
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

  private async handleAgentResponses(name: string, url: URL): Promise<Response> {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const result = await handle.readResponses(cursor);
    return Response.json(result);
  }

  private handleAgentResponsesStream(name: string, _url: URL): Response {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }
    return this.createSSEStream((push) => {
      // Poll responses file for new data
      let cursor = 0;
      const interval = setInterval(async () => {
        try {
          const result = await handle.readResponses(cursor);
          for (const entry of result.entries) {
            push(entry);
          }
          cursor = result.cursor;
        } catch {
          /* agent may be removed */
        }
      }, 500);
      return () => clearInterval(interval);
    });
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

  private handleAgentEventsStream(name: string): Response {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }
    return this.createSSEStream((push) => {
      let cursor = 0;
      const interval = setInterval(async () => {
        try {
          const result = await handle.readEvents(cursor);
          for (const entry of result.entries) {
            push(entry);
          }
          cursor = result.cursor;
        } catch {
          /* agent may be removed */
        }
      }, 500);
      return () => clearInterval(interval);
    });
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

  /**
   * Resolve a workspace key to a handle. If the bare name matches multiple
   * tagged instances, returns a 409 Conflict response. If not found, 404.
   */
  private resolveWorkspace(key: string): ManagedWorkspace | Response {
    const handle = this.workspaces.get(key);
    if (handle) return handle;

    // Check if there are tagged variants
    const matches = this.workspaces.list().filter((ws) => ws.name === key && ws.tag);
    if (matches.length > 0) {
      return Response.json(
        {
          error: `Multiple instances of "${key}" exist`,
          instances: matches.map((m) => (m.tag ? `${m.name}:${m.tag}` : m.name)),
        },
        { status: 409 },
      );
    }
    return Response.json({ error: `Workspace "${key}" not found` }, { status: 404 });
  }

  private handleListWorkspaces(): Response {
    return Response.json({ workspaces: this.workspaces.list() });
  }

  private async handleCreateWorkspace(req: Request): Promise<Response> {
    const body = (await req.json()) as {
      source: string;
      tag?: string;
      vars?: Record<string, string>;
      mode?: "service" | "task";
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
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    return Response.json(resolved.info);
  }

  private async handleWorkspaceWait(key: string, url: URL): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const timeoutStr = url.searchParams.get("timeout") ?? "60s";
    const timeoutMs = parseDuration(timeoutStr);
    const deadline = Date.now() + timeoutMs;

    // Poll until completion, failure, or timeout
    while (Date.now() < deadline) {
      const status = handle.checkCompletion();
      if (status !== "running") {
        handle.complete(status);
        const result = {
          workspace: handle.key,
          agents: handle.resolved.agents.map((a) => a.name),
          mode: handle.mode,
        };
        // Auto-remove task workspaces on completion
        if (handle.mode === "task") {
          try {
            await this.workspaces.remove(key);
          } catch {
            /* already removed */
          }
        }
        return Response.json({ status, result });
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    return Response.json({ status: "timeout" });
  }

  private async handleRemoveWorkspace(key: string): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    try {
      await this.workspaces.remove(key);
      return Response.json({ removed: true });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 400 });
    }
  }

  private async handleWorkspaceSend(key: string, req: Request): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const body = (await req.json()) as {
      content: string;
      from?: string;
      agent?: string;
      channel?: string;
    };

    if (!body.content) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const from = body.from ?? "user";

    // Workspace send semantics:
    // - Only channel → broadcast to channel
    // - Only agent → direct message via smartSend with `to` field
    // - Both → post to channel with `to` targeting agent
    // - Neither → post to default_channel
    if (body.agent && !body.channel) {
      // Direct message to agent via default channel with `to` field
      const channel = handle.resolved.def.default_channel ?? "general";
      await handle.workspace.contextProvider.smartSend(channel, from, body.content, {
        to: body.agent,
      });
      return Response.json({ sent: true, routed_to: `agent:${body.agent}` });
    }

    const channel = body.channel ?? handle.resolved.def.default_channel ?? "general";

    if (body.agent) {
      // Post to channel AND target agent
      await handle.workspace.contextProvider.smartSend(channel, from, body.content, {
        to: body.agent,
      });
      return Response.json({ sent: true, routed_to: `channel:${channel}+agent:${body.agent}` });
    }

    await handle.send(channel, from, body.content);
    return Response.json({ sent: true, routed_to: `channel:${channel}` });
  }

  // ── Workspace status & inbox ─────────────────────────────────────────

  private handleWorkspaceStatus(key: string): Response {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const channels = handle.workspace.contextProvider.channels.listChannels();
    return Response.json({
      name: handle.name,
      tag: handle.tag,
      key: handle.key,
      mode: handle.mode,
      status: handle.status,
      agents: handle.resolved.agents.map((a) => a.name),
      agent_details: handle.resolved.agents.map((a) => ({
        name: a.name,
        runtime: a.runtime ?? "mock",
      })),
      channels,
      loops: handle.loops.map((l) => ({
        name: l.name,
        running: l.isRunning,
      })),
    });
  }

  private handleListChannels(key: string): Response {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;
    const channels = handle.workspace.contextProvider.channels.listChannels();
    return Response.json({ channels });
  }

  private async handleWorkspaceInbox(key: string, agentName: string): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const inbox = handle.workspace.contextProvider.inbox;
    const entries = await inbox.peek(agentName);
    return Response.json({
      agent: agentName,
      entries: entries.map((e) => ({
        messageId: e.messageId,
        channel: e.channel,
        priority: e.priority,
        state: e.state,
        enqueuedAt: e.enqueuedAt,
      })),
    });
  }

  // ── Workspace channels ─────────────────────────────────────────────────

  private async handleWorkspaceChannel(key: string, ch: string, url: URL): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const since = url.searchParams.get("since") ?? undefined;
    const agent = url.searchParams.get("agent") ?? undefined;

    let messages = await handle.workspace.contextProvider.channels.read(ch, { limit, since });

    // Optional agent filter
    if (agent) {
      messages = messages.filter((m) => m.from === agent || m.to === agent);
    }

    return Response.json({
      channel: ch,
      messages: messages.map((m) => ({
        id: m.id,
        from: m.from,
        content: m.content,
        timestamp: m.timestamp,
        mentions: m.mentions,
        to: m.to,
      })),
    });
  }

  private handleWorkspaceChannelStream(key: string, ch: string, _url: URL): Response {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    return this.createSSEStream((push) => {
      const listener = (msg: any) => {
        push({
          ts: Date.now(),
          type: "message",
          channel: ch,
          id: msg.id,
          from: msg.from,
          content: msg.content,
          timestamp: msg.timestamp,
        });
      };
      handle.workspace.contextProvider.channels.on("message", listener);
      return () => {
        handle.workspace.contextProvider.channels.off("message", listener);
      };
    });
  }

  // ── Workspace events ───────────────────────────────────────────────────

  private async handleWorkspaceEvents(key: string, url: URL): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    // Filter daemon events to those related to this workspace
    const result = await this.eventLog.read(cursor);
    const wsKey = handle.key;
    const filtered = result.entries.filter((e: any) => e.workspace === wsKey);
    return Response.json({ entries: filtered, cursor: result.cursor });
  }

  private handleWorkspaceEventsStream(key: string): Response {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const wsKey = handle.key;
    return this.createSSEStream((push) => {
      const unsub = this._bus.on((event: BusEvent) => {
        if (event.workspace === wsKey) {
          push({ ...event, ts: Date.now() });
        }
      });
      return unsub;
    });
  }

  // ── Workspace documents ────────────────────────────────────────────────

  private async handleListDocs(key: string): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const docs = handle.workspace.contextProvider.documents;
    const names = await docs.list();
    return Response.json({ docs: names.map((name: string) => ({ name })) });
  }

  private async handleReadDoc(key: string, docName: string): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const docs = handle.workspace.contextProvider.documents;
    const content = await docs.read(docName);
    if (content === null || content === undefined) {
      return Response.json({ error: `Document "${docName}" not found` }, { status: 404 });
    }
    return Response.json({ name: docName, content });
  }

  private async handleWriteDoc(key: string, docName: string, req: Request): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const body = (await req.json()) as { content: string };
    if (body.content === undefined) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const docs = handle.workspace.contextProvider.documents;
    await docs.write(docName, body.content, "api");
    return Response.json({ name: docName, written: true });
  }

  private async handleAppendDoc(key: string, docName: string, req: Request): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const body = (await req.json()) as { content: string };
    if (body.content === undefined) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const docs = handle.workspace.contextProvider.documents;
    await docs.append(docName, body.content, "api");
    return Response.json({ name: docName, appended: true });
  }

  // ── Events ──────────────────────────────────────────────────────────────

  private async handleEvents(url: URL): Promise<Response> {
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const result = await this.eventLog.read(cursor);
    return Response.json(result);
  }

  private handleEventsStream(): Response {
    return this.createSSEStream((push) => {
      const unsub = this._bus.on((event: BusEvent) => {
        push({ ...event, ts: Date.now() });
      });
      return unsub;
    });
  }

  // ── SSE helper ─────────────────────────────────────────────────────────

  /**
   * Create an SSE response. The setup function receives a push callback
   * and returns a cleanup function.
   */
  private createSSEStream(setup: (push: (data: unknown) => void) => (() => void) | void): Response {
    let cleanup: (() => void) | void;
    const stream = new ReadableStream({
      start(controller) {
        const push = (data: unknown) => {
          try {
            controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
          } catch {
            /* stream may be closed */
          }
        };
        cleanup = setup(push);
      },
      cancel() {
        cleanup?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Parse a duration string like "60s", "5m" into milliseconds. */
function parseDuration(str: string): number {
  const match = str.match(/^(\d+)(ms|s|m|h)?$/);
  if (!match) return 60_000;
  const n = parseInt(match[1]!, 10);
  switch (match[2]) {
    case "ms":
      return n;
    case "s":
      return n * 1000;
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    default:
      return n * 1000; // default to seconds
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
