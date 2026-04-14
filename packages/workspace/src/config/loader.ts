import { parse as parseYaml } from "yaml";
import { readFile, access } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { execa } from "execa";
import type {
  AgentDef,
  AgentRole,
  WorkspaceDef,
  ConnectionDef,
  ResolvedWorkspace,
  ResolvedAgent,
  ResolvedModel,
  ModelSpec,
  McpServerDef,
  MountDef,
  PolicyDef,
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
 * - `"model-name"` → { id: "model-name", full: "model-name" }
 * - `"provider:model-name"` → { id: "model-name", provider: "provider", full: "provider:model-name" }
 * - `{ id: "model-name", provider: "provider", temperature: 0.7 }` → resolved object
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

/**
 * Fail fast on typos in a policy block — the loop factory accepts
 * whatever we pass and the underlying SDKs have cryptic error
 * messages when they see an unknown permissionMode / sandbox value.
 * Centralise the whitelist here so a typo at workspace creation
 * time gets a clear message pointing at the offending field.
 */
const POLICY_PERMISSION_MODES: ReadonlySet<string> = new Set([
  "default",
  "acceptEdits",
  "bypassPermissions",
]);
const POLICY_SANDBOX_MODES: ReadonlySet<string> = new Set([
  "read-only",
  "workspace-write",
  "danger-full-access",
]);

/**
 * Normalise `AgentDef.worktree` into a fully-resolved
 * `ResolvedAgent.worktree`. Relative repo paths are anchored to
 * the config file directory. Legacy boolean form (from when
 * repo lived on the workspace) fails loud with a migration hint.
 */
function resolveAgentWorktree(
  raw: AgentDef["worktree"],
  agentName: string,
  configDir: string | undefined,
): { repoPath: string; baseBranch: string } | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "boolean") {
    throw new Error(
      `Agent "${agentName}" uses legacy \`worktree: true\` form. Replace with ` +
        `\`worktree: { repo: <path>, base_branch?: <branch> }\`. The workspace no longer ` +
        `holds a repo — each worktree-enabled agent points at its own source repo. ` +
        `See docs/design/phase-1-worktree-isolation/README.md.`,
    );
  }
  if (typeof raw !== "object" || typeof (raw as { repo?: unknown }).repo !== "string") {
    throw new Error(
      `Agent "${agentName}" worktree spec must be an object with a \`repo\` string. Got: ${JSON.stringify(raw)}`,
    );
  }
  const spec = raw as { repo: string; base_branch?: string };
  let repoPath = spec.repo;
  if (configDir && !repoPath.startsWith("/")) {
    repoPath = resolve(configDir, repoPath);
  }
  return { repoPath, baseBranch: spec.base_branch ?? "main" };
}

function validatePolicyDef(policy: PolicyDef, agentName: string): void {
  if (policy.permissionMode !== undefined && !POLICY_PERMISSION_MODES.has(policy.permissionMode)) {
    throw new Error(
      `Invalid policy.permissionMode for agent "${agentName}": "${policy.permissionMode}". ` +
        `Expected one of: ${[...POLICY_PERMISSION_MODES].join(", ")}.`,
    );
  }
  if (policy.sandbox !== undefined && !POLICY_SANDBOX_MODES.has(policy.sandbox)) {
    throw new Error(
      `Invalid policy.sandbox for agent "${agentName}": "${policy.sandbox}". ` +
        `Expected one of: ${[...POLICY_SANDBOX_MODES].join(", ")}.`,
    );
  }
  if (policy.fullAuto !== undefined && typeof policy.fullAuto !== "boolean") {
    throw new Error(
      `Invalid policy.fullAuto for agent "${agentName}": expected a boolean, got ${typeof policy.fullAuto}.`,
    );
  }
}

function normalizeMcpServerDef(server: Record<string, unknown>): McpServerDef {
  if (server.oauth !== undefined) {
    throw new Error("Remote MCP OAuth configuration is not supported");
  }

  return {
    type:
      (server.type as McpServerDef["type"] | undefined) ??
      (typeof server.command === "string" ? "stdio" : undefined),
    command: typeof server.command === "string" ? server.command : undefined,
    args: Array.isArray(server.args)
      ? server.args.filter((v): v is string => typeof v === "string")
      : undefined,
    env:
      server.env && typeof server.env === "object"
        ? Object.fromEntries(
            Object.entries(server.env as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined,
    url: typeof server.url === "string" ? server.url : undefined,
    headers:
      server.headers && typeof server.headers === "object"
        ? Object.fromEntries(
            Object.entries(server.headers as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined,
    bearerTokenEnvVar:
      typeof server.bearerTokenEnvVar === "string"
        ? server.bearerTokenEnvVar
        : typeof server.bearer_token_env_var === "string"
          ? (server.bearer_token_env_var as string)
          : undefined,
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
  const rawWorkspaceMcp =
    (def as WorkspaceDef & { mcp?: Record<string, unknown>; mcpServers?: Record<string, unknown> })
      .mcp ??
    (
      def as WorkspaceDef & {
        mcp_servers?: Record<string, unknown>;
        mcpServers?: Record<string, unknown>;
      }
    ).mcp_servers ??
    (def as WorkspaceDef & { mcpServers?: Record<string, unknown> }).mcpServers;
  const workspaceMcpServers =
    rawWorkspaceMcp && typeof rawWorkspaceMcp === "object"
      ? Object.fromEntries(
          Object.entries(rawWorkspaceMcp).map(([serverName, serverDef]) => [
            serverName,
            normalizeMcpServerDef((serverDef ?? {}) as Record<string, unknown>),
          ]),
        )
      : undefined;

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

    // Role: explicit override wins; otherwise lead iff workspace.lead matches.
    const role: AgentRole = agentDef.role ?? (def.lead === name ? "lead" : "worker");
    const rawMcp =
      (agentDef as AgentDef & { mcpServers?: Record<string, unknown> }).mcp ??
      (agentDef as AgentDef & { mcpServers?: Record<string, unknown> }).mcp_servers ??
      (agentDef as AgentDef & { mcpServers?: Record<string, unknown> }).mcpServers;
    const agentMcpServers =
      rawMcp && typeof rawMcp === "object"
        ? Object.fromEntries(
            Object.entries(rawMcp).map(([serverName, serverDef]) => [
              serverName,
              normalizeMcpServerDef((serverDef ?? {}) as Record<string, unknown>),
            ]),
          )
        : undefined;
    const mcpServers =
      workspaceMcpServers || agentMcpServers
        ? {
            ...workspaceMcpServers,
            ...agentMcpServers,
          }
        : undefined;

    // Phase 3 control-boundary policy: workspace provides the
    // defaults, agent overrides field-by-field. Undefined fields
    // are left undefined so the factory can apply its own
    // fallback — we do not eagerly substitute here.
    const policy =
      def.policy || agentDef.policy
        ? {
            ...def.policy,
            ...agentDef.policy,
          }
        : undefined;
    if (policy) validatePolicyDef(policy, name);

    // Phase 1 worktree spec: every worktree-enabled agent points
    // at its own source repo. The workspace itself is not git-
    // aware — this is a pure per-agent concern. Reject legacy
    // boolean form with a migration hint so old configs fail
    // loud at load time instead of silently missing a repo.
    const resolvedWorktree = resolveAgentWorktree(agentDef.worktree, name, configDir);

    agents.push({
      name,
      runtime: resolution.runtime,
      model: finalModel,
      instructions: agentDef.instructions,
      channels: agentDef.channels,
      env: mergedEnv,
      mounts: resolvedMounts,
      on_demand: agentDef.on_demand,
      role,
      worktree: resolvedWorktree,
      mcpServers,
      policy,
    });
  }

  // Reject legacy workspace-level repo block with a clear
  // migration error. Keeping the field silently ignored would
  // let old configs load with no worktrees provisioned, which
  // is worse than failing loudly.
  if ((def as unknown as { repo?: unknown }).repo !== undefined) {
    throw new Error(
      "Workspace-level `repo` block is no longer supported. Move it onto the " +
        "agent(s) that actually need a worktree: `agents.<name>.worktree: { repo, base_branch? }`. " +
        "See docs/design/phase-1-worktree-isolation/README.md.",
    );
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
    mcpServers: workspaceMcpServers,
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
  } catch {
    /* not found */
  }

  // Fall back to legacy flat path: connections/telegram.json
  if (name === platform) {
    try {
      const raw = await readFile(join(baseDir, `${platform}.json`), "utf-8");
      return JSON.parse(raw);
    } catch {
      /* not found */
    }
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
        const source = cfg.bot_token
          ? "config"
          : envToken
            ? "env"
            : saved
              ? `saved(${def.name ?? "telegram"})`
              : "unknown";
        console.error(
          `[connection] telegram${def.name ? `(${def.name})` : ""}: resolved from ${source}`,
        );
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

  const onDemandAgents = resolved.agents.filter((a) => a.on_demand).map((a) => a.name);

  // Collect the unique source-repo paths referenced by any agent's
  // worktree spec. The workspace runtime needs this list only to
  // run `pruneWorktrees` at init time across every distinct repo
  // after a crash — it never talks to git otherwise.
  const worktreeRepoSet = new Set<string>();
  for (const agent of resolved.agents) {
    if (agent.worktree?.repoPath) {
      worktreeRepoSet.add(agent.worktree.repoPath);
    }
  }
  const worktreeRepos = worktreeRepoSet.size > 0 ? [...worktreeRepoSet] : undefined;

  return {
    name: def.name,
    tag: opts.tag,
    channels: def.channels,
    defaultChannel: def.default_channel,
    agents: resolved.agents.map((a) => a.name),
    lead: def.lead,
    onDemandAgents: onDemandAgents.length > 0 ? onDemandAgents : undefined,
    connections: opts.connections,
    storage,
    sandboxBaseDir: opts.sandboxBaseDir,
    storageDir: storageType === "file" ? storageDir : undefined,
    worktreeRepos,
  };
}
