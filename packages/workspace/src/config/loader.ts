import { parse as parseYaml } from "yaml";
import { readFile, access } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { execa } from "execa";
import type {
  WorkspaceDef,
  ConnectionDef,
  ResolvedWorkspace,
  ResolvedAgent,
  ResolvedModel,
  ModelSpec,
  MountDef,
  SetupStep,
} from "./types.ts";
import type { WorkspaceConfig, ChannelAdapter } from "../types.ts";
import { MemoryStorage, FileStorage } from "../context/storage.ts";
/** Callback to resolve runtime+model for an agent. Injected by the orchestrator. */
export type RuntimeResolver = (
  runtime?: string,
  model?: string,
) => Promise<{ runtime: string; model?: string }>;

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
  opts?: { cwd?: string },
): Promise<Record<string, string>> {
  const vars = { ...baseVars };

  for (const step of steps) {
    const cmd = interpolate(step.shell, vars);
    const result = await execa("sh", ["-c", cmd], {
      reject: false,
      cwd: opts?.cwd,
    });

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

  if (raw.name !== undefined && typeof raw.name !== "string") {
    throw new Error("Invalid workspace definition: 'name' must be a string");
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
  /** Fallback name when YAML doesn't specify one and path inference isn't possible. */
  name?: string;
  /** Optional callback to resolve runtime+model for agents. If not provided, uses simple defaults. */
  resolveRuntime?: RuntimeResolver;
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
  let filePath: string | undefined;
  if (pathOrContent.includes("\n") || pathOrContent.trimStart().startsWith("agents:")) {
    content = pathOrContent;
  } else {
    filePath = pathOrContent;
    try {
      await access(filePath);
    } catch {
      throw new Error(`Workspace definition not found: ${filePath}`);
    }
    content = await readFile(filePath, "utf-8");
  }

  // Interpolate ${{ secrets.X }} references before parsing YAML.
  // Resolution order: secrets.json → process.env
  // Always run (even with skipSetup) — secrets are needed for connection config.
  if (content.includes("${{ secrets.")) {
    const { loadSecrets } = await import("./secrets.ts");
    const secrets = await loadSecrets();
    const secretVars: Record<string, string> = {};
    // Collect all ${{ secrets.KEY }} references from the YAML
    const refs = new Set<string>();
    for (const m of content.matchAll(/\$\{\{\s*secrets\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) {
      refs.add(m[1]!);
    }
    for (const key of refs) {
      const value = secrets[key] ?? process.env[key];
      if (value !== undefined) {
        secretVars[`secrets.${key}`] = value;
      }
    }
    content = interpolate(content, secretVars);
  }

  const def = parseWorkspaceDef(content);

  // Name resolution priority: YAML name → file name → opts.name → error
  if (!def.name && filePath) {
    const file = basename(filePath);
    // _global.yml → global, review.yml → review
    def.name = file.replace(/\.(ya?ml)$/, "").replace(/^_/, "");
  }
  if (!def.name) {
    def.name = opts.name;
  }
  if (!def.name) {
    throw new Error(
      "Workspace name is required: set 'name' in YAML, use a named file, or pass opts.name",
    );
  }

  // Resolve agents (runtime + model)
  const agents: ResolvedAgent[] = [];
  for (const [name, agentDef] of Object.entries(def.agents)) {
    const modelSpec = agentDef.model ? resolveModel(agentDef.model) : undefined;

    // Resolve runtime with defaults/discovery
    const simpleDefault = {
      runtime: agentDef.runtime ?? (modelSpec ? "ai-sdk" : undefined),
      model: modelSpec?.full,
    };
    const resolution =
      opts.skipSetup || !opts.resolveRuntime
        ? simpleDefault
        : await opts.resolveRuntime(agentDef.runtime, modelSpec?.full);

    // Merge workspace-level env + agent-level env (agent wins)
    const mergedEnv = def.env || agentDef.env ? { ...def.env, ...agentDef.env } : undefined;

    // Normalize mounts: string → MountDef, resolve relative paths
    const configDir = filePath ? dirname(filePath) : undefined;
    const resolvedMounts = agentDef.mounts?.map((m): MountDef => {
      const mount: MountDef =
        typeof m === "string"
          ? { source: m, target: basename(m) }
          : { ...m, target: m.target ?? basename(m.source) };
      // Resolve relative source paths against config file directory
      if (!mount.source.startsWith("/") && configDir) {
        mount.source = resolve(configDir, mount.source);
      }
      return mount;
    });

    // If runtime resolution found a model and agent didn't specify one, use it
    const finalModel = modelSpec ?? (resolution.model ? resolveModel(resolution.model) : undefined);

    agents.push({
      name,
      runtime: resolution.runtime,
      model: finalModel,
      instructions: agentDef.instructions,
      channels: agentDef.channels,
      env: mergedEnv,
      mounts: resolvedMounts,
    });
  }

  // Validate lead references an existing agent
  if (def.lead && !def.agents[def.lead]) {
    throw new Error(
      `Invalid workspace definition: 'lead' references unknown agent "${def.lead}". ` +
        `Available agents: ${Object.keys(def.agents).join(", ")}`,
    );
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

  return {
    def: def as WorkspaceDef & { name: string },
    agents,
    vars: setupVars,
    kickoff,
    configDir: filePath ? dirname(filePath) : undefined,
  };
}

// ── Saved connection loading ──────────────────────────────────────────────

interface SavedConnection {
  bot_token?: string;
  chat_id?: number;
  [key: string]: unknown;
}

/**
 * Load a saved connection by platform and name.
 * Checks two paths for backwards compatibility:
 *   1. ~/.agent-worker/connections/{platform}/{name}.json  (new, named)
 *   2. ~/.agent-worker/connections/{platform}.json          (legacy, name="default" only)
 */
async function loadSavedConnection(
  platform: string,
  name?: string,
): Promise<SavedConnection | null> {
  name ??= platform;
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { homedir } = await import("node:os");
  const baseDir = join(homedir(), ".agent-worker", "connections");

  // Try named path first: connections/telegram/dev-bot.json
  try {
    const raw = await readFile(join(baseDir, platform, `${name}.json`), "utf-8");
    return JSON.parse(raw);
  } catch { /* not found */ }

  // Fall back to legacy flat path: connections/telegram.json
  if (name === platform) {
    try {
      const raw = await readFile(join(baseDir, `${platform}.json`), "utf-8");
      return JSON.parse(raw);
    } catch { /* not found */ }
  }

  return null;
}

/**
 * Save a connection by platform and name.
 * Writes to: ~/.agent-worker/connections/{platform}/{name}.json
 */
export async function saveConnection(
  platform: string,
  data: Record<string, unknown>,
  name?: string,
): Promise<string> {
  name ??= platform;
  const { writeFile, mkdir } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { homedir } = await import("node:os");
  const dir = join(homedir(), ".agent-worker", "connections", platform);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${name}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}

// ── Connection resolution ─────────────────────────────────────────────────

/**
 * Resolve connection definitions from YAML into ChannelAdapter instances.
 * Currently supports: "telegram".
 *
 * Config resolution order (each field independently):
 *   1. Explicit YAML config value
 *   2. Environment variable (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)
 *   3. Saved connection from `aw connect` (~/.agent-worker/connections/{platform}/{name}.json)
 */
export async function resolveConnections(
  defs?: ConnectionDef[],
  opts?: {
    getAgents?: () => Promise<Array<{ name: string; status: string; task?: string }>>;
    pauseAll?: () => Promise<void>;
    resumeAll?: () => Promise<void>;
    pauseAgent?: (name: string) => Promise<void>;
    resumeAgent?: (name: string) => Promise<void>;
  },
): Promise<ChannelAdapter[]> {
  if (!defs || defs.length === 0) return [];

  const adapters: ChannelAdapter[] = [];
  for (const def of defs) {
    switch (def.platform) {
      case "telegram": {
        const { TelegramAdapter } = await import("../adapters/telegram.ts");
        const cfg = (def.config ?? {}) as {
          bot_token?: string;
          chat_id?: number;
          channel?: string;
          poll_timeout?: number;
        };

        // Load saved connection by name (falls back to platform name)
        const saved = await loadSavedConnection("telegram", def.name);
        // Env vars only apply to the primary (unnamed) connection.
        // Named connections must use explicit config or saved connection files.
        const isPrimary = !def.name || def.name === "telegram";
        const envToken = isPrimary ? process.env.TELEGRAM_BOT_TOKEN : undefined;
        const envChatId = isPrimary ? process.env.TELEGRAM_CHAT_ID : undefined;

        const botToken = cfg.bot_token ?? envToken ?? saved?.bot_token;
        if (!botToken) {
          const nameHint = def.name ? ` --name ${def.name}` : "";
          throw new Error(
            `Telegram connection${def.name ? ` "${def.name}"` : ""} requires bot_token in config, ` +
              `${isPrimary ? "TELEGRAM_BOT_TOKEN env var, or " : ""}a saved connection (run 'aw connect telegram${nameHint}')`,
          );
        }
        const parsedChatId = envChatId ? parseInt(envChatId, 10) : undefined;
        if (parsedChatId !== undefined && isNaN(parsedChatId)) {
          throw new Error("TELEGRAM_CHAT_ID env var must be a numeric value");
        }
        const chatId = cfg.chat_id ?? parsedChatId ?? saved?.chat_id;
        const source = cfg.bot_token ? "config" : envToken ? "env" : saved ? `saved(${def.name ?? "telegram"})` : "unknown";
        console.error(`[connection] telegram${def.name ? `(${def.name})` : ""}: resolved from ${source}`);
        adapters.push(
          new TelegramAdapter({
            botToken,
            chatId,
            channel: cfg.channel,
            pollTimeout: cfg.poll_timeout,
            getAgents: opts?.getAgents,
            pauseAll: opts?.pauseAll,
            resumeAll: opts?.resumeAll,
            pauseAgent: opts?.pauseAgent,
            resumeAgent: opts?.resumeAgent,
          }),
        );
        break;
      }
      default:
        throw new Error(`Unknown connection platform: "${def.platform}"`);
    }
  }
  return adapters;
}

// ── Convert to WorkspaceConfig ────────────────────────────────────────────

export interface ToWorkspaceConfigOptions extends LoadOptions {
  /** Override the data directory (takes precedence over def.data_dir and the default). */
  storageDir?: string;
  /** Separate base directory for sandboxes (when storageDir points to a repo). */
  sandboxBaseDir?: string;
  /** Pre-resolved connections to attach. */
  connections?: ChannelAdapter[];
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
  // Resolve data_dir relative to config file directory (per ADR-0001)
  let resolvedDataDir = def.data_dir;
  if (resolvedDataDir && resolved.configDir && !resolvedDataDir.startsWith("/")) {
    resolvedDataDir = resolve(resolved.configDir, resolvedDataDir);
  }
  const storageDir =
    opts.storageDir ??
    resolvedDataDir ??
    `/tmp/agent-worker-${def.name}${opts.tag ? `-${opts.tag}` : ""}`;
  const storage = storageType === "memory" ? new MemoryStorage() : new FileStorage(storageDir);

  return {
    name: def.name,
    tag: opts.tag,
    channels: def.channels,
    defaultChannel: def.default_channel,
    agents: resolved.agents.map((a) => a.name),
    lead: def.lead,
    connections: opts.connections,
    storage,
    sandboxBaseDir: opts.sandboxBaseDir,
    storageDir: storageType === "file" ? storageDir : undefined,
  };
}
