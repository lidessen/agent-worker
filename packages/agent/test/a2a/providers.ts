/**
 * Provider/runtime registry for a2a tests.
 *
 * Two categories:
 *   1. AI SDK providers — OpenAI-compatible APIs via createOpenAI().chat()
 *   2. CLI loops — ClaudeCode, Cursor, Codex wrapped as AgentLoop
 */
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { AiSdkLoop, ClaudeCodeLoop, CursorLoop, CodexLoop } from "@agent-worker/loop";
import type { LoopRun, LoopStatus, PreflightResult } from "@agent-worker/loop";
import type { ToolSet, LanguageModel } from "ai";
import type { AgentLoop, LoopCapability, PrepareStepFunction } from "../../src/types.ts";

// ── AgentLoop adapter for AiSdkLoop ───────────────────────────────────────

class AiSdkAgentLoop implements AgentLoop {
  readonly supports: LoopCapability[] = ["directTools"];
  private inner: AiSdkLoop;
  private _tools: ToolSet = {};
  constructor(options: { model: LanguageModel }) {
    this.inner = new AiSdkLoop({ ...options, includeBashTools: false });
  }

  get status(): LoopStatus {
    return this.inner.status;
  }

  run(prompt: string): LoopRun {
    if (Object.keys(this._tools).length > 0) {
      (this.inner as any).options = {
        ...(this.inner as any).options,
        tools: { ...(this.inner as any).options.tools, ...this._tools },
      };
      (this.inner as any).agent = null;
    }
    return this.inner.run(prompt);
  }

  cancel(): void {
    this.inner.cancel();
  }
  setTools(tools: ToolSet): void {
    this._tools = tools;
  }
  setPrepareStep(_fn: PrepareStepFunction): void {}

  async preflight(): Promise<PreflightResult> {
    // AiSdkLoop.preflight() only checks env vars for known providers.
    // For custom OpenAI-compatible providers, do a real API call to verify.
    try {
      const run = this.inner.run("Reply: OK");
      // Must fully consume the stream + result to catch API errors
      for await (const _ of run) {
      }
      await run.result;
      return { ok: true };
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      // Check for auth/API errors
      if (
        msg.includes("401") ||
        msg.includes("403") ||
        msg.includes("uthenticat") ||
        msg.includes("Unauthorized") ||
        msg.includes("API") ||
        msg.includes("Not Found")
      ) {
        return { ok: false, error: msg.slice(0, 150) };
      }
      // Unknown error — report it
      return { ok: false, error: `Preflight error: ${msg.slice(0, 150)}` };
    } finally {
      // Reset loop status for reuse
      (this.inner as any)._status = "idle";
      (this.inner as any).agent = null;
    }
  }

  async cleanup(): Promise<void> {
    return this.inner.cleanup();
  }
}

// ── AgentLoop adapter for CLI loops ────────────────────────────────────────

type McpMode = "cli-flag" | "cursor-file" | "codex-cli" | "none";

class CliAgentLoop implements AgentLoop {
  readonly supports: LoopCapability[] = [];
  private _mcpMode: McpMode;
  private _cursorMcpPath: string | null = null;
  private _codexMcpName: string | null = null;

  constructor(
    private inner: {
      run(p: string): LoopRun;
      cancel(): void;
      status: LoopStatus;
      preflight(): Promise<PreflightResult>;
      cleanup?(): Promise<void>;
    },
    mcpMode: McpMode = "cli-flag",
  ) {
    this._mcpMode = mcpMode;
  }

  get status(): LoopStatus {
    return this.inner.status;
  }

  run(prompt: string): LoopRun {
    return this.inner.run(prompt);
  }

  cancel(): void {
    this.inner.cancel();
  }

  setMcpConfig(configPath: string): void {
    if (this._mcpMode === "none") return;

    const inner = this.inner as any;

    if (this._mcpMode === "cursor-file") {
      // Cursor agent CLI reads MCP config from .cursor/mcp.json in workspace dir
      const cwd = process.cwd();
      const cursorDir = `${cwd}/.cursor`;
      const cursorMcpPath = `${cursorDir}/mcp.json`;

      try {
        const fs = require("node:fs");
        fs.mkdirSync(cursorDir, { recursive: true });
        const config = fs.readFileSync(configPath, "utf-8");
        fs.writeFileSync(cursorMcpPath, config);
        this._cursorMcpPath = cursorMcpPath;
      } catch {
        /* ignore */
      }

      if (inner.options) {
        inner.options.extraArgs = [...(inner.options.extraArgs ?? []), "--approve-mcps"];
      }
      return;
    }

    if (this._mcpMode === "codex-cli") {
      // Codex CLI: register MCP server via `codex mcp add`, then remove on cleanup
      try {
        const fs = require("node:fs");
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const servers = config.mcpServers ?? {};
        const name = Object.keys(servers)[0];
        if (!name) return;
        const server = servers[name];
        const cmd = server.command;
        const args: string[] = server.args ?? [];

        const { execSync } = require("node:child_process");
        // Remove existing entry first (ignore errors)
        try {
          execSync(`codex mcp remove ${name}`, { stdio: "ignore" });
        } catch {
          /* ok */
        }
        // Add the MCP server
        execSync(`codex mcp add ${name} -- ${cmd} ${args.map((a: string) => `"${a}"`).join(" ")}`, {
          stdio: "ignore",
        });
        this._codexMcpName = name;
      } catch {
        /* ignore */
      }
      return;
    }

    // Default: inject --mcp-config flag (Claude Code, etc.)
    if (inner.options) {
      inner.options.extraArgs = [...(inner.options.extraArgs ?? []), "--mcp-config", configPath];
    }
  }

  async preflight(): Promise<PreflightResult> {
    return this.inner.preflight();
  }
  async cleanup(): Promise<void> {
    if (this._cursorMcpPath) {
      try {
        const fs = require("node:fs");
        fs.unlinkSync(this._cursorMcpPath);
      } catch {
        /* ignore */
      }
      this._cursorMcpPath = null;
    }
    if (this._codexMcpName) {
      try {
        const { execSync } = require("node:child_process");
        execSync(`codex mcp remove ${this._codexMcpName}`, { stdio: "ignore" });
      } catch {
        /* ignore */
      }
      this._codexMcpName = null;
    }
    return this.inner.cleanup?.();
  }
}

// ── Environment cleanup for nested CLI sessions ───────────────────────────
// Remove CLAUDECODE env var so CLI loops can spawn nested sessions
delete process.env.CLAUDECODE;
delete process.env.CLAUDE_CODE_ENTRYPOINT;

// ── Provider config ────────────────────────────────────────────────────────

export interface ProviderConfig {
  name: string;
  createLoop: () => AgentLoop;
  /** Whether this provider supports tool calling. Default: true */
  toolSupport?: boolean;
}

function hasKey(envKey: string): boolean {
  return !!process.env[envKey];
}

/**
 * Build the list of available providers/runtimes based on env vars and CLI tools.
 */
export function getAvailableProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];

  // ── AI SDK providers (OpenAI-compatible) ────────────────────────────────
  // preflightOverride=true because we already checked the env var exists

  if (hasKey("DEEPSEEK_API_KEY")) {
    providers.push({
      name: "DeepSeek",
      createLoop: () => {
        const deepseek = createOpenAI({
          apiKey: process.env.DEEPSEEK_API_KEY,
          baseURL: "https://api.deepseek.com/v1",
          name: "deepseek",
        });
        return new AiSdkAgentLoop({ model: deepseek.chat("deepseek-chat") });
      },
      toolSupport: true,
    });
  }

  if (hasKey("KIMI_CODE_API_KEY")) {
    providers.push({
      name: "KimiCode",
      createLoop: () => {
        const kimi = createAnthropic({
          apiKey: process.env.KIMI_CODE_API_KEY,
          baseURL: "https://api.kimi.com/coding/v1",
        });
        return new AiSdkAgentLoop({ model: kimi("kimi-for-coding") });
      },
      toolSupport: true,
    });
  }

  if (hasKey("BIGMODEL_API_KEY_CN")) {
    providers.push({
      name: "BigModel",
      createLoop: () => {
        const bigmodel = createAnthropic({
          apiKey: process.env.BIGMODEL_API_KEY_CN,
          baseURL: "https://open.bigmodel.cn/api/paas/v4",
        });
        return new AiSdkAgentLoop({ model: bigmodel("glm-4-flash") });
      },
      toolSupport: true,
    });
  }

  if (hasKey("MINIMAX_CODE_API_KEY_CN")) {
    providers.push({
      name: "MiniMaxCode",
      createLoop: () => {
        const minimax = createAnthropic({
          apiKey: process.env.MINIMAX_CODE_API_KEY_CN,
          baseURL: "https://api.minimaxi.com/anthropic/v1",
        });
        return new AiSdkAgentLoop({ model: minimax("MiniMax-M2.5") });
      },
      toolSupport: true,
    });
  }

  if (hasKey("ANTHROPIC_API_KEY")) {
    providers.push({
      name: "Anthropic",
      createLoop: () => new AiSdkAgentLoop({ model: "anthropic:claude-haiku-4-5-20251001" as any }),
      toolSupport: true,
    });
  }

  if (hasKey("OPENAI_API_KEY")) {
    providers.push({
      name: "OpenAI",
      createLoop: () => new AiSdkAgentLoop({ model: "openai:gpt-4.1-nano" as any }),
      toolSupport: true,
    });
  }

  // ── CLI loops ───────────────────────────────────────────────────────────
  // CLI loops use MCP bridge for tool injection. Each CLI must support --mcp-config.

  providers.push({
    name: "ClaudeCode",
    createLoop: () =>
      new CliAgentLoop(new ClaudeCodeLoop({ model: "haiku", permissionMode: "bypassPermissions" })),
    toolSupport: true,
  });

  // Cursor Agent CLI: `agent -p --output-format stream-json --trust <prompt>`
  providers.push({
    name: "Cursor",
    createLoop: () => new CliAgentLoop(new CursorLoop(), "cursor-file"),
    toolSupport: true,
  });

  // Codex CLI: MCP via `codex mcp add/remove`
  providers.push({
    name: "Codex",
    createLoop: () => new CliAgentLoop(new CodexLoop({ fullAuto: true }), "codex-cli"),
    toolSupport: true,
  });

  return providers;
}
