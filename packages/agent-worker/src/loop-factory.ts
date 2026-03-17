/**
 * Loop factory — creates an AgentLoop from a RuntimeConfig.
 *
 * This bridges the HTTP API (which receives RuntimeConfig as JSON)
 * and the agent system (which needs an AgentLoop instance).
 */
import type { AgentLoop } from "@agent-worker/agent";
import type { RuntimeConfig } from "./types.ts";

/** Resolve an env var from agent env overrides, falling back to process.env. */
function resolveEnv(key: string, env?: Record<string, string>): string | undefined {
  return env?.[key] ?? process.env[key];
}

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

  // Parse "provider:model" format
  const modelStr = config.model ?? "anthropic:claude-sonnet-4-20250514";
  const colonIdx = modelStr.indexOf(":");
  const provider = colonIdx >= 0 ? modelStr.slice(0, colonIdx) : "anthropic";
  const modelId = colonIdx >= 0 ? modelStr.slice(colonIdx + 1) : modelStr;

  let languageModel;
  switch (provider) {
    case "anthropic": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const anthropic = createAnthropic({
        apiKey: resolveEnv("ANTHROPIC_API_KEY", config.env),
        baseURL: resolveEnv("ANTHROPIC_BASE_URL", config.env),
      });
      languageModel = anthropic(modelId);
      break;
    }
    case "openai": {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const openai = createOpenAI({
        apiKey: resolveEnv("OPENAI_API_KEY", config.env),
        baseURL: resolveEnv("OPENAI_BASE_URL", config.env),
      });
      languageModel = openai(modelId);
      break;
    }
    case "google": {
      const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
      const google = createGoogleGenerativeAI({
        apiKey: resolveEnv("GOOGLE_GENERATIVE_AI_API_KEY", config.env),
        baseURL: resolveEnv("GOOGLE_GENERATIVE_AI_BASE_URL", config.env),
      });
      languageModel = google(modelId);
      break;
    }
    case "deepseek": {
      const { createDeepSeek } = await import("@ai-sdk/deepseek");
      const deepseek = createDeepSeek({
        apiKey: resolveEnv("DEEPSEEK_API_KEY", config.env),
        baseURL: resolveEnv("DEEPSEEK_BASE_URL", config.env),
      });
      languageModel = deepseek(modelId);
      break;
    }
    case "kimi-code": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const kimi = createAnthropic({
        baseURL: resolveEnv("KIMI_CODE_BASE_URL", config.env) ?? "https://api.kimi.com/coding/v1",
        apiKey: resolveEnv("KIMI_CODE_API_KEY", config.env),
      });
      languageModel = kimi(modelId);
      break;
    }
    case "minimax": {
      const { createAnthropic } = await import("@ai-sdk/anthropic");
      const minimaxBase = resolveEnv("MINIMAX_BASE_URL", config.env);
      const baseURL = minimaxBase
        ? `${minimaxBase}/anthropic/v1`
        : "https://api.minimax.io/anthropic/v1";
      const minimax = createAnthropic({
        baseURL,
        apiKey: resolveEnv("MINIMAX_API_KEY", config.env),
      });
      languageModel = minimax(modelId);
      break;
    }
    case "ai-gateway": {
      const { gateway } = await import("ai");
      languageModel = gateway(modelId);
      break;
    }
    default:
      throw new Error(`Unknown AI SDK provider: ${provider}`);
  }

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
