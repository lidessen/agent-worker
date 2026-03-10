// ── Workspace definition types ────────────────────────────────────────────
// Declarative workspace configuration, loaded from YAML files.

/** Agent definition within a workspace. */
export interface AgentDef {
  /** LLM backend identifier (e.g. "claude", "cursor", "openai", "mock"). */
  backend?: string;
  /** Model name (e.g. "claude-sonnet-4-5", "gpt-4o"). */
  model?: string;
  /** Instructions for this agent (system prompt). */
  instructions?: string;
  /** Channels this agent should join (in addition to default). */
  channels?: string[];
}

/** Setup step: run a shell command, optionally capture output as a variable. */
export interface SetupStep {
  /** Shell command to execute. */
  shell: string;
  /** Variable name to capture stdout into (available in templates as ${{ name }}). */
  as?: string;
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
}

/** Result of loading and resolving a workspace definition. */
export interface ResolvedWorkspace {
  /** The parsed and validated definition. */
  def: WorkspaceDef;
  /** Variables from setup steps (name → stdout). */
  vars: Record<string, string>;
  /** The interpolated kickoff message (or undefined if no kickoff). */
  kickoff?: string;
}
