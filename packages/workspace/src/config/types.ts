// ── Workspace definition types ────────────────────────────────────────────
// Declarative workspace configuration, loaded from YAML files.

/** Model configuration object form. */
export interface ModelDef {
  /** Model identifier. */
  id: string;
  /** Provider override (e.g. "anthropic", "openai"). Inferred from id if omitted. */
  provider?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum output tokens. */
  max_tokens?: number;
}

/**
 * Model specification — supports three forms in YAML:
 *
 * ```yaml
 * # String shorthand
 * model: model-name
 *
 * # Provider:model shorthand (AI SDK style)
 * model: provider:model-name
 *
 * # Object form (with parameters)
 * model:
 *   id: model-name
 *   provider: provider-name
 *   temperature: 0.7
 * ```
 */
export type ModelSpec = string | ModelDef;

/** Mount point definition — maps an external directory into an agent's sandbox. */
export interface MountDef {
  /** Absolute or config-relative path to the source directory. */
  source: string;
  /** Target name inside the sandbox (defaults to basename of source). */
  target?: string;
  /** If true, mount is read-only (advisory — enforced at runtime layer). */
  readonly?: boolean;
}

/**
 * Role of an agent in the workspace-led hierarchy.
 *
 * - `lead` — long-lived workspace coordinator. One per workspace by convention.
 *   Usually inferred from `workspace.lead` rather than written here.
 * - `worker` — task-scoped executor. The default for all agents unless
 *   explicitly overridden. Note: the static `AgentDef` is a worker-capable
 *   template; actual task-scoped worker instances are materialized at
 *   runtime as Attempts bound to a (task, agent) pair.
 * - `observer` — automation / bot / reporter member. Not launched as a
 *   task-scoped worker. The existing `on_demand: true` flag already covers
 *   many of these cases; mark explicitly when you want hook / profile
 *   behavior to diverge.
 */
export type AgentRole = "lead" | "worker" | "observer";

/**
 * Static member definition ("AgentSpec") within a workspace config.
 *
 * This is a template — it describes a worker-capable pool member, not a
 * runtime instance. Runtime task-scoped workers are derived from this spec
 * at assignment time via the profile resolver + orchestrator.
 */
export interface AgentDef {
  /** LLM runtime: "ai-sdk" | "claude-code" | "codex" | "cursor" | "mock". */
  runtime?: string;
  /** Model specification (string or object). */
  model?: ModelSpec;
  /** Instructions for this agent (system prompt). */
  instructions?: string;
  /** Channels this agent should join (in addition to default). */
  channels?: string[];
  /** Environment variable overrides for this agent (merged on top of workspace-level env). */
  env?: Record<string, string>;
  /** Filesystem mount points (symlinked into the agent's sandbox). */
  mounts?: (string | MountDef)[];
  /** If true, agent loop is not started automatically — only launched when @mentioned. */
  on_demand?: boolean;
  /**
   * Explicit role override. If omitted, role is inferred:
   *   - agents[name] === workspace.lead → "lead"
   *   - else → "worker"
   * Set this to "observer" for automation/bot members that should NOT be
   * derived into task-scoped Attempts.
   */
  role?: AgentRole;
}

/** Setup step: run a shell command, optionally capture output as a variable. */
export interface SetupStep {
  /** Shell command to execute. */
  shell: string;
  /** Variable name to capture stdout into (available in templates as ${{ name }}). */
  as?: string;
}

/** Connection definition for external platform bridges. */
export interface ConnectionDef {
  /** Platform type: "telegram". */
  platform: string;
  /** Connection name for multiple connections of the same platform.
   *  Defaults to the platform name (e.g. "telegram"). Used to resolve
   *  saved connections: ~/.agent-worker/connections/{platform}/{name}.json */
  name?: string;
  /** Platform-specific configuration (optional if saved via `aw connect`). */
  config?: Record<string, unknown>;
}

/** Declarative workspace definition (typically loaded from YAML). */
export interface WorkspaceDef {
  /** Workspace name. Optional — inferred from file name or opts.name when omitted. */
  name?: string;
  /** Human-readable display name. Shown in UI instead of the machine name. */
  label?: string;
  /** Agent definitions. Keys are agent names. */
  agents: Record<string, AgentDef>;
  /** Channel names to create. Default: ["general"]. */
  channels?: string[];
  /** Default channel for kickoff messages. Default: "general". */
  default_channel?: string;
  /** Storage backend: "memory" | "file". Default: "file". */
  storage?: "memory" | "file";
  /** Custom data directory. Relative paths resolve from config file location. */
  data_dir?: string;
  /** Setup steps to run before kickoff. */
  setup?: SetupStep[];
  /** Kickoff message (template string with ${{ var }} interpolation and @mentions). */
  kickoff?: string;
  /** External platform connections. */
  connections?: ConnectionDef[];
  /** Workspace-level environment variables (applied to all agents as defaults). */
  env?: Record<string, string>;
  /** Optional team lead agent name. The lead gets debug tools + all-channel access. */
  lead?: string;
}

/** Resolved model — normalized from any ModelSpec form. */
export interface ResolvedModel {
  /** Model identifier (without provider prefix). */
  id: string;
  /** Provider name (e.g. "anthropic", "openai"). */
  provider?: string;
  /** Full model string for AI SDK ("provider:id") or CLI runtimes ("id"). */
  full: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum output tokens. */
  max_tokens?: number;
}

/** Resolved agent — normalized from AgentDef. */
export interface ResolvedAgent {
  /** Agent name. */
  name: string;
  /** LLM runtime. */
  runtime?: string;
  /** Resolved model. */
  model?: ResolvedModel;
  /** Instructions for this agent. */
  instructions?: string;
  /** Channels this agent should join. */
  channels?: string[];
  /** Merged environment variables (workspace defaults + agent overrides). */
  env?: Record<string, string>;
  /** Resolved filesystem mount points. */
  mounts?: MountDef[];
  /** If true, agent loop is not started automatically — only launched when @mentioned. */
  on_demand?: boolean;
  /** Resolved role: explicit AgentDef.role wins, else derived from workspace.lead. */
  role: AgentRole;
}

/** Result of loading and resolving a workspace definition. */
export interface ResolvedWorkspace {
  /** The parsed and validated definition (name is guaranteed after resolution). */
  def: WorkspaceDef & { name: string };
  /** Resolved agents (normalized model specs). */
  agents: ResolvedAgent[];
  /** Variables from setup steps (name → stdout). */
  vars: Record<string, string>;
  /** The interpolated kickoff message (or undefined if no kickoff). */
  kickoff?: string;
  /** Directory of the source config file (used to resolve relative data_dir). */
  configDir?: string;
}
