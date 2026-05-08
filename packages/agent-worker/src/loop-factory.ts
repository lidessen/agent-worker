/**
 * Loop factory — creates an AgentLoop from a RuntimeConfig.
 *
 * This bridges the HTTP API (which receives RuntimeConfig as JSON)
 * and the agent system (which needs an AgentLoop instance).
 */
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { AgentLoop, RuntimeBinding } from "@agent-worker/agent";
import type { RuntimeConfig } from "./types.ts";
import { extractProvider, getDefaultModel, resolveProvider } from "@agent-worker/loop";

function assertSupportedMcpServers(servers?: RuntimeConfig["mcpServers"]): void {
  if (!servers) return;
  for (const [name, server] of Object.entries(servers)) {
    if (server && typeof server === "object" && "oauth" in server) {
      throw new Error(`Remote MCP OAuth is not supported for server "${name}"`);
    }
  }
}

/** Create an AgentLoop from a RuntimeConfig. */
export async function createLoopFromConfig(config: RuntimeConfig): Promise<AgentLoop> {
  assertSupportedMcpServers(config.mcpServers);

  const loop = await (async () => {
    switch (config.type) {
      case "ai-sdk":
        return createAiSdkLoop(config);
      case "claude-code":
        return createClaudeCodeLoop(config);
      case "codex":
        return createCodexLoop(config);
      case "cursor":
        return createCursorLoop(config);
      case "mock":
        return createMockLoop(config);
      default:
        throw new Error(`Unknown runtime type: ${String((config as { type?: unknown }).type)}`);
    }
  })();

  if (config.mcpServers && Object.keys(config.mcpServers).length > 0) {
    if (loop.setMcpServers) {
      loop.setMcpServers(config.mcpServers);
      return loop;
    }

    if (!loop.setMcpConfig) {
      throw new Error(
        "External MCP servers are currently supported only for SDK-native or config-file runtimes",
      );
    }

    const configPath = `/tmp/agent-runtime-mcp-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.json`;
    await writeFile(configPath, JSON.stringify({ mcpServers: config.mcpServers }), "utf-8");
    loop.setMcpConfig(configPath);

    const originalCleanup = loop.cleanup?.bind(loop);
    loop.cleanup = async () => {
      try {
        await originalCleanup?.();
      } finally {
        try {
          await unlink(configPath);
        } catch {
          /* already removed */
        }
      }
    };
  }

  return loop;
}

export async function createRuntimeBindingFromConfig(
  config: RuntimeConfig,
): Promise<RuntimeBinding> {
  const loop = await createLoopFromConfig(config);
  return {
    id: runtimeBindingId(config),
    runtimeType: config.type,
    model: config.model,
    loop,
    metadata: {
      cwd: config.cwd,
      allowedPaths: config.allowedPaths,
    },
  };
}

function runtimeBindingId(config: RuntimeConfig): string {
  const model = config.model ? `:${config.model}` : "";
  const cwd = config.cwd ? `@${config.cwd}` : "";
  return `${config.type}${model}${cwd}`;
}

async function createAiSdkLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { AiSdkLoop, createHostSandbox } = await import("@agent-worker/loop");

  // Parse "provider:model" format (provider is registry key)
  const modelStr = config.model ?? getDefaultModel("anthropic") ?? "anthropic:claude-sonnet-4-6";
  const provider = extractProvider(modelStr);
  if (!provider) {
    throw new Error(
      `Invalid model format "${modelStr}": expected "provider:model" (e.g. "anthropic:model-name").`,
    );
  }
  const modelId = modelStr.slice(provider.length + 1);

  const languageModel = await resolveProvider(provider, modelId, config.env);

  // When cwd is set, use HostSandbox for real filesystem access.
  // Without cwd, fall back to bash-tool's default just-bash (virtual FS).
  const bashToolOptions = config.cwd
    ? {
        sandbox: createHostSandbox({ cwd: config.cwd, allowedPaths: config.allowedPaths }),
        destination: config.cwd,
      }
    : undefined;

  return new AiSdkLoop({
    model: languageModel,
    instructions: config.instructions,
    bashToolOptions,
    loopTools: config.loopTools,
  });
}

async function createClaudeCodeLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { ClaudeCodeLoop } = await import("@agent-worker/loop");
  // Phase-3 control boundary: `permissionMode` is now
  // configurable. The daemon-level default stays at
  // `bypassPermissions` until a follow-up commit flips it, so
  // existing workspaces keep behaving the same way.
  return new ClaudeCodeLoop({
    model: config.model ?? "sonnet",
    cwd: config.cwd,
    allowedPaths: config.allowedPaths,
    env: config.env,
    permissionMode: config.permissionMode ?? "bypassPermissions",
  });
}

async function createCodexLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { CodexLoop } = await import("@agent-worker/loop");
  // Session continuity (phase 2): when a persistent stateDir is
  // provided, store the codex thread id there so the next daemon
  // run resumes the same conversation.
  const threadIdFile = config.stateDir ? join(config.stateDir, "codex-thread.json") : undefined;
  // Phase-3 control boundary: `fullAuto` and `sandbox` are now
  // configurable. Default remains aggressive (full-auto
  // workspace-write) — opt out by setting `policy.fullAuto:
  // false` on the agent or workspace. Note: codex approval
  // prompts are not yet intercepted by agent-worker, so
  // `fullAuto: false` will currently block mid-run. The knob
  // exists now so the plumbing is ready for the approval bridge.
  return new CodexLoop({
    model: config.model,
    cwd: config.cwd,
    allowedPaths: config.allowedPaths,
    env: config.env,
    fullAuto: config.fullAuto ?? true,
    sandbox: config.sandbox,
    threadIdFile,
  });
}

async function createCursorLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { CursorLoop } = await import("@agent-worker/loop");
  return new CursorLoop({
    model: config.model,
    cwd: config.cwd,
    allowedPaths: config.allowedPaths,
    env: config.env,
    apiKey: config.env?.CURSOR_API_KEY,
  });
}

async function createMockLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { MockLoop } = await import("@agent-worker/loop");
  return new MockLoop({
    response: config.mockResponse ?? "mock response",
    delayMs: config.mockDelay ?? 0,
  });
}
