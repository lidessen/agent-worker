import { readFileSync } from "node:fs";
import type { CodexLoopOptions, LoopRun, LoopStatus, PreflightResult } from "../types.ts";
import type { RawCliEvent } from "../utils/cli-loop.ts";
import { checkCliAvailability, checkCodexAuth } from "../utils/cli.ts";
import { runCliLoop } from "../utils/cli-loop.ts";

export class CodexLoop {
  readonly supports = [] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpConfigPath: string | null = null;

  constructor(private options: CodexLoopOptions = {}) {}

  get status(): LoopStatus {
    return this._status;
  }

  run(prompt: string): LoopRun {
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    const loopRun = runCliLoop(
      {
        command: "codex",
        args: buildArgs(prompt, this.options, this._mcpConfigPath),
        mapEvent: mapCodexEvent,
        extractResult: extractCodexResult,
      },
      this.options,
      { abortSignal: this.abortController.signal },
    );

    loopRun.result
      .then(() => {
        if (this._status === "running") this._status = "completed";
      })
      .catch(() => {
        if (this._status === "running") {
          this._status = this.abortController!.signal.aborted ? "cancelled" : "failed";
        }
      });

    return loopRun;
  }

  cancel(): void {
    this.abortController?.abort();
    if (this._status === "running") {
      this._status = "cancelled";
    }
  }

  setMcpConfig(configPath: string): void {
    this._mcpConfigPath = configPath;
  }

  /** Check if codex CLI is installed and authenticated. Not a runtime test. */
  async preflight(): Promise<PreflightResult> {
    const cli = await checkCliAvailability("codex");
    if (!cli.available) return { ok: false, version: cli.version, error: cli.error };

    const auth = await checkCodexAuth();
    if (!auth.authenticated) {
      return { ok: false, version: cli.version, error: auth.error ?? "Not authenticated" };
    }

    return { ok: true, version: cli.version };
  }
}

function buildArgs(
  prompt: string,
  opts: CodexLoopOptions,
  mcpConfigPath?: string | null,
): string[] {
  const args = ["exec", prompt, "--json"];

  if (opts.model) args.push("--model", opts.model);
  if (opts.fullAuto) args.push("--full-auto");
  if (opts.sandbox) args.push("--sandbox", opts.sandbox);
  if (mcpConfigPath) args.push(...buildMcpOverrides(mcpConfigPath));
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);

  return args;
}

/** Escape a string for use inside a TOML basic string (double-quoted). */
function escapeToml(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Codex CLI has no --mcp-config flag. MCP servers are configured via
 * `-c` TOML overrides against the `mcp_servers` config section.
 * This is additive — the user's existing ~/.codex/config.toml is preserved.
 */
function buildMcpOverrides(configPath: string): string[] {
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
    mcpServers?: Record<string, { command: string; args?: string[] }>;
  };
  const servers = config.mcpServers ?? {};
  const flags: string[] = [];

  for (const [name, server] of Object.entries(servers)) {
    flags.push("-c", `mcp_servers.${name}.type="stdio"`);
    flags.push("-c", `mcp_servers.${name}.command="${escapeToml(server.command)}"`);
    if (server.args?.length) {
      const tomlArray =
        "[" + server.args.map((a) => `"${escapeToml(a)}"`).join(", ") + "]";
      flags.push("-c", `mcp_servers.${name}.args=${tomlArray}`);
    }
  }

  return flags;
}

function mapCodexEvent(data: unknown): RawCliEvent {
  const event = data as Record<string, unknown>;
  const type = event.type as string;

  switch (type) {
    case "message": {
      if ((event.role as string) === "assistant") {
        return { type: "text", text: (event.content as string) ?? "" };
      }
      return null;
    }

    case "function_call":
    case "tool_call":
      return {
        type: "tool_call_start",
        name: (event.name as string) ?? "unknown",
        args: (event.arguments as Record<string, unknown>) ?? {},
      };

    case "function_call_output":
    case "tool_call_output":
      return {
        type: "tool_call_end",
        name: (event.name as string) ?? "unknown",
        result: event.output,
      };

    case "item.started":
    case "item.completed": {
      const item = (event.item as Record<string, unknown>) ?? {};
      if (item.type === "mcp_tool_call") {
        if (type === "item.started") {
          return {
            type: "tool_call_start",
            name: (item.tool as string) ?? "unknown",
            callId: (item.id as string) ?? "",
            args: (item.arguments as Record<string, unknown>) ?? {},
          };
        }
        // item.completed
        const result = item.result as Record<string, unknown> | undefined;
        const content = result?.content as Array<Record<string, unknown>> | undefined;
        const text = (content?.[0]?.text as string) ?? "";
        return {
          type: "tool_call_end",
          callId: (item.id as string) ?? "",
          name: (item.tool as string) ?? "unknown",
          result: text,
        };
      }
      if (item.type === "agent_message" && typeof item.text === "string") {
        return { type: "text", text: item.text };
      }
      return { type: "unknown", data: event };
    }

    default:
      return { type: "unknown", data: event };
  }
}

function extractCodexResult(stdout: string): string {
  try {
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (typeof parsed.output === "string") return parsed.output;
    if (typeof parsed.result === "string") return parsed.result;
  } catch {
    // not JSON
  }
  return stdout;
}
