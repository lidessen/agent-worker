import {
  query,
  type Options as ClaudeAgentOptions,
  type SDKMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  ClaudeCodeLoopOptions,
  LoopEvent,
  LoopRun,
  LoopStatus,
  PreflightResult,
} from "../types.ts";
import { createEventChannel } from "../types.ts";
import { buildClaudeMcpServers } from "../utils/mcp-config.ts";
import type { ClaudeHooks } from "../utils/claude-sdk.ts";
import { getPreferredScriptRuntime } from "@agent-worker/shared";

export type ClaudeCodeModel = "opus" | "sonnet" | "haiku";

export class ClaudeCodeLoop {
  readonly supports = ["hooks", "usageStream"] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpConfigPath: string | null = null;
  private _mcpServers: Record<string, unknown> | null = null;
  private _hooks: ClaudeHooks | undefined;
  private activeQuery: ReturnType<typeof query> | null = null;

  constructor(private options: ClaudeCodeLoopOptions = {}) {}

  get status(): LoopStatus {
    return this._status;
  }

  run(input: string | { system: string; prompt: string }): LoopRun {
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    const { system, prompt } =
      typeof input === "string"
        ? { system: undefined as string | undefined, prompt: input }
        : input;

    const channel = createEventChannel<LoopEvent>();
    const allEvents: LoopEvent[] = [];
    const toolNames = new Map<string, string>();
    const streamState = { streamedText: "", streamedThinking: "" };
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

    const emit = (event: LoopEvent) => {
      allEvents.push(event);
      channel.push(event);
    };

    const result = (async () => {
      const startedAt = Date.now();
      try {
        const q = query({
          prompt,
          options: buildOptions({
            system,
            opts: this.options,
            mcpConfigPath: this._mcpConfigPath,
            mcpServers: this._mcpServers,
            hooks: this._hooks,
            abortController: this.abortController!,
          }),
        });
        this.activeQuery = q;

        for await (const message of q) {
          const mapped = mapClaudeMessage(message, toolNames, streamState);
          if (mapped.usage) {
            usage = mapped.usage;
            emit({
              type: "usage",
              inputTokens: usage.inputTokens,
              outputTokens: usage.outputTokens,
              totalTokens: usage.totalTokens,
              source: "runtime",
            });
          }
          for (const event of mapped.events) emit(event);
        }

        if (this._status === "running") this._status = "completed";
        channel.end();
        return {
          events: allEvents,
          usage,
          durationMs: Date.now() - startedAt,
        };
      } catch (err) {
        this._status = this.abortController?.signal.aborted ? "cancelled" : "failed";
        channel.error(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        this.activeQuery = null;
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
    this.activeQuery?.close();
    if (this._status === "running") {
      this._status = "cancelled";
    }
  }

  setMcpConfig(configPath: string): void {
    this._mcpConfigPath = configPath;
  }

  setMcpServers(servers: Record<string, unknown>): void {
    this._mcpServers = servers;
  }

  setHooks(hooks: Record<string, unknown>): void {
    this._hooks = hooks as ClaudeHooks;
  }

  async preflight(): Promise<PreflightResult> {
    const hasAuth =
      Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN) ||
      Boolean(process.env.ANTHROPIC_API_KEY) ||
      Boolean(process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID) ||
      Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
      Boolean(process.env.GOOGLE_CLOUD_PROJECT);

    if (!hasAuth) {
      return {
        ok: false,
        error:
          "Claude Agent SDK requires Claude Code OAuth or provider credentials (e.g. CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY, AWS creds, or Google ADC).",
      };
    }

    return { ok: true };
  }
}

/** @internal Exported for tests migrating off the old CLI wrapper. */
export function buildArgs(
  _prompt: string,
  opts: ClaudeCodeLoopOptions,
  _mcpConfigPath?: string | null,
): string[] {
  const args: string[] = [];
  if (opts.allowedPaths?.length) args.push("--add-dir", ...opts.allowedPaths);
  return args;
}

export function buildOptions(args: {
  system?: string;
  opts: ClaudeCodeLoopOptions;
  mcpConfigPath?: string | null;
  mcpServers?: Record<string, unknown> | null;
  hooks?: ClaudeHooks;
  abortController: AbortController;
}): ClaudeAgentOptions {
  const { system, opts, mcpConfigPath, mcpServers, hooks, abortController } = args;
  const scriptRuntime = getPreferredScriptRuntime();

  return {
    abortController,
    cwd: opts.cwd,
    model: resolveClaudeModel(opts.model),
    env: opts.env,
    additionalDirectories: opts.allowedPaths,
    allowedTools: opts.allowedTools,
    permissionMode: opts.permissionMode,
    allowDangerouslySkipPermissions: opts.permissionMode === "bypassPermissions",
    includePartialMessages: true,
    includeHookEvents: false,
    // 40 is enough for a worker to finish a small task end-to-end:
    // read instruction + context + bash write/read + artifact_create × 2 +
    // handoff_create + wake_update + final channel_send. 12 was too low
    // and caused mid-run truncation (observed during validation).
    maxTurns: 40,
    executable: scriptRuntime === "bun" ? "bun" : "node",
    mcpServers:
      (mcpServers as Record<string, any> | null | undefined) ??
      (mcpConfigPath ? (buildClaudeMcpServers(mcpConfigPath) as Record<string, any>) : undefined),
    ...(hooks ? { hooks } : {}),
    settingSources: ["project"],
    systemPrompt: {
      type: "preset",
      preset: "claude_code",
      append: system ?? opts.instructions,
    },
    tools: { type: "preset", preset: "claude_code" },
    extraArgs: opts.extraArgs ? parseClaudeExtraArgs(opts.extraArgs) : undefined,
  };
}

export function parseClaudeExtraArgs(args: string[]): Record<string, string | null> {
  const parsed: Record<string, string | null> = {};

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (!arg.startsWith("--")) continue;

    const inlineEq = arg.indexOf("=");
    if (inlineEq > 2) {
      parsed[arg.slice(2, inlineEq)] = arg.slice(inlineEq + 1);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[arg.slice(2)] = next;
      index++;
      continue;
    }

    parsed[arg.slice(2)] = null;
  }

  return parsed;
}

function resolveClaudeModel(model?: string): string | undefined {
  if (!model) return undefined;
  switch (model) {
    case "opus":
      return "claude-opus-4-6";
    case "sonnet":
      return "claude-sonnet-4-6";
    case "haiku":
      return "claude-haiku-4-5";
    default:
      return model;
  }
}

export function mapClaudeMessage(
  message: SDKMessage,
  toolNames: Map<string, string>,
  streamState: { streamedText: string; streamedThinking: string } = {
    streamedText: "",
    streamedThinking: "",
  },
): {
  events: LoopEvent[];
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
} {
  const events: LoopEvent[] = [];

  if (message.type === "assistant") {
    const content = (message.message.content ?? []) as unknown as Array<Record<string, unknown>>;
    for (const block of content) {
      if (
        block.type === "thinking" &&
        typeof block.thinking === "string" &&
        block.thinking.length > streamState.streamedThinking.length
      ) {
        const newThinking = block.thinking.slice(streamState.streamedThinking.length);
        if (newThinking) {
          events.push({ type: "thinking", text: newThinking });
          streamState.streamedThinking = block.thinking;
        }
      } else if (
        block.type === "text" &&
        typeof block.text === "string" &&
        block.text.length > streamState.streamedText.length
      ) {
        const newText = block.text.slice(streamState.streamedText.length);
        if (newText) {
          events.push({ type: "text", text: newText });
          streamState.streamedText = block.text;
        }
      } else if (block.type === "tool_use") {
        const callId = String(block.id ?? "");
        const name = String(block.name ?? "unknown");
        if (!toolNames.has(callId)) {
          toolNames.set(callId, name);
          events.push({
            type: "tool_call_start",
            name,
            callId,
            args: (block.input as Record<string, unknown> | undefined) ?? {},
          });
        }
      }
    }
  } else if (
    message.type === "user" &&
    message.parent_tool_use_id &&
    message.tool_use_result !== undefined
  ) {
    events.push({
      type: "tool_call_end",
      name: toolNames.get(message.parent_tool_use_id) ?? "unknown",
      callId: message.parent_tool_use_id,
      result: message.tool_use_result,
    });
  } else if (message.type === "stream_event") {
    const event = message.event as unknown as Record<string, unknown>;
    const eventType = String(event.type ?? "");
    if (eventType === "content_block_delta") {
      const delta = (event.delta as Record<string, unknown> | undefined) ?? {};
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        streamState.streamedText += delta.text;
        events.push({ type: "text", text: delta.text });
      } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
        streamState.streamedThinking += delta.thinking;
        events.push({ type: "thinking", text: delta.thinking });
      }
    }
  } else if (message.type === "tool_progress") {
    events.push({
      type: "tool_call_start",
      name: message.tool_name,
      callId: message.tool_use_id,
    });
  } else if (message.type === "system") {
    const subtype = (message as { subtype?: string }).subtype;
    if (subtype === "hook_started") {
      const hookMessage = message as {
        hook_name: string;
        hook_event: string;
      };
      events.push({
        type: "hook",
        phase: "started",
        name: hookMessage.hook_name,
        hookEvent: hookMessage.hook_event,
      });
    } else if (subtype === "hook_progress") {
      const hookMessage = message as {
        hook_name: string;
        hook_event: string;
        output?: string;
        stdout?: string;
        stderr?: string;
      };
      events.push({
        type: "hook",
        phase: "progress",
        name: hookMessage.hook_name,
        hookEvent: hookMessage.hook_event,
        output: hookMessage.output,
        stdout: hookMessage.stdout,
        stderr: hookMessage.stderr,
      });
    } else if (subtype === "hook_response") {
      const hookMessage = message as {
        hook_name: string;
        hook_event: string;
        output?: string;
        stdout?: string;
        stderr?: string;
        outcome?: "success" | "error" | "cancelled";
      };
      events.push({
        type: "hook",
        phase: "response",
        name: hookMessage.hook_name,
        hookEvent: hookMessage.hook_event,
        output: hookMessage.output,
        stdout: hookMessage.stdout,
        stderr: hookMessage.stderr,
        outcome: hookMessage.outcome,
      });
    }
  } else if (message.type === "result") {
    return {
      events,
      usage: mapResultUsage(message),
    };
  } else {
    const maybeSystem = message as { type?: string; subtype?: string; content?: string };
    if (maybeSystem.type === "system" && maybeSystem.subtype === "local_command_output") {
      events.push({ type: "text", text: maybeSystem.content ?? "" });
    }
  }

  return { events };
}

function mapResultUsage(message: SDKResultMessage): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
} {
  const inputTokens = message.usage.input_tokens ?? 0;
  const outputTokens = message.usage.output_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}
