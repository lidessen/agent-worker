import {
  Agent,
  Cursor,
  type AgentOptions,
  type McpServerConfig,
  type SDKAgent,
  type SDKMessage,
  type Run,
  type SendOptions,
} from "@cursor/sdk";
import type {
  CursorLoopOptions,
  LoopEvent,
  LoopRun,
  LoopStatus,
  PreflightResult,
} from "../types.ts";
import { createEventChannel } from "../types.ts";

export class CursorLoop {
  readonly supports = ["usageStream"] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpServers: Record<string, unknown> | null = null;
  private agentPromise: Promise<SDKAgent> | null = null;
  private agent: SDKAgent | null = null;
  private activeRun: Run | null = null;

  constructor(private options: CursorLoopOptions = {}) {}

  get status(): LoopStatus {
    return this._status;
  }

  run(input: string | { system: string; prompt: string }): LoopRun {
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    const prompt = buildPrompt(input, this.options.instructions);
    const channel = createEventChannel<LoopEvent>();
    const allEvents: LoopEvent[] = [];
    let outputText = "";
    let usage = estimateUsage(prompt, outputText);

    const emit = (event: LoopEvent) => {
      allEvents.push(event);
      channel.push(event);
      if (event.type === "text" || event.type === "thinking") {
        outputText += event.text;
      }
    };

    const result = (async () => {
      const startedAt = Date.now();
      try {
        if (this.abortController!.signal.aborted) throw new Error("Cursor run cancelled");

        const agent = await this.getAgent();
        if (this.abortController!.signal.aborted) throw new Error("Cursor run cancelled");

        const sendOptions: SendOptions = {
          ...(this.options.model ? { model: { id: this.options.model } } : {}),
          ...(this._mcpServers ? { mcpServers: buildCursorMcpServers(this._mcpServers) } : {}),
        };
        const run = await agent.send(prompt, sendOptions);
        this.activeRun = run;

        if (this.abortController!.signal.aborted) {
          await run.cancel();
          throw new Error("Cursor run cancelled");
        }

        for await (const message of run.stream() as AsyncGenerator<SDKMessage>) {
          for (const event of mapCursorMessage(message)) emit(event);
        }

        usage = estimateUsage(prompt, outputText);
        emit({ type: "usage", ...usage, source: "estimate" });

        if (this._status === "running") this._status = "completed";
        channel.end();
        return {
          events: allEvents,
          usage,
          durationMs: Date.now() - startedAt,
        };
      } catch (err) {
        this._status = this.abortController?.signal.aborted ? "cancelled" : "failed";
        const error = err instanceof Error ? err : new Error(String(err));
        channel.error(error);
        throw error;
      } finally {
        this.activeRun = null;
      }
    })();

    result.catch(() => {});

    return {
      [Symbol.asyncIterator]() {
        return channel.iterable[Symbol.asyncIterator]();
      },
      result,
    };
  }

  cancel(): void {
    this.abortController?.abort();
    void this.activeRun?.cancel();
    if (this._status === "running") {
      this._status = "cancelled";
    }
  }

  setMcpServers(servers: Record<string, unknown>): void {
    this._mcpServers = servers;
  }

  async cleanup(): Promise<void> {
    this.cancel();
    this.agent?.close();
    this.agent = null;
    this.agentPromise = null;
  }

  async preflight(): Promise<PreflightResult> {
    const apiKey = resolveApiKey(this.options);
    if (!apiKey) {
      return {
        ok: false,
        error: "Cursor SDK requires CURSOR_API_KEY or runtime env.CURSOR_API_KEY.",
      };
    }

    if (this.options.preflightOnline) {
      try {
        await Cursor.me({ apiKey });
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return { ok: true };
  }

  private getAgent(): Promise<SDKAgent> {
    if (!this.agentPromise) {
      this.agentPromise = Agent.create(
        buildCursorAgentOptions(this.options, this._mcpServers),
      ).then((agent) => {
        this.agent = agent;
        return agent;
      });
    }
    return this.agentPromise;
  }
}

export function buildCursorAgentOptions(
  opts: CursorLoopOptions,
  mcpServers?: Record<string, unknown> | null,
): AgentOptions {
  const cwd = buildCursorCwd(opts.cwd, opts.allowedPaths);
  const apiKey = resolveApiKey(opts);

  return {
    ...(apiKey ? { apiKey } : {}),
    model: { id: opts.model ?? "composer-2" },
    local: {
      ...(cwd ? { cwd } : {}),
      settingSources: opts.settingSources ?? ["project"],
      ...(opts.sandboxEnabled !== undefined
        ? { sandboxOptions: { enabled: opts.sandboxEnabled } }
        : {}),
    },
    ...(mcpServers ? { mcpServers: buildCursorMcpServers(mcpServers) } : {}),
    ...(opts.agentId ? { agentId: opts.agentId } : {}),
  };
}

export function mapCursorMessage(message: SDKMessage): LoopEvent[] {
  switch (message.type) {
    case "assistant":
      return mapAssistantMessage(message);
    case "thinking":
      return message.text ? [{ type: "thinking", text: message.text }] : [];
    case "tool_call":
      return mapToolCallMessage(message);
    case "status":
      if (message.status === "ERROR") {
        return [{ type: "error", error: new Error(message.message ?? "Cursor run failed") }];
      }
      return [];
    case "task":
      return message.text ? [{ type: "text", text: message.text }] : [];
    default:
      return [];
  }
}

function mapAssistantMessage(message: Extract<SDKMessage, { type: "assistant" }>): LoopEvent[] {
  const events: LoopEvent[] = [];
  for (const block of message.message.content ?? []) {
    if (block.type === "text" && block.text) {
      events.push({ type: "text", text: block.text });
    } else if (block.type === "tool_use") {
      events.push({
        type: "tool_call_start",
        name: block.name,
        callId: block.id,
        args: isRecord(block.input) ? block.input : { input: block.input },
      });
    }
  }
  return events;
}

function mapToolCallMessage(message: Extract<SDKMessage, { type: "tool_call" }>): LoopEvent[] {
  if (message.status === "running") {
    return [
      {
        type: "tool_call_start",
        name: message.name,
        callId: message.call_id,
        args: isRecord(message.args) ? message.args : undefined,
      },
    ];
  }

  return [
    {
      type: "tool_call_end",
      name: message.name,
      callId: message.call_id,
      result: message.result,
      error:
        message.status === "error"
          ? String(message.result ?? "Cursor tool call failed")
          : undefined,
    },
  ];
}

function buildPrompt(
  input: string | { system: string; prompt: string },
  instructions?: string,
): string {
  const parts =
    typeof input === "string" ? [instructions, input] : [instructions, input.system, input.prompt];
  return parts.filter((part): part is string => Boolean(part?.trim())).join("\n\n");
}

function buildCursorCwd(cwd?: string, allowedPaths?: string[]): string | string[] | undefined {
  if (!cwd) return allowedPaths?.length ? allowedPaths : undefined;
  if (!allowedPaths?.length) return cwd;
  return [cwd, ...allowedPaths];
}

function buildCursorMcpServers(servers: Record<string, unknown>): Record<string, McpServerConfig> {
  const converted: Record<string, McpServerConfig> = {};

  for (const [name, raw] of Object.entries(servers)) {
    if (!isRecord(raw)) continue;
    if ("oauth" in raw) {
      throw new Error(`Remote MCP OAuth is not supported for server "${name}"`);
    }

    if (typeof raw.command === "string") {
      converted[name] = {
        type: "stdio",
        command: raw.command,
        ...(Array.isArray(raw.args) ? { args: raw.args } : {}),
        ...(isStringRecord(raw.env) ? { env: raw.env } : {}),
        ...(typeof raw.cwd === "string" ? { cwd: raw.cwd } : {}),
      };
      continue;
    }

    if (typeof raw.url === "string") {
      const headers = {
        ...(isStringRecord(raw.headers) ? raw.headers : {}),
        ...bearerHeaderFromEnv(raw.bearerTokenEnvVar),
      };
      converted[name] = {
        type: raw.type === "sse" ? "sse" : "http",
        url: raw.url,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      };
    }
  }

  return converted;
}

function bearerHeaderFromEnv(value: unknown): Record<string, string> {
  if (typeof value !== "string") return {};
  const token = process.env[value];
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function resolveApiKey(opts: CursorLoopOptions): string | undefined {
  return opts.apiKey ?? opts.env?.CURSOR_API_KEY ?? process.env.CURSOR_API_KEY;
}

function estimateUsage(input: string, output: string) {
  const inputTokens = estimateTokens(input);
  const outputTokens = estimateTokens(output);
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}
