import { parse as parseYaml } from "yaml";
import { readFile, access } from "node:fs/promises";
import { execa } from "execa";
import type {
  WorkspaceDef,
  AdapterDef,
  ResolvedWorkspace,
  ResolvedAgent,
  ResolvedModel,
  ModelSpec,
  SetupStep,
} from "./types.ts";
import type { WorkspaceConfig, ChannelAdapter } from "../types.ts";
import { MemoryStorage, FileStorage } from "../context/storage.ts";
import { resolveRuntime } from "./resolve-runtime.ts";

// ── Template interpolation ────────────────────────────────────────────────

const TEMPLATE_RE = /\$\{\{\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\}\}/g;

/**
 * Interpolate `${{ var }}` references in a string.
 * Supports dotted paths like `${{ workspace.tag }}`.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(TEMPLATE_RE, (match, key: string) => {
    return vars[key] ?? match; // leave unresolved templates as-is
  });
}

// ── Model resolution ──────────────────────────────────────────────────────

/**
 * Resolve a ModelSpec (string or object) into a normalized ResolvedModel.
 *
 * Supports:
 * - `"claude-sonnet-4-5"` → { id: "claude-sonnet-4-5", full: "claude-sonnet-4-5" }
 * - `"anthropic:claude-sonnet-4-5"` → { id: "claude-sonnet-4-5", provider: "anthropic", full: "anthropic:claude-sonnet-4-5" }
 * - `{ id: "claude-sonnet-4-5", provider: "anthropic", temperature: 0.7 }` → resolved object
 */
export function resolveModel(spec: ModelSpec): ResolvedModel {
  if (typeof spec === "string") {
    const colonIdx = spec.indexOf(":");
    if (colonIdx > 0) {
      const provider = spec.slice(0, colonIdx);
      const id = spec.slice(colonIdx + 1);
      return { id, provider, full: spec };
    }
    return { id: spec, full: spec };
  }

  // Object form
  const full = spec.provider ? `${spec.provider}:${spec.id}` : spec.id;
  return {
    id: spec.id,
    provider: spec.provider,
    full,
    temperature: spec.temperature,
    max_tokens: spec.max_tokens,
  };
}

// ── Setup step runner ─────────────────────────────────────────────────────

/**
 * Run setup steps sequentially, collecting captured variables.
 * Each step runs a shell command; if `as` is specified, stdout is captured.
 */
export async function runSetupSteps(
  steps: SetupStep[],
  baseVars: Record<string, string> = {},
): Promise<Record<string, string>> {
  const vars = { ...baseVars };

  for (const step of steps) {
    const cmd = interpolate(step.shell, vars);
    const result = await execa("sh", ["-c", cmd], { reject: false });

    if (result.exitCode !== 0) {
      throw new Error(
        `Setup step failed (exit ${result.exitCode}): ${cmd}\nstderr: ${result.stderr.trim()}`,
      );
    }

    if (step.as) {
      vars[step.as] = result.stdout.trim();
    }
  }

  return vars;
}

// ── YAML parsing ──────────────────────────────────────────────────────────

/** Parse a YAML string into a WorkspaceDef. */
export function parseWorkspaceDef(content: string): WorkspaceDef {
  const raw = parseYaml(content);

  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid workspace definition: expected an object");
  }

  if (!raw.name || typeof raw.name !== "string") {
    throw new Error("Invalid workspace definition: 'name' is required");
  }

  if (!raw.agents || typeof raw.agents !== "object") {
    throw new Error("Invalid workspace definition: 'agents' map is required");
  }

  return raw as WorkspaceDef;
}

// ── Full config loader ────────────────────────────────────────────────────

export interface LoadOptions {
  /** Instance tag for multi-instance isolation. */
  tag?: string;
  /** Extra template variables. */
  vars?: Record<string, string>;
  /** Skip running setup steps (useful for dry-run / validation). */
  skipSetup?: boolean;
}

/**
 * Load a workspace definition from a YAML file or string, run setup steps,
 * and interpolate templates. Returns the resolved workspace.
 */
export async function loadWorkspaceDef(
  pathOrContent: string,
  opts: LoadOptions = {},
): Promise<ResolvedWorkspace> {
  // Determine if it's a file path or raw YAML content
  let content: string;
  if (pathOrContent.includes("\n") || pathOrContent.trimStart().startsWith("name:")) {
    content = pathOrContent;
  } else {
    try {
      await access(pathOrContent);
    } catch {
      throw new Error(`Workspace definition not found: ${pathOrContent}`);
    }
    content = await readFile(pathOrContent, "utf-8");
  }

  const def = parseWorkspaceDef(content);

  // Resolve agents (runtime + model)
  const agents: ResolvedAgent[] = [];
  for (const [name, agentDef] of Object.entries(def.agents)) {
    const modelSpec = agentDef.model ? resolveModel(agentDef.model) : undefined;

    // Resolve runtime with defaults/discovery
    const resolution = opts.skipSetup
      ? // In dry-run mode, don't do CLI discovery — just apply simple defaults
        {
          runtime: agentDef.runtime ?? (modelSpec ? "ai-sdk" : undefined),
          model: modelSpec?.full,
        }
      : await resolveRuntime(agentDef.runtime, modelSpec?.full);

    // If runtime resolution found a model and agent didn't specify one, use it
    const finalModel = modelSpec ?? (resolution.model ? resolveModel(resolution.model) : undefined);

    agents.push({
      name,
      runtime: resolution.runtime,
      model: finalModel,
      instructions: agentDef.instructions,
      channels: agentDef.channels,
    });
  }

  // Build template vars
  const baseVars: Record<string, string> = {
    ...opts.vars,
    "workspace.name": def.name,
  };
  if (opts.tag) {
    baseVars["workspace.tag"] = opts.tag;
  }

  // Run setup steps
  let setupVars: Record<string, string> = {};
  if (def.setup && !opts.skipSetup) {
    setupVars = await runSetupSteps(def.setup, baseVars);
  }

  // Merge all vars for kickoff interpolation
  const allVars = { ...baseVars, ...setupVars };

  // Interpolate kickoff
  const kickoff = def.kickoff ? interpolate(def.kickoff, allVars) : undefined;

  return { def, agents, vars: setupVars, kickoff };
}

// ── Saved connection loading ──────────────────────────────────────────────

interface TelegramConnection {
  bot_token: string;
  chat_id: number;
}

async function loadSavedTelegramConnection(): Promise<TelegramConnection | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const path = join(homedir(), ".agent-worker", "connections", "telegram.json");
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Adapter resolution ───────────────────────────────────────────────────

/**
 * Resolve adapter definitions from YAML into ChannelAdapter instances.
 * Currently supports: "telegram".
 *
 * Config resolution order (each field independently):
 *   1. Explicit YAML config value
 *   2. Environment variable (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)
 *   3. Saved connection from `aw connect` (~/.agent-worker/connections/)
 */
export async function resolveAdapters(defs?: AdapterDef[]): Promise<ChannelAdapter[]> {
  if (!defs || defs.length === 0) return [];

  const adapters: ChannelAdapter[] = [];
  for (const def of defs) {
    switch (def.platform) {
      case "telegram": {
        const { TelegramAdapter } = await import("../adapters/telegram.ts");
        const cfg = def.config as {
          bot_token?: string;
          chat_id?: number;
          channel?: string;
          poll_timeout?: number;
        };

        // Load saved connection as fallback
        const saved = await loadSavedTelegramConnection();

        const botToken =
          cfg.bot_token ??
          process.env.TELEGRAM_BOT_TOKEN ??
          saved?.bot_token;
        if (!botToken) {
          throw new Error(
            "Telegram adapter requires bot_token in config, TELEGRAM_BOT_TOKEN env var, " +
            "or a saved connection (run 'aw connect telegram')",
          );
        }
        const chatId =
          cfg.chat_id ??
          (process.env.TELEGRAM_CHAT_ID ? parseInt(process.env.TELEGRAM_CHAT_ID, 10) : undefined) ??
          saved?.chat_id;
        adapters.push(
          new TelegramAdapter({
            botToken,
            chatId,
            channel: cfg.channel,
            pollTimeout: cfg.poll_timeout,
          }),
        );
        break;
      }
      default:
        throw new Error(`Unknown adapter platform: "${def.platform}"`);
    }
  }
  return adapters;
}

// ── Convert to WorkspaceConfig ────────────────────────────────────────────

export interface ToWorkspaceConfigOptions extends LoadOptions {
  /** Override the storage directory (takes precedence over def.storage_dir and the default). */
  storageDir?: string;
  /** Pre-resolved adapters to attach. */
  adapters?: ChannelAdapter[];
}

/**
 * Convert a resolved workspace definition into a WorkspaceConfig
 * suitable for createWorkspace().
 */
export function toWorkspaceConfig(
  resolved: ResolvedWorkspace,
  opts: ToWorkspaceConfigOptions = {},
): WorkspaceConfig {
  const { def } = resolved;

  // Storage backend
  const storageType = def.storage ?? "file";
  const storageDir =
    opts.storageDir ??
    def.storage_dir ??
    `/tmp/agent-worker-${def.name}${opts.tag ? `-${opts.tag}` : ""}`;
  const storage = storageType === "memory" ? new MemoryStorage() : new FileStorage(storageDir);

  return {
    name: def.name,
    tag: opts.tag,
    channels: def.channels,
    defaultChannel: def.default_channel,
    agents: resolved.agents.map((a) => a.name),
    adapters: opts.adapters,
    storage,
    storageDir: storageType === "file" ? storageDir : undefined,
  };
}
