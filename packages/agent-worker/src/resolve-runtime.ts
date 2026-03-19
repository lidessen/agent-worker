/**
 * Runtime + model resolution logic.
 *
 * Moved from @agent-worker/workspace to agent-worker because it depends
 * on @agent-worker/loop (CLI availability checks, provider key detection).
 * This is orchestration logic — "which runtime should this agent use" —
 * not workspace infrastructure.
 *
 * Rules:
 * 1. model specified, runtime omitted   → runtime = "ai-sdk"
 * 2. neither model nor runtime specified → discovery mode (prefer CLIs)
 * 3. runtime specified, model omitted:
 *    - "ai-sdk"     → pick model from env vars (first available provider key)
 *    - CLI runtimes → no model (use CLI default)
 */

import {
  checkCliAvailability,
  checkClaudeCodeAuth,
  checkCodexAuth,
  hasProviderKey,
} from "@agent-worker/loop";

// ── Types ─────────────────────────────────────────────────────────────────

export interface RuntimeResolution {
  runtime: string;
  model?: string;
  /** How was this resolved? */
  reason: string;
}

// ── Provider → default model mapping ──────────────────────────────────────

const PROVIDER_DEFAULT_MODELS: Record<string, string> = {
  anthropic: "anthropic:claude-sonnet-4-6",
  openai: "openai:gpt-4.1",
  google: "google:gemini-2.5-flash",
  deepseek: "deepseek:deepseek-chat",
  "kimi-code": "kimi-code:kimi-for-coding",
  minimax: "minimax:MiniMax-M2.5",
  "ai-gateway": "ai-gateway:anthropic/claude-sonnet-4-6",
};

/** Ordered list of providers to check for AI SDK auto-selection. */
const PROVIDER_PRIORITY = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "kimi-code",
  "minimax",
  "ai-gateway",
];

// ── CLI runtime discovery ─────────────────────────────────────────────────

interface CliCandidate {
  runtime: string;
  command: string;
  checkAuth: () => Promise<{ authenticated: boolean }>;
}

const CLI_CANDIDATES: CliCandidate[] = [
  {
    runtime: "claude-code",
    command: "claude",
    checkAuth: checkClaudeCodeAuth,
  },
  {
    runtime: "codex",
    command: "codex",
    checkAuth: checkCodexAuth,
  },
  {
    runtime: "cursor",
    command: "agent",
    checkAuth: async () => ({ authenticated: true }),
  },
];

// ── Resolution functions ──────────────────────────────────────────────────

/**
 * Auto-detect the best available model for AI SDK by checking provider env vars.
 * Returns the first provider that has an API key set.
 */
export function detectAiSdkModel(): string | undefined {
  for (const provider of PROVIDER_PRIORITY) {
    if (hasProviderKey(provider)) {
      return PROVIDER_DEFAULT_MODELS[provider];
    }
  }
  return undefined;
}

/**
 * Discover the best available CLI runtime by checking installation + auth.
 * Returns the first CLI that is installed and authenticated.
 */
export async function discoverCliRuntime(): Promise<RuntimeResolution | null> {
  for (const candidate of CLI_CANDIDATES) {
    const availability = await checkCliAvailability(candidate.command);
    if (!availability.available) continue;

    const auth = await candidate.checkAuth();
    if (!auth.authenticated) continue;

    return {
      runtime: candidate.runtime,
      reason: `discovered ${candidate.runtime} (${candidate.command} CLI available and authenticated)`,
    };
  }
  return null;
}

/**
 * Resolve runtime and model for an agent definition.
 */
export async function resolveRuntime(runtime?: string, model?: string): Promise<RuntimeResolution> {
  if (runtime === "auto") runtime = undefined;

  // Case 1: model specified, runtime omitted → ai-sdk
  if (model && !runtime) {
    return {
      runtime: "ai-sdk",
      model,
      reason: "model specified without runtime, defaulting to ai-sdk",
    };
  }

  // Case 2: neither specified → discovery mode
  if (!model && !runtime) {
    const cli = await discoverCliRuntime();
    if (cli) return cli;

    const detected = detectAiSdkModel();
    if (detected) {
      return {
        runtime: "ai-sdk",
        model: detected,
        reason: `no runtime/model specified, fell back to ai-sdk with ${detected}`,
      };
    }

    throw new Error(
      "Cannot resolve runtime: no CLI tools found and no API keys set. " +
        "Install claude/codex CLI or set ANTHROPIC_API_KEY/OPENAI_API_KEY.",
    );
  }

  // Case 3: runtime specified, model omitted
  if (runtime && !model) {
    if (runtime === "ai-sdk") {
      const detected = detectAiSdkModel();
      if (!detected) {
        throw new Error(
          "Runtime 'ai-sdk' requires a model or API key. " +
            "Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or specify a model.",
        );
      }
      return {
        runtime: "ai-sdk",
        model: detected,
        reason: `ai-sdk runtime, auto-detected model ${detected}`,
      };
    }

    return {
      runtime,
      reason: `${runtime} runtime, using CLI default model`,
    };
  }

  // Case 4: both specified
  return {
    runtime: runtime!,
    model,
    reason: "both runtime and model explicitly specified",
  };
}
