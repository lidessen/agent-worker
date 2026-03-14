// ── Workspace definition types ────────────────────────────────────────────
// Declarative workspace configuration, loaded from YAML files.

/** Model configuration object form. */
export interface ModelDef {
  /** Model identifier (e.g. "claude-sonnet-4-5", "gpt-4o"). */
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
 * model: claude-sonnet-4-5
 *
 * # Provider:model shorthand (AI SDK style)
 * model: anthropic:claude-sonnet-4-5
 *
 * # Object form (with parameters)
 * model:
 *   id: claude-sonnet-4-5
 *   provider: anthropic
 *   temperature: 0.7
 * ```
 */
export type ModelSpec = string | ModelDef;

/** Agent definition within a workspace. */
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
  /** Platform-specific configuration (optional if saved via `aw connect`). */
  config?: Record<string, unknown>;
}

/** Declarative workspace definition (typically loaded from YAML). */
export interface WorkspaceDef {
  /** Workspace name. Required. */
  name: string;
  /** Agent definitions. Keys are agent names. */
  agents: Record<string, AgentDef>;
  /** Channel names to create. Default: ["general"]. */
  channels?: string[];
  /** Default channel for kickoff messages. Default: "general". */
  default_channel?: string;
  /** Storage backend: "memory" | "file". Default: "file". */
  storage?: "memory" | "file";
  /** Directory for file-based storage. Default: auto-generated from name+tag. */
  storage_dir?: string;
  /** Setup steps to run before kickoff. */
  setup?: SetupStep[];
  /** Kickoff message (template string with ${{ var }} interpolation and @mentions). */
  kickoff?: string;
  /** External platform connections. */
  connections?: ConnectionDef[];
  /** Workspace-level environment variables (applied to all agents as defaults). */
  env?: Record<string, string>;
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
}

/** Result of loading and resolving a workspace definition. */
export interface ResolvedWorkspace {
  /** The parsed and validated definition. */
  def: WorkspaceDef;
  /** Resolved agents (normalized model specs). */
  agents: ResolvedAgent[];
  /** Variables from setup steps (name → stdout). */
  vars: Record<string, string>;
  /** The interpolated kickoff message (or undefined if no kickoff). */
  kickoff?: string;
}
