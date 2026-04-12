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
import { stat, readFile } from "node:fs/promises";
import { join, resolve, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { DaemonConfig, DaemonInfo, RuntimeConfig } from "./types.ts";
import { EventBus } from "@agent-worker/shared";
import type { BusEvent } from "@agent-worker/shared";
import { AgentRegistry } from "./agent-registry.ts";
import { ManagedAgent } from "./managed-agent.ts";
import { GlobalAgentStub } from "./global-agent-stub.ts";
import { WorkspaceRegistry } from "./workspace-registry.ts";
import { ManagedWorkspace } from "./managed-workspace.ts";
import { DaemonEventLog } from "./event-log.ts";
import { createLoopFromConfig } from "./loop-factory.ts";
import { writeDaemonInfo, removeDaemonInfo, generateToken, defaultDataDir } from "./discovery.ts";
import { WorkspaceMcpHub } from "@agent-worker/workspace";
import type { TaskStatus } from "@agent-worker/workspace";

const TASK_STATUS_VALUES = new Set<TaskStatus>([
  "draft",
  "open",
  "in_progress",
  "blocked",
  "completed",
  "aborted",
  "failed",
]);
import { detectAiSdkModel, resolveRuntime } from "./resolve-runtime.ts";
import { checkCliAvailability, checkClaudeCodeAuth, checkCodexAuth } from "@agent-worker/loop";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import type { HttpBindings } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

function advertisedHost(host: string): string {
  return host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
}

function normalizeRemoteAddress(remoteAddress?: string): string {
  if (!remoteAddress) return "";
  return remoteAddress.replace(/^::ffff:/, "");
}

function isLoopbackAddress(remoteAddress?: string): boolean {
  const addr = normalizeRemoteAddress(remoteAddress);
  return addr === "127.0.0.1" || addr === "::1" || addr === "localhost";
}

function isTailscaleAddress(remoteAddress?: string): boolean {
  const addr = normalizeRemoteAddress(remoteAddress);
  if (!addr) return false;
  if (addr.startsWith("fd7a:115c:a1e0:")) return true;

  const match = addr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return a === 100 && b >= 64 && b <= 127;
}

export class Daemon {
  private server: ServerType | null = null;
  private _port = 0;
  private mcpHub: WorkspaceMcpHub | null = null;
  private readonly agents: AgentRegistry;
  private readonly workspaces: WorkspaceRegistry;
  private readonly eventLog: DaemonEventLog;
  private readonly _bus: EventBus;
  private readonly config: Required<DaemonConfig>;
  private startedAt = 0;

  constructor(config: DaemonConfig = {}) {
    const dataDir = config.dataDir ?? defaultDataDir();
    // Default webDistDir: from daemon.ts (packages/agent-worker/src/) → up 3 to packages/ → web/dist
    const defaultWebDist = resolve(fileURLToPath(import.meta.url), "..", "..", "..", "web", "dist");
    this.config = {
      port: config.port ?? 7420,
      host: config.host ?? "0.0.0.0",
      trustTailscale: config.trustTailscale ?? false,
      dataDir,
      token: config.token ?? generateToken(),
      mcpPort: config.mcpPort ?? 42424,
      webDistDir: config.webDistDir ?? defaultWebDist,
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

    // Start HTTP server first so we know the port
    const app = new Hono<{ Bindings: HttpBindings }>();
    app.all("*", async (c) => {
      const response = await this.handleRequest(c.req.raw, c.env.incoming.socket.remoteAddress);
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
    this.startedAt = Date.now();
    const publicHost = advertisedHost(this.config.host);

    // Create global workspace (but don't start agent loops yet — MCP hub URL needed first)
    const globalWs = await this.workspaces.ensureDefault();

    // Start workspace MCP hub so CLI agents get a valid URL
    this.mcpHub = new WorkspaceMcpHub(globalWs.workspace);
    await this.mcpHub.start({
      port: this.config.mcpPort,
      storageDir: join(this.config.dataDir, "workspace-data", "global"),
      pauseAgent: async (name) => {
        const loop = globalWs.loops.find((l) => l.name === name);
        if (!loop) throw new Error(`Agent "${name}" not found`);
        await loop.pause();
      },
      resumeAgent: async (name) => {
        const loop = globalWs.loops.find((l) => l.name === name);
        if (!loop) throw new Error(`Agent "${name}" not found`);
        await loop.resume();
      },
      pauseAll: async () => {
        for (const loop of globalWs.loops) await loop.pause();
      },
      resumeAll: async () => {
        for (const loop of globalWs.loops) await loop.resume();
      },
      isAgentPaused: (name) => {
        const loop = globalWs.loops.find((l) => l.name === name);
        return loop?.isPaused ?? false;
      },
    });

    // Now set daemon info WITH the MCP hub URL, then start agent loops
    this.workspaces.setDaemonInfo(
      `http://${publicHost}:${actualPort}`,
      this.config.token,
      this.mcpHub.url ?? undefined,
    );
    await globalWs.startLoops();
    this.registerGlobalAgents(globalWs);

    // Restore registered workspaces from manifest (created via `aw create`)
    await this.workspaces.restoreFromManifest();

    const info: DaemonInfo = {
      pid: process.pid,
      host: publicHost,
      port: actualPort,
      token: this.config.token,
      startedAt: this.startedAt,
      listenHost: this.config.host,
      mcpPort: this.mcpHub.port ?? undefined,
    };

    await writeDaemonInfo(info, this.config.dataDir);

    this._bus.emit({
      type: "daemon.started",
      source: "daemon",
      host: publicHost,
      listenHost: this.config.host,
      port: actualPort,
    });

    return info;
  }

  /** Graceful shutdown. */
  async shutdown(): Promise<void> {
    this._bus.emit({ type: "daemon.stopped", source: "daemon" });

    await this.agents.stopAll();
    await this.workspaces.stopAll();

    if (this.mcpHub) {
      await this.mcpHub.stop();
      this.mcpHub = null;
    }

    if (this.server) {
      this.server.close();
      this.server = null;
    }

    await removeDaemonInfo(this.config.dataDir);
  }

  /**
   * Register global workspace agents into AgentRegistry so they appear
   * in GET /agents and health.agents count.
   *
   * These agents are backed by WorkspaceAgentLoop — only lightweight stubs
   * are needed in the registry for route detection and API visibility.
   */
  private registerGlobalAgents(globalWs: ManagedWorkspace): void {
    const statusStore = globalWs.workspace.contextProvider.status;
    for (const agent of globalWs.resolved.agents) {
      if (!agent.runtime) continue;
      const agentName = agent.name;
      try {
        this.agents.registerGlobal(agentName, {
          runtime: agent.runtime,
          getState: () => {
            const ws = statusStore.getCached(agentName)?.status;
            if (!ws || ws === "idle") return "idle";
            if (ws === "running") return "processing";
            return "stopped";
          },
        });
      } catch (err) {
        console.error(`[daemon] failed to register global agent "${agentName}":`, err);
      }
    }
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

  private async handleRequest(req: Request, remoteAddress?: string): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Auth check — skip for local connections (127.0.0.1 / localhost)
    const isApiPath =
      path.startsWith("/agents") ||
      path.startsWith("/workspaces") ||
      path.startsWith("/events") ||
      path === "/health" ||
      path === "/shutdown";
    if (isApiPath && path !== "/health") {
      const trustedRemote =
        isLoopbackAddress(remoteAddress) ||
        (this.config.trustTailscale && isTailscaleAddress(remoteAddress));
      if (!trustedRemote) {
        const authHeader = req.headers.get("authorization");
        const token = authHeader?.replace("Bearer ", "");
        if (token !== this.config.token) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
      }
    }

    try {
      // Health
      if (path === "/health" && method === "GET") {
        return await this.handleHealth();
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
        if (sub === "/events/stream" && method === "GET")
          return this.handleAgentEventsStream(name, url);
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
          return this.handleWorkspaceEventsStream(key, url);
        }
        if (sub === "/tasks" && method === "GET") {
          return await this.handleWorkspaceTasks(key, url);
        }
        if (sub === "/tasks" && method === "POST") {
          return await this.handleCreateTask(key, req);
        }
        const taskMatch = sub.match(/^\/tasks\/([^/]+)$/);
        if (taskMatch) {
          const taskId = decodeURIComponent(taskMatch[1]!);
          if (method === "GET") return await this.handleWorkspaceTask(key, taskId);
          if (method === "POST") return await this.handleUpdateTask(key, taskId, req);
        }
        const dispatchMatch = sub.match(/^\/tasks\/([^/]+)\/dispatch$/);
        if (dispatchMatch && method === "POST") {
          const taskId = decodeURIComponent(dispatchMatch[1]!);
          return await this.handleDispatchTask(key, taskId, req);
        }
        const completeMatch = sub.match(/^\/tasks\/([^/]+)\/complete$/);
        if (completeMatch && method === "POST") {
          const taskId = decodeURIComponent(completeMatch[1]!);
          return await this.handleCloseTask(key, taskId, req, "completed");
        }
        const abortMatch = sub.match(/^\/tasks\/([^/]+)\/abort$/);
        if (abortMatch && method === "POST") {
          const taskId = decodeURIComponent(abortMatch[1]!);
          return await this.handleCloseTask(key, taskId, req, "aborted");
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
          if (method === "DELETE") {
            return await this.handleClearChannel(key, ch);
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
        return this.handleEventsStream(url);
      }

      // No API route matched — serve static files (SPA)
      return await this.serveStaticOrFallback(path);
    } catch (err) {
      console.error("[daemon] request error:", err);
      return Response.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Health ──────────────────────────────────────────────────────────────

  private async handleHealth(): Promise<Response> {
    const claudeInstalled = await checkCliAvailability("claude");
    const codexInstalled = await checkCliAvailability("codex");
    const cursorInstalled = await checkCliAvailability("agent");
    const claudeAuth = claudeInstalled.available
      ? await checkClaudeCodeAuth()
      : { authenticated: false };
    const codexAuth = codexInstalled.available ? await checkCodexAuth() : { authenticated: false };
    const aiSdkModel = detectAiSdkModel();

    return Response.json({
      status: "ok",
      pid: process.pid,
      uptime: Date.now() - this.startedAt,
      agents: this.agents.size,
      workspaces: this.workspaces.size,
      runtimes: [
        {
          name: "ai-sdk",
          status: aiSdkModel ? aiSdkModel : "not configured",
          available: Boolean(aiSdkModel),
        },
        {
          name: "claude-code",
          status: !claudeInstalled.available
            ? "not installed"
            : claudeAuth.authenticated
              ? "available"
              : "not authenticated",
          available: claudeInstalled.available && claudeAuth.authenticated,
        },
        {
          name: "codex",
          status: !codexInstalled.available
            ? "not installed"
            : codexAuth.authenticated
              ? "available"
              : "not authenticated",
          available: codexInstalled.available && codexAuth.authenticated,
        },
        {
          name: "cursor",
          status: cursorInstalled.available ? "available" : "not installed",
          available: cursorInstalled.available,
        },
        {
          name: "mock",
          status: "built-in",
          available: true,
        },
      ],
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
      // Ensure "ai-sdk" missing model falls back to best available provider
      // (vs hard-coding anthropic inside createLoopFromConfig).
      const resolved = await resolveRuntime(body.runtime.type, body.runtime.model);
      const runtimeForLoop: RuntimeConfig = {
        ...body.runtime,
        type: resolved.runtime as RuntimeConfig["type"],
        ...(resolved.model ? { model: resolved.model } : {}),
      };

      const loop = await createLoopFromConfig(runtimeForLoop);
      const handle = await this.agents.create({
        name: body.name,
        instructions: body.runtime.instructions,
        loop,
        kind: "ephemeral",
        runtime: runtimeForLoop.type,
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

    // Global agents are backed by workspace loops — route messages through
    // the global workspace channel so the WorkspaceAgentLoop processes them.
    if (handle instanceof GlobalAgentStub) {
      const globalWs = this.workspaces.get("global");
      if (globalWs) {
        let sent = 0;
        for (const msg of body.messages) {
          if (msg.delayMs && msg.delayMs > 0) {
            await new Promise((r) => setTimeout(r, msg.delayMs));
          }
          const from = msg.from ?? "user";
          await globalWs.workspace.contextProvider.send({
            channel: globalWs.defaultChannel,
            from,
            content: msg.content,
            to: name,
          });
          sent++;
        }
        return Response.json({ sent, routed_to: `workspace:global` });
      }
    }

    // Non-global agents: push directly to the standalone agent.
    const managed = handle as ManagedAgent;
    let sent = 0;
    for (const msg of body.messages) {
      if (msg.delayMs && msg.delayMs > 0) {
        await new Promise((r) => setTimeout(r, msg.delayMs));
      }
      managed.push({ content: msg.content, from: msg.from });
      sent++;
    }

    return Response.json({ sent, state: managed.state });
  }

  private async handleAgentResponses(name: string, url: URL): Promise<Response> {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }

    // Global agents: read responses from all workspace channels.
    if (handle instanceof GlobalAgentStub) {
      const globalWs = this.workspaces.get("global");
      if (globalWs) {
        const channels = globalWs.workspace.contextProvider.channels.listChannels();
        const allMessages = [];
        for (const ch of channels) {
          const msgs = await globalWs.workspace.contextProvider.channels.read(ch);
          allMessages.push(...msgs.filter((m) => m.from === name));
        }
        allMessages.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        const agentMessages = allMessages.map((m) => ({
          ts: new Date(m.timestamp).getTime(),
          type: "text",
          text: m.content,
          channel: m.channel,
        }));
        const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
        const entries = agentMessages.slice(cursor);
        return Response.json({ entries, cursor: cursor + entries.length });
      }
    }

    const managed = handle as ManagedAgent;
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const result = await managed.readResponses(cursor);
    return Response.json(result);
  }

  private handleAgentResponsesStream(name: string, url: URL): Response {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }

    // Global agents: stream responses from the workspace channel instead
    // of the standalone agent's responses.jsonl (which won't receive data).
    if (handle instanceof GlobalAgentStub) {
      const globalWs = this.workspaces.get("global");
      if (globalWs) {
        const initialCursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
        return this.createSSEStream(async (push) => {
          // Track seen message IDs for dedup against live listener
          const seenIds = new Set<string>();

          // 1. Subscribe to live messages first, buffer until backlog is sent
          const buffer: any[] = [];
          let flushing = false;
          const listener = (msg: any) => {
            if (msg.from !== name) return;
            const entry = {
              ts: Date.now(),
              type: "text",
              text: msg.content,
              channel: msg.channel,
            };
            if (flushing) {
              const msgId = msg.id ?? `${msg.timestamp}-${crypto.randomUUID()}`;
              if (!seenIds.has(msgId)) {
                seenIds.add(msgId);
                push(entry);
              }
            } else {
              buffer.push({ entry, msg });
            }
          };
          globalWs.workspace.contextProvider.channels.on("message", listener);

          // 2. Read backlog from workspace channels (same as REST handler)
          const channels = globalWs.workspace.contextProvider.channels.listChannels();
          const allMessages: any[] = [];
          for (const ch of channels) {
            const msgs = await globalWs.workspace.contextProvider.channels.read(ch);
            allMessages.push(...msgs.filter((m: any) => m.from === name));
          }
          allMessages.sort(
            (a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );
          const backlog = allMessages.slice(initialCursor);
          for (const m of backlog) {
            const msgId = m.id ?? `${m.timestamp}-${crypto.randomUUID()}`;
            seenIds.add(msgId);
            push({
              ts: new Date(m.timestamp).getTime(),
              type: "text",
              text: m.content,
              channel: m.channel,
            });
          }

          // 3. Flush buffer, dedup against backlog
          for (const { entry, msg } of buffer) {
            const msgId = msg.id ?? `${msg.timestamp}-${crypto.randomUUID()}`;
            if (!seenIds.has(msgId)) {
              seenIds.add(msgId);
              push(entry);
            }
          }

          // 4. Switch to direct push mode
          flushing = true;
          buffer.length = 0;

          return () => {
            globalWs.workspace.contextProvider.channels.off("message", listener);
          };
        });
      }
    }

    const managed = handle as ManagedAgent;
    const initialCursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    return this.createSSEStream((push) => {
      let cursor = initialCursor;
      const interval = setInterval(async () => {
        try {
          const result = await managed.readResponses(cursor);
          for (const entry of result.entries) {
            push(entry);
          }
          cursor = result.cursor;
        } catch (err) {
          console.warn(`[daemon] response poll error for agent "${name}":`, err);
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

    // Global agents: filter daemon event log by agent name.
    if (handle instanceof GlobalAgentStub) {
      const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
      const result = await this.eventLog.read(cursor);
      const entries = result.entries.filter((e: any) => e.agent === name);
      return Response.json({ entries, cursor: result.cursor });
    }

    const managed = handle as ManagedAgent;
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const result = await managed.readEvents(cursor);
    return Response.json(result);
  }

  private handleAgentEventsStream(name: string, url: URL): Response {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }

    const initialCursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);

    // Global agents: stream from daemon event log filtered by agent name.
    if (handle instanceof GlobalAgentStub) {
      return this.createSSEStream((push) => {
        let cursor = initialCursor;
        const interval = setInterval(async () => {
          try {
            const result = await this.eventLog.read(cursor);
            for (const entry of result.entries) {
              if ((entry as any).agent === name) push(entry);
            }
            cursor = result.cursor;
          } catch (err) {
            console.warn(`[daemon] event poll error for agent "${name}":`, err);
          }
        }, 500);
        return () => clearInterval(interval);
      });
    }

    const managed = handle as ManagedAgent;
    return this.createSSEStream((push) => {
      let cursor = initialCursor;
      const interval = setInterval(async () => {
        try {
          const result = await managed.readEvents(cursor);
          for (const entry of result.entries) {
            push(entry);
          }
          cursor = result.cursor;
        } catch (err) {
          console.warn(`[daemon] event poll error for agent "${name}":`, err);
        }
      }, 500);
      return () => clearInterval(interval);
    });
  }

  private async handleAgentState(name: string): Promise<Response> {
    const handle = this.agents.get(name);
    if (!handle) {
      return Response.json({ error: `Agent "${name}" not found` }, { status: 404 });
    }

    // Global agents: read state from the workspace.
    if (handle instanceof GlobalAgentStub) {
      const globalWs = this.workspaces.get("global");
      if (globalWs) {
        const provider = globalWs.workspace.contextProvider;
        const statusEntry = (await provider.status.getAll()).find((s) => s.name === name);
        const inboxEntries = await provider.inbox.inspect(name);
        const inbox = [];
        for (const entry of inboxEntries) {
          const msg = await provider.channels.getMessage(entry.channel, entry.messageId);
          if (msg) {
            inbox.push({
              id: entry.messageId,
              status: entry.state,
              from: msg.from,
              content: msg.content,
              channel: entry.channel,
              priority: entry.priority,
            });
          }
        }
        return Response.json({
          state: statusEntry?.status ?? "idle",
          currentTask: statusEntry?.currentTask,
          inbox,
          workspace: "global",
        });
      }
    }

    const managed = handle as ManagedAgent;
    return Response.json({
      state: managed.state,
      inbox: managed.agent.inboxMessages.map((m) => ({
        id: m.id,
        status: m.status,
        from: m.from,
        content: m.content,
        timestamp: m.timestamp,
      })),
      todos: managed.agent.todos.map((t) => ({
        id: t.id,
        status: t.status,
        text: t.text,
      })),
      history: managed.agent.context.length,
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
      name?: string;
      configDir?: string;
      sourcePath?: string;
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
      const status = await handle.checkCompletion();
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
          } catch (err) {
            console.warn(`[daemon] failed to auto-remove task workspace "${key}":`, err);
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
    // - Only agent → direct message via send with `to` field
    // - Both → post to channel with `to` targeting agent
    // - Neither → post to default_channel
    if (body.agent && !body.channel) {
      // Direct message to agent via default channel with `to` field
      const channel = handle.resolved.def.default_channel ?? "general";
      await handle.workspace.contextProvider.send({
        channel,
        from,
        content: body.content,
        to: body.agent,
      });
      return Response.json({ sent: true, routed_to: `agent:${body.agent}` });
    }

    const channel = body.channel ?? handle.resolved.def.default_channel ?? "general";

    if (body.agent) {
      // Post to channel AND target agent
      await handle.workspace.contextProvider.send({
        channel,
        from,
        content: body.content,
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
      label: handle.resolved.def.label,
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
    const entries = await inbox.inspect(agentName);
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

  private async handleClearChannel(key: string, ch: string): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;

    await resolved.workspace.contextProvider.channels.clear(ch);
    return Response.json({ cleared: ch });
  }

  private handleWorkspaceChannelStream(key: string, ch: string, url: URL): Response {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const agent = url.searchParams.get("agent") ?? undefined;

    const channels = handle.workspace.contextProvider.channels;

    const formatMsg = (msg: {
      id: string;
      from: string;
      content: string;
      timestamp: string;
      to?: string;
    }) => ({
      ts: new Date(msg.timestamp).getTime(),
      type: "message",
      channel: ch,
      id: msg.id,
      from: msg.from,
      content: msg.content,
      timestamp: msg.timestamp,
    });

    const matchesAgent = (msg: { from: string; to?: string }) =>
      !agent || msg.from === agent || msg.to === agent;

    return this.createSSEStream(async (push) => {
      const seenIds = new Set<string>();

      // 1. Subscribe first and buffer live messages to avoid the read→subscribe gap
      const buffer: Parameters<typeof formatMsg>[0][] = [];
      let flushing = false;
      const listener = (msg: any) => {
        if (msg.channel !== ch) return;
        if (!matchesAgent(msg)) return;
        if (flushing) {
          if (seenIds.has(msg.id)) return;
          seenIds.add(msg.id);
          push(formatMsg(msg));
        } else {
          buffer.push(msg);
        }
      };
      channels.on("message", listener);

      // 2. Replay backlog from cursor offset
      const history = await channels.read(ch);
      const sliced = history.slice(cursor);
      for (const msg of sliced) {
        if (!matchesAgent(msg)) continue;
        seenIds.add(msg.id);
        push(formatMsg(msg));
      }

      // 3. Flush buffered live messages, deduping against backlog
      flushing = true;
      for (const msg of buffer) {
        if (seenIds.has(msg.id)) continue;
        seenIds.add(msg.id);
        push(formatMsg(msg));
      }
      buffer.length = 0;

      return () => {
        channels.off("message", listener);
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

  private async handleWorkspaceTasks(key: string, url: URL): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const store = handle.workspace.stateStore;
    // `status` accepts a comma-separated filter: ?status=draft,open,in_progress
    const statusParam = url.searchParams.get("status");
    let statusFilter: TaskStatus[] | undefined;
    if (statusParam) {
      const requested = statusParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const unknown = requested.filter((s) => !TASK_STATUS_VALUES.has(s as TaskStatus));
      if (unknown.length > 0) {
        return Response.json(
          { error: `Unknown status values: ${unknown.join(", ")}` },
          { status: 400 },
        );
      }
      statusFilter = requested as TaskStatus[];
    }
    const ownerLeadId = url.searchParams.get("ownerLeadId") ?? undefined;
    const tasks = await store.listTasks({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(ownerLeadId ? { ownerLeadId } : {}),
    });
    return Response.json({ tasks });
  }

  private async handleWorkspaceTask(key: string, taskId: string): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const store = handle.workspace.stateStore;
    const task = await store.getTask(taskId);
    if (!task) {
      return Response.json({ error: `Task ${taskId} not found` }, { status: 404 });
    }
    const [attempts, handoffs, artifacts] = await Promise.all([
      store.listAttempts(taskId),
      store.listHandoffs(taskId),
      store.listArtifacts(taskId),
    ]);
    return Response.json({ task, attempts, handoffs, artifacts });
  }

  private async handleCreateTask(key: string, req: Request): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;
    const store = handle.workspace.stateStore;

    type CreateBody = {
      title?: string;
      goal?: string;
      status?: TaskStatus;
      priority?: number;
      ownerLeadId?: string;
      acceptanceCriteria?: string;
      sourceKind?: string;
      sourceRef?: string;
    };
    let body: CreateBody;
    try {
      body = (await req.json()) as CreateBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const title = (body.title ?? "").trim();
    const goal = (body.goal ?? "").trim();
    if (!title || !goal) {
      return Response.json({ error: "'title' and 'goal' are required" }, { status: 400 });
    }
    if (body.status && !TASK_STATUS_VALUES.has(body.status)) {
      return Response.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }

    const task = await store.createTask({
      workspaceId: handle.workspace.name,
      title,
      goal,
      status: body.status,
      priority: body.priority,
      ownerLeadId: body.ownerLeadId,
      acceptanceCriteria: body.acceptanceCriteria,
      sourceRefs: [
        {
          kind: body.sourceKind ?? "user",
          ref: body.sourceRef,
          ts: Date.now(),
        },
      ],
    });
    return Response.json({ task });
  }

  private async handleUpdateTask(key: string, taskId: string, req: Request): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;
    const store = handle.workspace.stateStore;

    const existing = await store.getTask(taskId);
    if (!existing) {
      return Response.json({ error: `Task ${taskId} not found` }, { status: 404 });
    }

    type UpdateBody = {
      title?: string;
      goal?: string;
      status?: TaskStatus;
      priority?: number;
      ownerLeadId?: string;
      acceptanceCriteria?: string;
    };
    let body: UpdateBody;
    try {
      body = (await req.json()) as UpdateBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.status && !TASK_STATUS_VALUES.has(body.status)) {
      return Response.json({ error: `Invalid status: ${body.status}` }, { status: 400 });
    }

    const patch: Parameters<typeof store.updateTask>[1] = {};
    if (body.title !== undefined) patch.title = body.title.trim();
    if (body.goal !== undefined) patch.goal = body.goal.trim();
    if (body.status !== undefined) patch.status = body.status;
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.ownerLeadId !== undefined) patch.ownerLeadId = body.ownerLeadId;
    if (body.acceptanceCriteria !== undefined) patch.acceptanceCriteria = body.acceptanceCriteria;

    const task = await store.updateTask(taskId, patch);
    return Response.json({ task });
  }

  private async handleDispatchTask(key: string, taskId: string, req: Request): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;
    const store = handle.workspace.stateStore;

    type DispatchBody = { worker?: string; priority?: "immediate" | "normal" | "background" };
    let body: DispatchBody;
    try {
      body = (await req.json()) as DispatchBody;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const worker = (body.worker ?? "").trim();
    if (!worker) {
      return Response.json({ error: "'worker' is required" }, { status: 400 });
    }

    const task = await store.getTask(taskId);
    if (!task) {
      return Response.json({ error: `Task ${taskId} not found` }, { status: 404 });
    }
    if (task.status === "completed" || task.status === "aborted" || task.status === "failed") {
      return Response.json({ error: `Task ${taskId} is already ${task.status}` }, { status: 409 });
    }
    if (task.activeAttemptId) {
      return Response.json(
        {
          error: `Task ${taskId} already has an active attempt: ${task.activeAttemptId}`,
        },
        { status: 409 },
      );
    }

    let attempt;
    try {
      attempt = await store.createAttempt({
        taskId: task.id,
        agentName: worker,
        role: "worker",
      });
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : String(err) },
        { status: 400 },
      );
    }

    await store.updateTask(task.id, {
      activeAttemptId: attempt.id,
      status: task.status === "draft" || task.status === "open" ? "in_progress" : task.status,
    });

    const { nanoid: makeId } = await import("@agent-worker/workspace");
    const priority = body.priority ?? "normal";
    const content = [
      `You have been assigned task [${task.id}] by the user via HTTP dispatch.`,
      "",
      `**Title:** ${task.title}`,
      `**Goal:** ${task.goal}`,
      task.acceptanceCriteria ? `**Acceptance criteria:** ${task.acceptanceCriteria}` : null,
      "",
      `Attempt id: ${attempt.id}. When finished, call attempt_update with the terminal status ` +
        `and handoff_create with a structured summary. Register concrete outputs via artifact_create.`,
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    handle.workspace.instructionQueue.enqueue({
      id: makeId(),
      agentName: worker,
      messageId: `http-dispatch:${attempt.id}`,
      channel: "dispatch",
      content,
      priority,
      enqueuedAt: new Date().toISOString(),
    });

    return Response.json({ task: await store.getTask(task.id), attempt });
  }

  /**
   * Close a task with either "completed" or "aborted" status in one shot.
   *
   * - If the task has an active attempt, marks it as completed/cancelled,
   *   stamps endedAt, and clears activeAttemptId (via the store's usual
   *   bookkeeping on terminal statuses).
   * - Records a handoff of the matching kind on behalf of the "user" so
   *   the timeline shows why it was closed.
   * - Transitions the task to the requested terminal status.
   *
   * Body accepts an optional { summary, reason } string. Either is used as
   * the handoff summary — if both are absent, a generic message is used.
   */
  private async handleCloseTask(
    key: string,
    taskId: string,
    req: Request,
    kind: "completed" | "aborted",
  ): Promise<Response> {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;
    const store = handle.workspace.stateStore;

    const task = await store.getTask(taskId);
    if (!task) {
      return Response.json({ error: `Task ${taskId} not found` }, { status: 404 });
    }
    if (task.status === "completed" || task.status === "aborted" || task.status === "failed") {
      return Response.json({ error: `Task ${taskId} is already ${task.status}` }, { status: 409 });
    }

    type CloseBody = { summary?: string; reason?: string };
    let body: CloseBody = {};
    try {
      body = (await req.json()) as CloseBody;
    } catch {
      // Allow empty body.
    }
    const summary =
      body.summary ??
      body.reason ??
      (kind === "completed" ? "Closed by user via HTTP" : "Aborted by user via HTTP");

    // If there is an active attempt, finalize it first so the handoff
    // references a real fromAttemptId. Only stamp the attempt if it is
    // still running — a race where the agent self-reported via MCP in
    // between getTask() and getAttempt() should not overwrite the agent's
    // own terminal status / resultSummary.
    //
    // NOTE: this sequence (updateAttempt → clear activeAttemptId →
    // createHandoff → updateTask) is not transactional. A crash between
    // steps can leave inconsistent state — specifically between steps 1
    // and 2 leaves an orphaned active-attempt pointer that would block a
    // subsequent dispatch. Accepted gap for early development; see
    // docs/handoffs/2026-04-13-loop-session-final.md (remaining work #5).
    let fromAttemptId: string | undefined;
    if (task.activeAttemptId) {
      const currentAttempt = await store.getAttempt(task.activeAttemptId);
      if (currentAttempt && currentAttempt.status === "running") {
        fromAttemptId = currentAttempt.id;
        await store.updateAttempt(fromAttemptId, {
          status: kind === "completed" ? "completed" : "cancelled",
          resultSummary: summary,
          endedAt: Date.now(),
        });
        // Clear the activeAttemptId so the next snapshot is consistent.
        await store.updateTask(task.id, { activeAttemptId: undefined });
      } else if (currentAttempt) {
        // Attempt already terminal — record it as the handoff source but
        // don't re-stamp anything. Also clear the orphaned pointer.
        fromAttemptId = currentAttempt.id;
        await store.updateTask(task.id, { activeAttemptId: undefined });
      }
    }

    if (fromAttemptId) {
      try {
        await store.createHandoff({
          taskId: task.id,
          fromAttemptId,
          createdBy: "user",
          kind,
          summary,
        });
      } catch (err) {
        // Handoff persistence failing shouldn't block the status change;
        // log and continue.
        await handle.workspace.eventLog.log(
          "user",
          "system",
          `close handoff failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await store.updateTask(task.id, { status: kind });

    const [refreshedTask, attempts, handoffs] = await Promise.all([
      store.getTask(task.id),
      store.listAttempts(task.id),
      store.listHandoffs(task.id),
    ]);
    return Response.json({ task: refreshedTask, attempts, handoffs });
  }

  private handleWorkspaceEventsStream(key: string, url: URL): Response {
    const resolved = this.resolveWorkspace(key);
    if (resolved instanceof Response) return resolved;
    const handle = resolved;

    const cursorParam = url.searchParams.get("cursor");
    const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;
    const wsKey = handle.key;

    return this.createSSEStream(async (push) => {
      // 1. Subscribe to live bus first, buffer events to avoid gap
      const buffer: BusEvent[] = [];
      let flushing = false;
      const unsub = this._bus.on((event: BusEvent) => {
        if (event.workspace !== wsKey) return;
        if (flushing) {
          push({ ...event, ts: Date.now() });
        } else {
          buffer.push(event);
        }
      });

      // 2. Read and push backlog
      if (cursor !== undefined) {
        const { entries } = await this.eventLog.read(cursor);
        const pushedSet = new Set<string>();
        for (const entry of entries) {
          if (entry.workspace === wsKey) {
            push(entry);
            pushedSet.add(JSON.stringify(entry));
          }
        }

        // 3. Flush buffer, dedup against backlog
        for (const evt of buffer) {
          const key = JSON.stringify(evt);
          if (!pushedSet.has(key)) push({ ...evt, ts: Date.now() });
        }
      } else {
        // No cursor — flush any buffered events directly
        for (const evt of buffer) push({ ...evt, ts: Date.now() });
      }

      // 4. Switch to direct push mode
      flushing = true;
      buffer.length = 0;

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

  private handleEventsStream(url: URL): Response {
    const cursorParam = url.searchParams.get("cursor");
    const cursor = cursorParam ? parseInt(cursorParam, 10) : undefined;

    return this.createSSEStream(async (push) => {
      // 1. Subscribe to live bus first, buffer events to avoid gap
      const buffer: BusEvent[] = [];
      let flushing = false;
      const unsub = this._bus.on((event: BusEvent) => {
        if (flushing) {
          push({ ...event, ts: Date.now() });
        } else {
          buffer.push(event);
        }
      });

      // 2. Read and push backlog
      if (cursor !== undefined) {
        const { entries } = await this.eventLog.read(cursor);
        const pushedSet = new Set<string>();
        for (const entry of entries) {
          push(entry);
          pushedSet.add(JSON.stringify(entry));
        }

        // 3. Flush buffer, dedup against backlog
        for (const evt of buffer) {
          const key = JSON.stringify(evt);
          if (!pushedSet.has(key)) push({ ...evt, ts: Date.now() });
        }
      } else {
        // No cursor — flush any buffered events directly
        for (const evt of buffer) push({ ...evt, ts: Date.now() });
      }

      // 4. Switch to direct push mode
      flushing = true;
      buffer.length = 0;

      return unsub;
    });
  }

  // ── Static file serving (SPA) ───────────────────────────────────────────

  private static readonly MIME_MAP: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
  };

  private async serveStaticOrFallback(path: string): Promise<Response> {
    const distDir = this.config.webDistDir;

    // Sanitize: reject path traversal
    const normalized = normalize(path);
    if (normalized.includes("..")) {
      return Response.json({ error: "Invalid path" }, { status: 400 });
    }

    // Strip leading slash and resolve against dist dir
    const relPath = normalized.replace(/^\/+/, "") || "index.html";
    const filePath = join(distDir, relPath);

    // Ensure resolved path is within dist dir (use separator boundary to prevent prefix bypass)
    const boundary = distDir.endsWith(sep) ? distDir : distDir + sep;
    if (!filePath.startsWith(boundary)) {
      return Response.json({ error: "Invalid path" }, { status: 400 });
    }

    // Try serving the requested file
    const served = await this.tryServeFile(filePath);
    if (served) return served;

    // SPA fallback: serve index.html
    const indexPath = join(distDir, "index.html");
    const indexServed = await this.tryServeFile(indexPath);
    if (indexServed) return indexServed;

    // Web UI not built
    return Response.json({ error: "Web UI not found. Run the web build first." }, { status: 404 });
  }

  private async tryServeFile(filePath: string): Promise<Response | null> {
    try {
      const s = await stat(filePath);
      if (!s.isFile()) return null;
    } catch {
      return null;
    }

    const ext = filePath.slice(filePath.lastIndexOf("."));
    const contentType = Daemon.MIME_MAP[ext] ?? "application/octet-stream";
    const body = await readFile(filePath);

    return new Response(body, {
      headers: { "Content-Type": contentType },
    });
  }

  // ── SSE helper ─────────────────────────────────────────────────────────

  /**
   * Create an SSE response. The setup function receives a push callback
   * and returns a cleanup function.
   */
  private createSSEStream(
    setup: (push: (data: unknown) => void) => (() => void) | void | Promise<(() => void) | void>,
  ): Response {
    let cleanup: (() => void) | void;
    const stream = new ReadableStream({
      async start(controller) {
        const push = (data: unknown) => {
          try {
            controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
          } catch {
            // Expected when client disconnects — not an error
          }
        };
        cleanup = await setup(push);
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
