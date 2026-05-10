// ── Harness definition types ────────────────────────────────────────────
// Declarative harness configuration, loaded from YAML files.

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

export interface McpServerDef {
  /** Transport type. Defaults to "stdio" when command is present. */
  type?: "stdio" | "http" | "sse";
  /** Command for stdio MCP servers. */
  command?: string;
  /** Arguments for stdio MCP servers. */
  args?: string[];
  /** Environment variables for stdio MCP servers. */
  env?: Record<string, string>;
  /** URL for remote HTTP/SSE MCP servers. */
  url?: string;
  /** Optional static headers for remote MCP servers. */
  headers?: Record<string, string>;
  /** Optional env var name containing a bearer token for compatible clients. */
  bearerTokenEnvVar?: string;
}

/**
 * Control-boundary policy (phase 3). Every field is optional —
 * missing values fall through to the daemon default, which stays
 * aggressive until a follow-up commit flips it. Precedence when
 * both harness and agent declare a policy is field-by-field
 * with agent winning, so a harness can hold the whole team
 * read-only while one coder opts into write access.
 *
 * See docs/design/phase-3-control-boundaries/README.md.
 */
export interface PolicyDef {
  /**
   * Claude Code approval gate. Default: "bypassPermissions"
   * (skip every prompt — the current behavior). Set to "default"
   * or "acceptEdits" to re-introduce the Claude Code permission
   * UI for destructive tools.
   */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  /**
   * Codex auto-approval. Default: true (approvalPolicy=never).
   * Set to false to fall back to "on-request" approval — note
   * that agent-worker does not yet intercept those prompts, so
   * `fullAuto: false` with codex will currently hang. Shipping
   * the knob regardless, so the plumbing is ready when the
   * approval bridge lands.
   */
  fullAuto?: boolean;
  /**
   * Codex shell sandbox mode. Default: "harness-write" when
   * `fullAuto` is true. Useful to drop a codex reviewer into
   * "read-only" while leaving the coder in "harness-write".
   */
  sandbox?: "read-only" | "harness-write" | "danger-full-access";
}

/**
 * Role of an agent in the harness-led hierarchy.
 *
 * - `lead` — long-lived harness coordinator. One per harness by convention.
 *   Usually inferred from `harness.lead` rather than written here.
 * - `worker` — task-scoped executor. The default for all agents unless
 *   explicitly overridden. Note: the static `AgentDef` is a worker-capable
 *   template; actual task-scoped worker instances are materialized at
 *   runtime as Wakes bound to a (task, agent) pair.
 * - `observer` — automation / bot / reporter member. Not launched as a
 *   task-scoped worker. The existing `on_demand: true` flag already covers
 *   many of these cases; mark explicitly when you want hook / profile
 *   behavior to diverge.
 */
export type AgentRole = "lead" | "worker" | "observer";

/**
 * Static member definition ("AgentSpec") within a harness config.
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
  /** Environment variable overrides for this agent (merged on top of harness-level env). */
  env?: Record<string, string>;
  /** Filesystem mount points (symlinked into the agent's sandbox). */
  mounts?: (string | MountDef)[];
  /** If true, agent loop is not started automatically — only launched when @mentioned. */
  on_demand?: boolean;
  /**
   * Explicit role override. If omitted, role is inferred:
   *   - agents[name] === harness.lead → "lead"
   *   - else → "worker"
   * Set this to "observer" for automation/bot members that should NOT be
   * derived into task-scoped Wakes.
   */
  role?: AgentRole;
  // (no `worktree` field — worktrees are created at runtime via the
  //  `worktree_create` MCP tool, see phase-1 design doc)
  /** Additional external MCP servers for CLI runtimes. */
  mcp?: Record<string, McpServerDef>;
  /** Alias for `mcp` in YAML. */
  mcp_servers?: Record<string, McpServerDef>;
  /**
   * Control-boundary policy for this agent. Agent-level fields
   * override harness-level fields one-by-one. See `PolicyDef`
   * and docs/design/phase-3-control-boundaries/README.md.
   */
  policy?: PolicyDef;
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

/** Declarative harness definition (typically loaded from YAML). */
export interface HarnessDef {
  /** Harness name. Optional — inferred from file name or opts.name when omitted. */
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
  /** Harness-level environment variables (applied to all agents as defaults). */
  env?: Record<string, string>;
  /** Shared external MCP servers available to all agents unless overridden per-agent. */
  mcpServers?: Record<string, McpServerDef>;
  /** Alias for `mcpServers` in YAML. */
  mcp_servers?: Record<string, McpServerDef>;
  /** Optional team lead agent name. The lead gets debug tools + all-channel access. */
  lead?: string;
  /**
   * Harness-level control-boundary defaults. Every agent in
   * the harness inherits these unless it declares its own
   * `AgentDef.policy` — overrides happen field-by-field, not as
   * a full replacement. See `PolicyDef` and
   * docs/design/phase-3-control-boundaries/README.md.
   */
  policy?: PolicyDef;
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
  /** Merged environment variables (harness defaults + agent overrides). */
  env?: Record<string, string>;
  /** Resolved filesystem mount points. */
  mounts?: MountDef[];
  /** If true, agent loop is not started automatically — only launched when @mentioned. */
  on_demand?: boolean;
  /** Resolved role: explicit AgentDef.role wins, else derived from harness.lead. */
  role: AgentRole;
  // (no resolved worktree field — worktrees are runtime-created, Wake-scoped)
  /** External MCP servers merged from the agent definition. */
  mcpServers?: Record<string, McpServerDef>;
  /**
   * Fully-merged control-boundary policy. Harness defaults
   * overridden field-by-field by `AgentDef.policy`. Missing
   * fields fall through to the daemon default inside the
   * factory.
   */
  policy?: PolicyDef;
}

/** Result of loading and resolving a harness definition. */
export interface ResolvedHarness {
  /** The parsed and validated definition (name is guaranteed after resolution). */
  def: HarnessDef & { name: string };
  /** Resolved agents (normalized model specs). */
  agents: ResolvedAgent[];
  /** Shared external MCP servers declared at harness level. */
  mcpServers?: Record<string, McpServerDef>;
  /** Variables from setup steps (name → stdout). */
  vars: Record<string, string>;
  /** The interpolated kickoff message (or undefined if no kickoff). */
  kickoff?: string;
  /** Directory of the source config file (used to resolve relative data_dir). */
  configDir?: string;
}
