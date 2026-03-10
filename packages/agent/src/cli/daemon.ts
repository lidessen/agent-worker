/**
 * aw daemon — runs an Agent and exposes it via Unix socket.
 *
 * Endpoints:
 *   POST /send   — { messages: Array<{ content, from?, delayMs? }> }
 *   GET  /recv   — ?cursor=<byteOffset>  → incremental responses
 *   GET  /log    — ?cursor=<byteOffset>  → incremental debug events
 *   GET  /state  — agent state, inbox, todos
 *   POST /stop   — graceful shutdown
 */
import { tmpdir } from "node:os";
import { Agent } from "../agent.ts";
import type { AgentConfig, AgentState } from "../types.ts";
import type { LoopEvent } from "@agent-worker/loop";

export interface DaemonConfig {
  /** Agent configuration */
  agentConfig: AgentConfig;
  /** Directory for jsonl output files. Default: OS tmpdir */
  dataDir?: string;
  /** Unix socket path. Default: <dataDir>/aw-<pid>.sock */
  socketPath?: string;
}

interface JsonlEntry {
  ts: number;
  [key: string]: unknown;
}

/**
 * Append-only jsonl writer with byte-offset tracking.
 */
class JsonlWriter {
  private fd: number | null = null;
  private byteOffset = 0;
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  async init(): Promise<void> {
    // Truncate or create the file
    await Bun.write(this.path, "");
    this.byteOffset = 0;
  }

  append(entry: JsonlEntry): void {
    const line = JSON.stringify(entry) + "\n";
    const bytes = Buffer.from(line);
    this.byteOffset += bytes.length;
    // Fire-and-forget append
    Bun.write(Bun.file(this.path), appendBuffer(this.path, bytes));
  }

  get offset(): number {
    return this.byteOffset;
  }
}

/** Read file from byte offset to end */
async function readFrom(path: string, cursor: number): Promise<{ data: string; cursor: number }> {
  const file = Bun.file(path);
  const size = file.size;
  if (cursor >= size) {
    return { data: "", cursor: size };
  }
  const buf = await file.slice(cursor, size).text();
  return { data: buf, cursor: size };
}

/** Append buffer to file (read existing + concat) */
async function appendBuffer(path: string, buf: Buffer): Promise<Buffer> {
  const existing = await Bun.file(path).arrayBuffer();
  const combined = Buffer.concat([Buffer.from(existing), buf]);
  return combined;
}

export class AwDaemon {
  private agent: Agent | null = null;
  private server: ReturnType<typeof Bun.serve> | null = null;
  private responsesPath: string;
  private eventsPath: string;
  private socketPath: string;
  private responsesOffset = 0;
  private eventsOffset = 0;

  constructor(private config: DaemonConfig) {
    const dir = config.dataDir ?? tmpdir();
    const suffix = `${process.pid}-${Date.now()}`;
    this.responsesPath = `${dir}/aw-responses-${suffix}.jsonl`;
    this.eventsPath = `${dir}/aw-events-${suffix}.jsonl`;
    this.socketPath = config.socketPath ?? `${dir}/aw-${suffix}.sock`;
  }

  async start(): Promise<{ socketPath: string; responsesPath: string; eventsPath: string }> {
    // Initialize output files
    await Bun.write(this.responsesPath, "");
    await Bun.write(this.eventsPath, "");

    // Create and initialize agent
    this.agent = new Agent(this.config.agentConfig);

    // Wire up event logging
    this.agent.on("stateChange", (state: AgentState) => {
      this.appendEvent({ type: "state_change", state });
    });

    this.agent.on("messageReceived", (msg) => {
      this.appendEvent({ type: "message_received", id: msg.id, from: msg.from, content: msg.content });
    });

    this.agent.on("runStart", (info) => {
      this.appendEvent({ type: "run_start", runNumber: info.runNumber, trigger: info.trigger });
    });

    this.agent.on("runEnd", (result) => {
      this.appendEvent({
        type: "run_end",
        durationMs: result.durationMs,
        tokens: result.usage.totalTokens,
      });
    });

    this.agent.on("event", (event: LoopEvent) => {
      if (event.type === "text") {
        // Text events are responses — write to responses file
        this.appendResponse({ type: "text", text: event.text });
      } else if (event.type === "tool_call_start") {
        this.appendEvent({ type: "tool_call_start", name: event.name, args: event.args });
      } else if (event.type === "tool_call_end") {
        this.appendEvent({
          type: "tool_call_end",
          name: event.name,
          result: event.result,
          durationMs: event.durationMs,
        });
      } else if (event.type === "thinking") {
        this.appendEvent({ type: "thinking", text: event.text });
      } else if (event.type === "error") {
        this.appendEvent({ type: "error", error: String(event.error) });
      }
    });

    this.agent.on("send", (target, content) => {
      this.appendResponse({ type: "send", target, content });
    });

    this.agent.on("contextAssembled", (prompt) => {
      this.appendEvent({
        type: "context_assembled",
        tokenCount: prompt.tokenCount,
        turnCount: prompt.turns.length,
      });
    });

    await this.agent.init();

    // Start Unix socket server
    await this.startServer();

    return {
      socketPath: this.socketPath,
      responsesPath: this.responsesPath,
      eventsPath: this.eventsPath,
    };
  }

  private appendResponse(entry: Record<string, unknown>): void {
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
    const buf = new TextEncoder().encode(line);
    this.responsesOffset += buf.length;
    // Append to file
    const file = Bun.file(this.responsesPath);
    file.arrayBuffer().then((existing) => {
      Bun.write(this.responsesPath, Buffer.concat([Buffer.from(existing), Buffer.from(buf)]));
    });
  }

  private appendEvent(entry: Record<string, unknown>): void {
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
    const buf = new TextEncoder().encode(line);
    this.eventsOffset += buf.length;
    const file = Bun.file(this.eventsPath);
    file.arrayBuffer().then((existing) => {
      Bun.write(this.eventsPath, Buffer.concat([Buffer.from(existing), Buffer.from(buf)]));
    });
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
          if (path === "/recv" && req.method === "GET") {
            return this.handleRecv(url);
          }
          if (path === "/log" && req.method === "GET") {
            return this.handleLog(url);
          }
          if (path === "/state" && req.method === "GET") {
            return this.handleState();
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
      messages: Array<{ content: string; from?: string; delayMs?: number }>;
    };

    if (!body.messages?.length) {
      return Response.json({ error: "messages array required" }, { status: 400 });
    }

    let sent = 0;
    for (const msg of body.messages) {
      if (msg.delayMs && msg.delayMs > 0) {
        await new Promise((r) => setTimeout(r, msg.delayMs));
      }
      this.agent!.push({ content: msg.content, from: msg.from });
      sent++;
    }

    return Response.json({ sent, state: this.agent!.state });
  }

  private async handleRecv(url: URL): Promise<Response> {
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const { data, cursor: newCursor } = await readFrom(this.responsesPath, cursor);

    const lines = data
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    return Response.json({ entries: lines, cursor: newCursor });
  }

  private async handleLog(url: URL): Promise<Response> {
    const cursor = parseInt(url.searchParams.get("cursor") ?? "0", 10);
    const { data, cursor: newCursor } = await readFrom(this.eventsPath, cursor);

    const lines = data
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    return Response.json({ entries: lines, cursor: newCursor });
  }

  private handleState(): Response {
    const agent = this.agent!;
    return Response.json({
      state: agent.state,
      inbox: agent.inboxMessages.map((m) => ({
        id: m.id,
        status: m.status,
        from: m.from,
        content: m.content,
        timestamp: m.timestamp,
      })),
      todos: agent.todos.map((t) => ({
        id: t.id,
        status: t.status,
        text: t.text,
      })),
      history: agent.context.length,
    });
  }

  private async handleStop(): Promise<Response> {
    if (this.agent) {
      await this.agent.stop();
    }
    // Defer shutdown so response gets sent
    setTimeout(() => this.shutdown(), 100);
    return Response.json({ stopped: true });
  }

  async shutdown(): Promise<void> {
    if (this.agent && this.agent.state !== "stopped") {
      await this.agent.stop();
    }
    if (this.server) {
      this.server.stop(true);
      this.server = null;
    }
    // Clean up socket
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
      responsesPath: this.responsesPath,
      eventsPath: this.eventsPath,
    };
  }
}
