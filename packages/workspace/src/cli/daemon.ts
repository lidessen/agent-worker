/**
 * Workspace daemon — runs a multi-agent workspace and exposes it via Unix socket.
 *
 * Endpoints:
 *   POST /send     — { channel, from, content, to? }
 *   GET  /status   — workspace state: agents, channels, inbox summaries
 *   GET  /channels — list channels
 *   GET  /channel  — ?name=<channel>&limit=<n> — read channel messages
 *   GET  /inbox    — ?agent=<name> — peek agent inbox
 *   GET  /log      — ?cursor=<byteOffset> — incremental events
 *   POST /stop     — graceful shutdown
 */
import { tmpdir } from "node:os";
import {
  createWorkspace,
  createWiredLoop,
  createAgentTools,
  loadWorkspaceDef,
  toWorkspaceConfig,
} from "../index.ts";
import type { Workspace } from "../workspace.ts";
import type { WorkspaceAgentLoop } from "../loop/loop.ts";
import type { ResolvedWorkspace, ResolvedAgent } from "../config/types.ts";
import type { LoadOptions } from "../config/loader.ts";
import type { Instruction } from "../types.ts";
import { readFrom, parseJsonl, appendJsonl } from "@agent-worker/shared";

export interface WorkspaceDaemonConfig {
  /** Path to workspace YAML file, or raw YAML content. */
  source: string;
  /** Load options (tag, vars, etc.). */
  loadOpts?: LoadOptions;
  /** Directory for output files and socket. Default: OS tmpdir. */
  dataDir?: string;
  /** Unix socket path override. */
  socketPath?: string;
  /** How to create a loop runner for each agent. */
  createRunner?: (
    agent: ResolvedAgent,
    workspace: Workspace,
  ) => (prompt: string, instruction: Instruction) => Promise<void>;
}

export class WorkspaceDaemon {
  private workspace: Workspace | null = null;
  private resolved: ResolvedWorkspace | null = null;
  private loops: WorkspaceAgentLoop[] = [];
  private server: ReturnType<typeof Bun.serve> | null = null;
  private eventsPath: string;
  private socketPath: string;

  constructor(private config: WorkspaceDaemonConfig) {
    const dir = config.dataDir ?? `${tmpdir()}/aw-ws`;
    const suffix = `${process.pid}-${Date.now()}`;
    this.eventsPath = `${dir}/events-${suffix}.jsonl`;
    this.socketPath = config.socketPath ?? `${dir}/ws-${suffix}.sock`;
  }

  async start(): Promise<{
    socketPath: string;
    eventsPath: string;
    resolved: ResolvedWorkspace;
  }> {
    // Ensure data dir exists
    const { mkdirSync } = await import("node:fs");
    mkdirSync(this.config.dataDir ?? `${tmpdir()}/aw-ws`, { recursive: true });

    // Initialize events file
    await Bun.write(this.eventsPath, "");

    // Load workspace definition
    const resolved = await loadWorkspaceDef(this.config.source, this.config.loadOpts);
    this.resolved = resolved;

    // Create workspace
    const wsConfig = toWorkspaceConfig(resolved, this.config.loadOpts);
    const workspace = await createWorkspace(wsConfig);
    this.workspace = workspace;

    // Register agents, ensure sandbox directories, and create loops
    for (const agent of resolved.agents) {
      // Join custom channels
      if (agent.channels?.length) {
        const { tools } = createAgentTools(agent.name, workspace);
        for (const ch of agent.channels) {
          if (ch !== (resolved.def.default_channel ?? "general")) {
            await tools.channel_join({ channel: ch });
          }
        }
      }

      // Ensure sandbox directories exist (once at init, not per-instruction)
      const { dirs } = createAgentTools(agent.name, workspace);
      if (dirs.workspaceSandboxDir) mkdirSync(dirs.workspaceSandboxDir, { recursive: true });
      if (dirs.sandboxDir) mkdirSync(dirs.sandboxDir, { recursive: true });

      const runner = this.config.createRunner
        ? this.config.createRunner(agent, workspace)
        : this.createDefaultRunner(agent);

      const loop = createWiredLoop({
        name: agent.name,
        instructions: agent.instructions,
        runtime: workspace,
        pollInterval: 2000,
        onInstruction: async (prompt, instruction) => {
          this.appendEvent({
            type: "instruction_start",
            agent: agent.name,
            instruction: instruction.content.slice(0, 200),
          });
          try {
            await runner(prompt, instruction);
            this.appendEvent({
              type: "instruction_end",
              agent: agent.name,
              status: "ok",
            });
          } catch (err) {
            this.appendEvent({
              type: "instruction_end",
              agent: agent.name,
              status: "error",
              error: String(err),
            });
          }
        },
      });

      this.loops.push(loop);
    }

    // Start all loops
    for (const loop of this.loops) {
      await loop.start();
    }

    this.appendEvent({
      type: "workspace_started",
      name: resolved.def.name,
      tag: this.config.loadOpts?.tag,
      agents: resolved.agents.map((a) => a.name),
      channels: resolved.def.channels ?? ["general"],
    });

    // Send kickoff message
    if (resolved.kickoff) {
      const defaultChannel = resolved.def.default_channel ?? "general";
      await workspace.contextProvider.smartSend(defaultChannel, "user", resolved.kickoff);
      this.appendEvent({
        type: "kickoff",
        channel: defaultChannel,
        content: resolved.kickoff.slice(0, 200),
      });
    }

    // Start Unix socket server
    await this.startServer();

    return {
      socketPath: this.socketPath,
      eventsPath: this.eventsPath,
      resolved,
    };
  }

  private createDefaultRunner(
    agent: ResolvedAgent,
  ): (prompt: string, instruction: Instruction) => Promise<void> {
    // Default runner: use the resolved loop to process instructions
    return async (prompt, instruction) => {
      if (!agent.runtime || agent.runtime === "mock") {
        // Mock: echo back
        await this.workspace!.contextProvider.smartSend(
          instruction.channel || (this.resolved!.def.default_channel ?? "general"),
          agent.name,
          `[mock] Processed: ${instruction.content.slice(0, 100)}`,
        );
        return;
      }

      // For real runtimes, dynamically create a loop run
      const loop = await this.createAgentLoop(agent);
      if (!loop) {
        this.appendEvent({
          type: "error",
          agent: agent.name,
          error: `No loop available for runtime: ${agent.runtime}`,
        });
        return;
      }

      // Wire workspace tools (sandbox dirs already created at init)
      const { tools } = createAgentTools(agent.name, this.workspace!);
      if (loop.setTools) {
        loop.setTools(tools as any);
      }

      const run = loop.run(prompt);
      for await (const event of run) {
        if (event.type === "text") {
          this.appendEvent({
            type: "agent_text",
            agent: agent.name,
            text: event.text.slice(0, 500),
          });
        } else if (event.type === "tool_call_start") {
          this.appendEvent({
            type: "tool_call",
            agent: agent.name,
            tool: event.name,
          });
        }
      }

      const result = await run.result;
      if (result.events) {
        // Extract final text response
        const textEvents = result.events.filter((e) => e.type === "text");
        if (textEvents.length > 0) {
          const responseText = textEvents.map((e) => (e as any).text).join("");
          // Post response to channel if it's not already handled by tools
          if (responseText.length > 0 && !responseText.includes("channel_send")) {
            await this.workspace!.contextProvider.smartSend(
              instruction.channel || (this.resolved!.def.default_channel ?? "general"),
              agent.name,
              responseText,
            );
          }
        }
      }
    };
  }

  private async createAgentLoop(
    agent: ResolvedAgent,
  ): Promise<import("@agent-worker/loop").AiSdkLoop | null> {
    if (agent.runtime === "ai-sdk" && agent.model) {
      const { AiSdkLoop } = await import("@agent-worker/loop");
      const provider = agent.model.provider ?? "anthropic";
      const modelId = agent.model.id;

      let languageModel;
      switch (provider) {
        case "anthropic": {
          const { anthropic } = await import("@ai-sdk/anthropic");
          languageModel = anthropic(modelId);
          break;
        }
        case "openai": {
          const { openai } = await import("@ai-sdk/openai");
          languageModel = openai(modelId);
          break;
        }
        case "deepseek": {
          const { deepseek } = await import("@ai-sdk/deepseek");
          languageModel = deepseek(modelId);
          break;
        }
        default:
          return null;
      }

      return new AiSdkLoop({
        model: languageModel,
        instructions: agent.instructions,
        includeBashTools: false,
      });
    }

    return null;
  }

  private appendEvent(entry: Record<string, unknown>): void {
    appendJsonl(this.eventsPath, entry);
  }

  private async startServer(): Promise<void> {
    // Clean stale socket
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(this.socketPath);
    } catch {
      /* doesn't exist */
    }

    this.server = Bun.serve({
      unix: this.socketPath,
      fetch: async (req) => {
        const url = new URL(req.url, "http://localhost");
        const path = url.pathname;

        try {
          if (path === "/send" && req.method === "POST") {
            return await this.handleSend(req);
          }
          if (path === "/status" && req.method === "GET") {
            return await this.handleStatus();
          }
          if (path === "/channels" && req.method === "GET") {
            return this.handleChannels();
          }
          if (path === "/channel" && req.method === "GET") {
            return await this.handleChannel(url);
          }
          if (path === "/inbox" && req.method === "GET") {
            return await this.handleInbox(url);
          }
          if (path === "/log" && req.method === "GET") {
            return await this.handleLog(url);
          }
          if (path === "/docs" && req.method === "GET") {
            return await this.handleDocs();
          }
          if (path === "/doc" && req.method === "GET") {
            return await this.handleDocRead(url);
          }
          if (path === "/doc" && req.method === "POST") {
            return await this.handleDocWrite(req);
          }
          if (path === "/stop" && req.method === "POST") {
            return await this.handleStop();
          }
          return Response.json({ error: "Not found" }, { status: 404 });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
    });
  }

  private async handleSend(req: Request): Promise<Response> {
    const body = (await req.json()) as {
      channel?: string;
      from?: string;
      content: string;
      to?: string;
    };

    if (!body.content) {
      return Response.json({ error: "content is required" }, { status: 400 });
    }

    const channel = body.channel ?? this.resolved!.def.default_channel ?? "general";
    const from = body.from ?? "user";

    const msg = await this.workspace!.contextProvider.smartSend(channel, from, body.content, {
      to: body.to,
    });

    return Response.json({ sent: true, messageId: msg.id, channel });
  }

  private async handleStatus(): Promise<Response> {
    const ws = this.workspace!;
    const resolved = this.resolved!;

    const agents = await Promise.all(
      resolved.agents.map(async (a) => {
        const status = await ws.contextProvider.status.get(a.name);
        const inbox = await ws.contextProvider.inbox.peek(a.name);
        return {
          name: a.name,
          runtime: a.runtime,
          model: a.model?.full,
          status: status?.status ?? "unknown",
          currentTask: status?.currentTask,
          inboxCount: inbox.length,
          channels: Array.from(ws.getAgentChannels(a.name)),
        };
      }),
    );

    const channels = ws.contextProvider.channels.listChannels();

    return Response.json({
      name: resolved.def.name,
      tag: this.config.loadOpts?.tag,
      agents,
      channels,
      loops: this.loops.map((l) => ({
        name: l.name,
        running: l.isRunning,
      })),
    });
  }

  private handleChannels(): Response {
    const channels = this.workspace!.contextProvider.channels.listChannels();
    return Response.json({ channels });
  }

  private async handleChannel(url: URL): Promise<Response> {
    const name = url.searchParams.get("name") ?? "general";
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
    const messages = await this.workspace!.contextProvider.channels.read(name, { limit });
    return Response.json({
      channel: name,
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

  private async handleInbox(url: URL): Promise<Response> {
    const agent = url.searchParams.get("agent");
    if (!agent) {
      return Response.json({ error: "agent parameter required" }, { status: 400 });
    }
    const entries = await this.workspace!.contextProvider.inbox.peek(agent);

    // Resolve message content for each entry
    const resolved = await Promise.all(
      entries.map(async (e) => {
        const msg = await this.workspace!.contextProvider.channels.getMessage(
          e.channel,
          e.messageId,
        );
        return {
          messageId: e.messageId,
          channel: e.channel,
          priority: e.priority,
          state: e.state,
          from: msg?.from,
          content: msg?.content,
          enqueuedAt: e.enqueuedAt,
        };
      }),
    );

    return Response.json({ agent, entries: resolved });
  }

  private async handleLog(url: URL): Promise<Response> {
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const { data, cursor: newCursor } = await readFrom(this.eventsPath, cursor);
    return Response.json({ entries: parseJsonl(data), cursor: newCursor });
  }

  private async handleDocs(): Promise<Response> {
    const docs = await this.workspace!.contextProvider.documents.list();
    return Response.json({ docs });
  }

  private async handleDocRead(url: URL): Promise<Response> {
    const name = url.searchParams.get("name");
    if (!name) {
      return Response.json({ error: "name parameter required" }, { status: 400 });
    }
    const content = await this.workspace!.contextProvider.documents.read(name);
    return Response.json({ name, content });
  }

  private async handleDocWrite(req: Request): Promise<Response> {
    const body = (await req.json()) as {
      name: string;
      content: string;
      mode?: "write" | "append";
    };

    if (!body.name || body.content === undefined) {
      return Response.json({ error: "name and content required" }, { status: 400 });
    }

    const docs = this.workspace!.contextProvider.documents;

    if (body.mode === "append") {
      await docs.append(body.name, body.content, "user");
    } else {
      // Check if exists; create if not
      const existing = await docs.read(body.name);
      if (existing === null) {
        await docs.create(body.name, body.content, "user");
      } else {
        await docs.write(body.name, body.content, "user");
      }
    }

    return Response.json({ ok: true });
  }

  private async handleStop(): Promise<Response> {
    setTimeout(() => this.shutdown(), 100);
    return Response.json({ stopped: true });
  }

  async shutdown(): Promise<void> {
    // Stop all loops
    for (const loop of this.loops) {
      if (loop.isRunning) {
        await loop.stop();
      }
    }
    this.loops = [];

    // Shutdown workspace
    if (this.workspace) {
      await this.workspace.shutdown();
      this.workspace = null;
    }

    // Stop server
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }

    // Clean socket
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(this.socketPath);
    } catch {
      /* ignore */
    }
  }

  get paths() {
    return {
      socketPath: this.socketPath,
      eventsPath: this.eventsPath,
    };
  }
}
