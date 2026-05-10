/**
 * Harness MCP Hub — exposes harness tools via HTTP MCP protocol.
 *
 * A single HTTP server per harness with two endpoint types:
 * - /mcp/:agentName — collaboration tools scoped to the agent's identity
 * - /mcp/$supervisor — supervisor tools (debug + all-channel inbox)
 *
 * Each client connection gets its own McpServer+transport pair, keyed by
 * session ID. This allows multiple clients to connect to the same endpoint.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { z } from "zod";
import type { Harness } from "./harness.ts";
import type { Instruction, TimelineEvent } from "./types.ts";
import { createHarnessTools, HARNESS_TOOL_DEFS } from "./context/mcp/server.ts";

type ToolDef = {
  description: string;
  parameters: Record<string, { type: string; description?: string }>;
  required: readonly string[];
};

interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

export interface HarnessMcpHubOptions {
  /** Port to listen on. Default: 0 (OS-assigned). */
  port?: number;
  /** Host to bind to. Default: "127.0.0.1". */
  host?: string;
  /** Storage directory for reading run logs. If omitted, activity_detail is unavailable. */
  storageDir?: string;
  /** Pause a specific agent's orchestrator loop. */
  pauseAgent?: (name: string) => Promise<void>;
  /** Resume a specific agent's orchestrator loop. */
  resumeAgent?: (name: string) => Promise<void>;
  /** Pause all agent orchestrator loops. */
  pauseAll?: () => Promise<void>;
  /** Resume all agent orchestrator loops. */
  resumeAll?: () => Promise<void>;
  /** Check if a specific agent is paused. */
  isAgentPaused?: (name: string) => boolean;
}

/**
 * MCP server that exposes a harness's collaboration tools and debug tools.
 *
 * - Agents connect to `http://host:port/mcp/:agentName` — collaboration tools
 * - Debug clients connect to `http://host:port/mcp/$supervisor` — read-only inspection
 *
 * If the agent is not yet registered in the harness, it is auto-registered
 * on first connection with default channel membership.
 */
export class HarnessMcpHub {
  private httpServer: Server | null = null;
  /** sessionId → McpSession for all active client connections. */
  private sessions = new Map<string, McpSession>();
  private _port: number | null = null;
  private _storageDir: string | undefined;
  private _pauseCallbacks: Pick<
    HarnessMcpHubOptions,
    "pauseAgent" | "resumeAgent" | "pauseAll" | "resumeAll" | "isAgentPaused"
  > = {};

  constructor(private harness: Harness) {}

  get port(): number | null {
    return this._port;
  }

  get url(): string | null {
    return this._port ? `http://127.0.0.1:${this._port}` : null;
  }

  /** Build the MCP URL for a specific agent. */
  agentUrl(agentName: string): string | null {
    return this._port ? `http://127.0.0.1:${this._port}/mcp/${agentName}` : null;
  }

  /** Build the MCP URL for an external MCP user. The $prefix triggers debug mode. */
  externalUrl(name: string): string | null {
    return this._port ? `http://127.0.0.1:${this._port}/mcp/$${name}` : null;
  }

  /** @deprecated Use externalUrl(). Kept for backward compat. */
  get debugUrl(): string | null {
    return this.externalUrl("supervisor");
  }

  async start(opts?: HarnessMcpHubOptions): Promise<void> {
    this._storageDir = opts?.storageDir;
    this._pauseCallbacks = {
      pauseAgent: opts?.pauseAgent,
      resumeAgent: opts?.resumeAgent,
      pauseAll: opts?.pauseAll,
      resumeAll: opts?.resumeAll,
      isAgentPaused: opts?.isAgentPaused,
    };

    this.httpServer = createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const match = url.pathname.match(/^\/mcp\/([^/]+)/);

      if (!match) {
        if (url.pathname === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", harness: this.harness.name }));
          return;
        }
        res.writeHead(404).end("Not found. Use /mcp/:agentName or /mcp/$supervisor");
        return;
      }

      const name = decodeURIComponent(match[1]!);

      try {
        await this.routeRequest(name, req, res);
      } catch (err) {
        console.error(`[harness-mcp:${name}] error:`, err);
        if (!res.headersSent) res.writeHead(500).end();
      }
    });

    const port = opts?.port ?? 0;
    const host = opts?.host ?? "127.0.0.1";

    await new Promise<void>((resolve, reject) => {
      this.httpServer!.once("error", reject);
      this.httpServer!.listen({ host, port }, () => {
        this.httpServer!.removeListener("error", reject);
        resolve();
      });
    });

    const addr = this.httpServer.address();
    if (!addr || typeof addr === "string") throw new Error("Harness MCP: no address");
    this._port = addr.port;
  }

  /** List all connected agent names (excludes external mcp: users). */
  connectedAgents(): string[] {
    const names = new Set<string>();
    for (const [, session] of this.sessions) {
      const n = (session as any)._endpointName as string | undefined;
      if (n && !n.startsWith("mcp:")) names.add(n);
    }
    return Array.from(names);
  }

  async stop(): Promise<void> {
    for (const [, session] of this.sessions) {
      try {
        await session.server.close();
      } catch {
        /* ignore */
      }
    }
    this.sessions.clear();

    if (this.httpServer) {
      const s = this.httpServer;
      this.httpServer = null;
      this._port = null;
      await new Promise<void>((r) => s.close(() => r()));
    }
  }

  // ── Request routing ──────────────────────────────────────────────────

  private async routeRequest(
    endpointName: string,
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Check for existing session via header
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (sessionId) {
      const existing = this.sessions.get(sessionId);
      if (existing) {
        await existing.transport.handleRequest(req, res);
        return;
      }
      // Unknown/stale session ID — tell client to re-initialize (MCP spec: 404)
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Session not found" },
          id: null,
        }),
      );
      return;
    }

    // No session header — must be an initialize request.
    if (req.method !== "POST") {
      res.writeHead(400).end("Expected POST for initialization");
      return;
    }

    // Create new session for this client
    const session = await this.createSession(endpointName);
    await session.transport.handleRequest(req, res);
  }

  private async createSession(endpointName: string): Promise<McpSession> {
    // $xxx → external MCP user, registered as "mcp:xxx"
    const isExternal = endpointName.startsWith("$");
    const agentName = isExternal ? `mcp:${endpointName.slice(1)}` : endpointName;

    // Three paths:
    // 1. External ($-prefixed) → debug server (mcp: prefix, all channels, debug tools)
    // 2. Lead agent → agent server + debug tools (real agent name, all channels)
    // 3. Regular agent → agent server only
    const isLead = !isExternal && this.harness.isLead(agentName);
    const server = isExternal
      ? await this.createDebugServer(agentName)
      : isLead
        ? await this.createLeadServer(agentName)
        : await this.createAgentServer(agentName);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    // Track session by ID after transport assigns it
    transport.onclose = () => {
      if (transport.sessionId) {
        this.sessions.delete(transport.sessionId);
      }
    };

    await server.connect(transport);

    const session: McpSession = { server, transport };
    // Tag with agent name for connectedAgents()
    (session as any)._endpointName = agentName;

    // The session ID is assigned after the first handleRequest (initialize),
    // so we defer registration via a microtask that checks after init.
    const origHandleRequest = transport.handleRequest.bind(transport);
    transport.handleRequest = async (req, res) => {
      await origHandleRequest(req, res);
      if (transport.sessionId && !this.sessions.has(transport.sessionId)) {
        this.sessions.set(transport.sessionId, session);
      }
    };

    return session;
  }

  // ── Agent server factory ─────────────────────────────────────────────

  private async createAgentServer(agentName: string): Promise<McpServer> {
    if (!this.harness.hasAgent(agentName)) {
      await this.harness.registerAgent(agentName);
    }

    const server = new McpServer({
      name: `harness-${this.harness.name}-${agentName}`,
      version: "0.0.1",
    });

    const agentChannels = this.harness.getAgentChannels(agentName);
    const tools = createHarnessTools(
      agentName,
      this.harness.contextProvider,
      agentChannels,
      (name) => (this.harness.hasAgent(name) ? this.harness.getAgentChannels(name) : undefined),
      {
        stateStore: this.harness.stateStore,
        harnessName: this.harness.name,
        instructionQueue: this.harness.instructionQueue,
        harnessTypeRegistry: this.harness.harnessTypeRegistry,
        harnessTypeId: this.harness.harnessTypeId,
      },
    );

    const defs = HARNESS_TOOL_DEFS as Record<string, ToolDef>;
    for (const [name, fn] of Object.entries(tools)) {
      const def = defs[name];
      if (!def) continue;

      const requiredSet = new Set(def.required);
      const params = buildZodParams(def.parameters, requiredSet);
      const handler = async (args: Record<string, unknown>) => {
        const text = await fn(args);
        return { content: [{ type: "text" as const, text }] };
      };

      if (Object.keys(params).length > 0) {
        server.tool(name, def.description, params, handler);
      } else {
        server.tool(name, def.description, handler);
      }
    }

    return server;
  }

  // ── Lead server factory ──────────────────────────────────────────────

  private async createLeadServer(agentName: string): Promise<McpServer> {
    // Lead is a real agent (auto-registered with all channels via harness.registerAgent)
    const server = await this.createAgentServer(agentName);
    this.registerDebugTools(server);
    return server;
  }

  // ── Debug server factory ─────────────────────────────────────────────

  private async createDebugServer(name: string): Promise<McpServer> {
    // External MCP user joins ALL channels so it receives every message
    if (!this.harness.hasAgent(name)) {
      const allChannels = this.harness.contextProvider.channels.listChannels();
      await this.harness.registerAgent(name, allChannels);
    }

    const server = await this.createAgentServer(name);
    this.registerDebugTools(server);
    return server;
  }

  private registerDebugTools(server: McpServer): void {
    const ws = this.harness;
    const provider = ws.contextProvider;

    // ── agents: overview of all agents ──────────────────────────────────
    server.tool(
      "agents",
      "List all agents with their current status, task, channel subscriptions, and last update time.",
      async () => {
        const entries = await provider.status.getAll();
        if (entries.length === 0) {
          return { content: [{ type: "text", text: "No agents registered." }] };
        }
        const lines = await Promise.all(
          entries.map(async (e) => {
            const paused = this._pauseCallbacks.isAgentPaused?.(e.name);
            const statusStr = paused ? "paused" : e.status;
            const task = e.currentTask ? ` — ${e.currentTask}` : "";
            const channels = ws.getAgentChannels(e.name);
            const chStr = channels.size > 0 ? ` [${[...channels].join(", ")}]` : "";
            const events = await provider.timeline.read(e.name, { limit: 3 });
            const activity = formatRecentActivity(events);
            const actStr = activity ? ` | last: ${activity}` : "";
            return `${e.name}: ${statusStr}${task}${chStr}${actStr}`;
          }),
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    // ── agent_activity: recent activity for a specific agent ────────────
    server.tool(
      "agent_activity",
      "Show recent activity (timeline events) for a specific agent. Returns the last N events including messages, tool calls, and system events.",
      {
        agent: z.string().describe("Agent name"),
        limit: z.number().optional().describe("Max events to return (default 20)"),
      },
      async ({ agent, limit }) => {
        const events = await provider.timeline.read(agent, { limit: limit ?? 20 });
        if (events.length === 0) {
          return { content: [{ type: "text", text: `No activity for agent "${agent}".` }] };
        }
        const lines = events.map((e) => {
          const time = e.timestamp.split("T")[1]?.slice(0, 8) ?? e.timestamp;
          const tool = e.toolCall ? ` [${e.toolCall.name}]` : "";
          const content = e.content.length > 200 ? e.content.slice(0, 200) + "…" : e.content;
          return `${time} ${e.kind}${tool}: ${content}`;
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    // ── activity_detail: full trace of a specific run ───────────────────
    server.tool(
      "activity_detail",
      "Read the detailed JSONL trace of a specific agent run. Requires storageDir to be configured. Returns run metadata, tool calls, responses, and timing.",
      { agent: z.string().describe("Agent name"), run_id: z.string().describe("Run ID (UUID)") },
      async ({ agent, run_id }) => {
        if (!this._storageDir) {
          return {
            content: [{ type: "text", text: "storageDir not configured — run logs unavailable." }],
          };
        }
        const logPath = join(this._storageDir, "agents", agent, "runs", `${run_id}.jsonl`);
        if (!existsSync(logPath)) {
          return { content: [{ type: "text", text: `No run log found at ${logPath}` }] };
        }
        const raw = readFileSync(logPath, "utf-8");
        // Parse and format for readability
        const entries = raw
          .trim()
          .split("\n")
          .map((line) => {
            try {
              return JSON.parse(line) as Record<string, unknown>;
            } catch {
              return { raw: line };
            }
          });
        const lines = entries.map((e) => formatRunEntry(e));
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    // ── events: filtered harness events ───────────────────────────────
    server.tool(
      "events",
      "Query harness events across all agents, with optional filtering by agent name and/or event kind. Returns most recent events first.",
      {
        agent: z.string().optional().describe("Filter by agent name"),
        kind: z
          .string()
          .optional()
          .describe("Filter by event kind (message, tool_call, system, output, debug)"),
        limit: z.number().optional().describe("Max events to return (default 30)"),
      },
      async ({ agent, kind, limit }) => {
        const maxEvents = limit ?? 30;
        const allAgents = await provider.status.getAll();
        const agentNames = agent ? [agent] : allAgents.map((a) => a.name);

        const allEvents: Array<{
          agent: string;
          ts: string;
          kind: string;
          content: string;
          tool?: string;
        }> = [];

        // When filtering by agent, fetch limit directly; otherwise fetch a
        // small per-agent window and merge — avoids over-fetching.
        const perAgentLimit = agent ? maxEvents : Math.min(maxEvents, 50);
        for (const name of agentNames) {
          const events = await provider.timeline.read(name, { limit: perAgentLimit });
          for (const e of events) {
            if (kind && e.kind !== kind) continue;
            allEvents.push({
              agent: e.agentName,
              ts: e.timestamp,
              kind: e.kind,
              content: e.content,
              tool: e.toolCall?.name,
            });
          }
        }

        // Sort by time descending, take limit
        allEvents.sort((a, b) => b.ts.localeCompare(a.ts));
        const result = allEvents.slice(0, maxEvents);

        if (result.length === 0) {
          return { content: [{ type: "text", text: "No matching events." }] };
        }

        const lines = result.map((e) => {
          const time = e.ts.split("T")[1]?.slice(0, 8) ?? e.ts;
          const tool = e.tool ? ` [${e.tool}]` : "";
          const content = e.content.length > 150 ? e.content.slice(0, 150) + "…" : e.content;
          return `${time} @${e.agent} ${e.kind}${tool}: ${content}`;
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    // ── queue: pending instruction queue ────────────────────────────────
    server.tool(
      "queue",
      "Show all pending instructions in the harness queue, grouped by priority.",
      async () => {
        const pending = ws.instructionQueue.listAll();
        if (pending.length === 0) {
          return { content: [{ type: "text", text: "Queue empty — no pending instructions." }] };
        }

        // Group by priority for clearer output
        const byPriority = new Map<string, string[]>();
        for (const i of pending as Instruction[]) {
          const content = i.content.length > 100 ? i.content.slice(0, 100) + "…" : i.content;
          const line = `  @${i.agentName}: ${content} (queued ${i.enqueuedAt})`;
          const group = byPriority.get(i.priority) ?? [];
          group.push(line);
          byPriority.set(i.priority, group);
        }

        const sections: string[] = [`${pending.length} pending:`];
        for (const priority of ["immediate", "normal", "background"]) {
          const lines = byPriority.get(priority);
          if (lines && lines.length > 0) {
            sections.push(`[${priority}] (${lines.length}):`);
            sections.push(...lines);
          }
        }
        return { content: [{ type: "text", text: sections.join("\n") }] };
      },
    );

    // ── harness_info: harness configuration overview ────────────────
    server.tool(
      "harness_info",
      "Show harness configuration: name, channels, agent count, queue settings, and storage paths.",
      async () => {
        const channels = provider.channels.listChannels();
        const agents = await provider.status.getAll();
        const docs = await provider.documents.list();

        const lines = [
          `Harness: ${ws.name}${ws.tag ? ` (tag: ${ws.tag})` : ""}`,
          `Lead: ${ws.lead ?? "none"}`,
          `Default channel: #${ws.defaultChannel}`,
          `Channels: ${channels.join(", ")}`,
          `Agents: ${agents.length} (${agents.map((a) => a.name).join(", ")})`,
          `Documents: ${docs.length}${docs.length > 0 ? ` (${docs.join(", ")})` : ""}`,
          `Queue size: ${ws.instructionQueue.size}`,
          `Storage: ${ws.storageDir ?? "in-memory"}`,
          `Shared sandbox: ${ws.harnessSandboxDir ?? "none"}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    // ── inbox_peek: inspect any agent's inbox ───────────────────────────
    server.tool(
      "inbox_peek",
      "Peek at any agent's inbox to see their pending messages. Unlike my_inbox which only shows your own, this can inspect any agent's inbox for debugging.",
      { agent: z.string().describe("Agent name to inspect") },
      async ({ agent }) => {
        const entries = await provider.inbox.inspect(agent);
        if (entries.length === 0) {
          return { content: [{ type: "text", text: `@${agent} inbox: empty` }] };
        }

        const lines: string[] = [];
        for (const entry of entries) {
          const msg = await provider.channels.getMessage(entry.channel, entry.messageId);
          if (!msg) continue;
          const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
          const state = entry.state !== "pending" ? ` (${entry.state})` : "";
          lines.push(
            `- [${msg.id}] #${entry.channel} from:@${msg.from}${priority}${state}: "${msg.content}"`,
          );
        }
        return {
          content: [
            { type: "text", text: `@${agent} inbox (${lines.length} items):\n${lines.join("\n")}` },
          ],
        };
      },
    );

    // ── pause_agent: pause a specific agent ─────────────────────────────
    server.tool(
      "pause_agent",
      "Pause a specific agent's orchestrator loop. The polling loop keeps running but tick() becomes a no-op.",
      { agent: z.string().describe("Agent name to pause") },
      async ({ agent }) => {
        if (!this._pauseCallbacks.pauseAgent) {
          return {
            content: [
              { type: "text", text: "Pause not available — no orchestrator callbacks configured." },
            ],
          };
        }
        await this._pauseCallbacks.pauseAgent(agent);
        return { content: [{ type: "text", text: `Paused agent "${agent}".` }] };
      },
    );

    // ── resume_agent: resume a specific agent ───────────────────────────
    server.tool(
      "resume_agent",
      "Resume a specific agent's orchestrator loop after a pause.",
      { agent: z.string().describe("Agent name to resume") },
      async ({ agent }) => {
        if (!this._pauseCallbacks.resumeAgent) {
          return {
            content: [
              {
                type: "text",
                text: "Resume not available — no orchestrator callbacks configured.",
              },
            ],
          };
        }
        await this._pauseCallbacks.resumeAgent(agent);
        return { content: [{ type: "text", text: `Resumed agent "${agent}".` }] };
      },
    );

    // ── pause_all: pause all agent loops ────────────────────────────────
    server.tool("pause_all", "Pause all agent orchestrator loops in the harness.", async () => {
      if (!this._pauseCallbacks.pauseAll) {
        return {
          content: [
            { type: "text", text: "Pause not available — no orchestrator callbacks configured." },
          ],
        };
      }
      await this._pauseCallbacks.pauseAll();
      return { content: [{ type: "text", text: "All agents paused." }] };
    });

    // ── resume_all: resume all agent loops ──────────────────────────────
    server.tool("resume_all", "Resume all agent orchestrator loops in the harness.", async () => {
      if (!this._pauseCallbacks.resumeAll) {
        return {
          content: [
            { type: "text", text: "Resume not available — no orchestrator callbacks configured." },
          ],
        };
      }
      await this._pauseCallbacks.resumeAll();
      return { content: [{ type: "text", text: "All agents resumed." }] };
    });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildZodParams(
  params: Record<string, { type: string; description?: string }>,
  required?: Set<string>,
): Record<string, z.ZodTypeAny> {
  const result: Record<string, z.ZodTypeAny> = {};
  for (const [name, param] of Object.entries(params)) {
    let field: z.ZodTypeAny;
    switch (param.type) {
      case "number":
        field = z.coerce.number();
        break;
      case "boolean":
        field = z.coerce.boolean();
        break;
      default:
        field = z.string();
    }
    if (param.description) field = field.describe(param.description);
    if (required && !required.has(name)) {
      field = field.optional();
    }
    result[name] = field;
  }
  return result;
}

/** Format recent timeline events as relative timestamps. */
function formatRecentActivity(events: TimelineEvent[]): string {
  return events
    .slice(-3)
    .reverse()
    .map((ev) => {
      const ago = Math.round((Date.now() - new Date(ev.timestamp).getTime()) / 1000);
      const label = ev.toolCall?.name ?? ev.kind;
      return `${label} (${ago}s ago)`;
    })
    .join(", ");
}

/** Format a single JSONL run log entry for human-readable output. */
function formatRunEntry(entry: Record<string, unknown>): string {
  const type = String(entry.type ?? "unknown");
  switch (type) {
    case "run_start": {
      const runtime = entry.runtime ?? "?";
      const model = entry.model ? ` (${entry.model})` : "";
      const instr = String(entry.instruction ?? "").slice(0, 120);
      const prompt = entry.promptChars ? ` | prompt=${entry.promptChars} chars` : "";
      const tools = entry.toolCount ? ` | tools=${entry.toolCount}` : "";
      return `[start] ${runtime}${model}: ${instr}${prompt}${tools}`;
    }
    case "text":
      return `  [text] ${String(entry.text ?? "").slice(0, 500)}`;
    case "thinking":
      return `  [think] ${String(entry.text ?? "").slice(0, 500)}`;
    case "tool_call_start":
      return `  [call] ${entry.name}(${JSON.stringify(entry.args ?? {}).slice(0, 150)})`;
    case "tool_call_end": {
      const dur = entry.durationMs ? ` ${entry.durationMs}ms` : "";
      const err = entry.error ? ` [error] ${entry.error}` : "";
      const result = String(entry.result ?? "").slice(0, 200);
      return `  [done] ${entry.name}${dur}${err}: ${result}`;
    }
    case "error":
      return `  [error] ${entry.error}`;
    case "run_end": {
      const usage = entry.usage as
        | { inputTokens?: number; outputTokens?: number; totalTokens?: number }
        | undefined;
      const dur = entry.durationMs ? ` ${entry.durationMs}ms` : "";
      const tokens = usage?.totalTokens
        ? ` (${usage.inputTokens}in/${usage.outputTokens}out/${usage.totalTokens}total)`
        : "";
      return `[end] ${entry.status}${dur}${tokens}${entry.error ? `: ${entry.error}` : ""}`;
    }
    default:
      return `  [?] ${JSON.stringify(entry).slice(0, 200)}`;
  }
}
