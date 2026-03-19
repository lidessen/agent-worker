/**
 * Loop factory — creates an AgentLoop from a RuntimeConfig.
 *
 * This bridges the HTTP API (which receives RuntimeConfig as JSON)
 * and the agent system (which needs an AgentLoop instance).
 */
import type { AgentLoop } from "@agent-worker/agent";
import type { RuntimeConfig } from "./types.ts";
import { extractProvider, getDefaultModel, resolveProvider } from "@agent-worker/loop";

/** Create an AgentLoop from a RuntimeConfig. */
export async function createLoopFromConfig(config: RuntimeConfig): Promise<AgentLoop> {
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
      throw new Error(`Unknown runtime type: ${(config as any).type}`);
  }
}

async function createAiSdkLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { AiSdkLoop } = await import("@agent-worker/loop");

  // Parse "provider:model" format (provider is registry key)
  const modelStr = config.model ?? getDefaultModel("anthropic") ?? "anthropic:claude-sonnet-4-6";
  const provider = extractProvider(modelStr);
  if (!provider) {
    throw new Error(
      `Invalid model format "${modelStr}": expected "provider:modelId" (e.g. "anthropic:claude-sonnet-4-6").`,
    );
  }
  const modelId = modelStr.slice(provider.length + 1);

  const languageModel = await resolveProvider(provider, modelId, config.env);

  return new AiSdkLoop({
    model: languageModel,
    instructions: config.instructions,
    loopTools: config.loopTools,
  });
}

async function createClaudeCodeLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { ClaudeCodeLoop } = await import("@agent-worker/loop");
  return new ClaudeCodeLoop({
    model: config.model ?? "sonnet",
    cwd: config.cwd,
    env: config.env,
    permissionMode: "bypassPermissions",
  });
}

async function createCodexLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { CodexLoop } = await import("@agent-worker/loop");
  return new CodexLoop({
    model: config.model,
    cwd: config.cwd,
    env: config.env,
    fullAuto: true,
  });
}

async function createCursorLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { CursorLoop } = await import("@agent-worker/loop");
  return new CursorLoop({
    model: config.model,
    cwd: config.cwd,
    env: config.env,
  });
}

async function createMockLoop(config: RuntimeConfig): Promise<AgentLoop> {
  const { MockLoop } = await import("@agent-worker/loop");
  return new MockLoop({
    response: config.mockResponse ?? "mock response",
    delayMs: config.mockDelay ?? 0,
  });
}
