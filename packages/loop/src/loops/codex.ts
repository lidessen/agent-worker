import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { CodexLoopOptions, LoopRun, LoopStatus, PreflightResult } from "../types.ts";
import type { RawCliEvent } from "../utils/cli-loop.ts";
import { checkCliAvailability, checkCodexAuth } from "../utils/cli.ts";
import { runCliLoop } from "../utils/cli-loop.ts";

export class CodexLoop {
  readonly supports = [] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private _mcpConfigPath: string | null = null;
  private _codexHome: string | null = null;

  constructor(private options: CodexLoopOptions = {}) {}

  get status(): LoopStatus {
    return this._status;
  }

  run(prompt: string): LoopRun {
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    // Create an isolated CODEX_HOME with MCP config so we don't
    // touch the user's global ~/.codex/config.toml.
    let env: Record<string, string> | undefined;
    if (this._mcpConfigPath) {
      this._codexHome = createCodexHome(this._mcpConfigPath);
      env = { CODEX_HOME: this._codexHome };
    }

    const loopRun = runCliLoop(
      {
        command: "codex",
        args: buildArgs(prompt, this.options),
        env,
        mapEvent: mapCodexEvent,
        extractResult: extractCodexResult,
      },
      this.options,
      { abortSignal: this.abortController.signal },
    );

    loopRun.result
      .then(() => {
        this.cleanupCodexHome();
        if (this._status === "running") this._status = "completed";
      })
      .catch(() => {
        this.cleanupCodexHome();
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

  private cleanupCodexHome(): void {
    if (this._codexHome) {
      try {
        rmSync(this._codexHome, { recursive: true, force: true });
      } catch {
        // best-effort
      }
      this._codexHome = null;
    }
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

function buildArgs(prompt: string, opts: CodexLoopOptions): string[] {
  const args = ["exec", prompt, "--json"];

  if (opts.model) args.push("--model", opts.model);
  if (opts.fullAuto) args.push("--full-auto");
  if (opts.sandbox) args.push("--sandbox", opts.sandbox);
  if (opts.extraArgs?.length) args.push(...opts.extraArgs);

  return args;
}

// ── CODEX_HOME isolation ─────────────────────────────────────────────────────
//
// Codex CLI has no --mcp-config flag. MCP servers live in config.toml under
// CODEX_HOME (~/.codex by default). To inject MCP config without touching the
// user's global config, we create a temp CODEX_HOME directory with:
//   1. A config.toml containing only our MCP server entries
//   2. A symlink to the real auth.json so authentication still works

/**
 * Create a temporary CODEX_HOME directory with MCP config and auth symlink.
 * Returns the path to the temp directory.
 */
function createCodexHome(mcpConfigPath: string): string {
  const config = JSON.parse(readFileSync(mcpConfigPath, "utf-8")) as {
    mcpServers?: Record<string, { command: string; args?: string[] }>;
  };

  const tempHome = join("/tmp", `codex-home-${Date.now()}`);
  mkdirSync(tempHome, { recursive: true });

  // Write config.toml with MCP server entries
  const toml = buildConfigToml(config.mcpServers ?? {});
  writeFileSync(join(tempHome, "config.toml"), toml);

  // Symlink auth.json from real CODEX_HOME so auth carries over
  const realHome = process.env.CODEX_HOME ?? join(homedir(), ".codex");
  const realAuth = join(realHome, "auth.json");
  if (existsSync(realAuth)) {
    symlinkSync(realAuth, join(tempHome, "auth.json"));
  }

  return tempHome;
}

/** Build a TOML config string for MCP server entries. */
function buildConfigToml(
  servers: Record<string, { command: string; args?: string[] }>,
): string {
  const sections: string[] = [];
  for (const [name, server] of Object.entries(servers)) {
    const lines = [`[mcp_servers.${name}]`, `type = "stdio"`, `command = "${escapeToml(server.command)}"`];
    if (server.args?.length) {
      const arr = server.args.map((a) => `"${escapeToml(a)}"`).join(", ");
      lines.push(`args = [${arr}]`);
    }
    sections.push(lines.join("\n"));
  }
  return sections.join("\n\n") + "\n";
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
