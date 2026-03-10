// ── YAML Config types ─────────────────────────────────────────────────────
// Mirrors the moniro workflow YAML schema, adapted for agent-worker workspace.

/** Agent definition in YAML config. */
export interface AgentYamlConfig {
  /** LLM backend identifier (e.g. "claude", "cursor", "openai", "mock"). */
  backend?: string;
  /** Model name (e.g. "claude-sonnet-4-5", "gpt-4o"). */
  model?: string;
  /** System prompt / instructions for this agent. */
  system_prompt?: string;
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

/** Context provider configuration. */
export interface ContextYamlConfig {
  /** Storage provider: "memory" | "file". Default: "file". */
  provider?: "memory" | "file";
  /** Directory for file-based storage. Default: auto-generated from name+tag. */
  dir?: string;
}

/** Top-level workspace YAML config. */
export interface WorkspaceYamlConfig {
  /** Workspace name. Required. */
  name: string;
  /** Agent definitions. Keys are agent names. */
  agents: Record<string, AgentYamlConfig>;
  /** Channel names to create. Default: ["general"]. */
  channels?: string[];
  /** Default channel for kickoff messages. Default: "general". */
  default_channel?: string;
  /** Context/storage configuration. */
  context?: ContextYamlConfig;
  /** Setup steps to run before kickoff. */
  setup?: SetupStep[];
  /** Kickoff message (template string with ${{ var }} interpolation and @mentions). */
  kickoff?: string;
  /** Queue configuration overrides. */
  queue?: {
    immediate_quota?: number;
    normal_quota?: number;
    max_background_wait?: number;
    max_preemptions?: number;
  };
  /** SmartSend threshold in characters. Default: 1200. */
  smart_send_threshold?: number;
}

/** Result of loading and processing a YAML config. */
export interface LoadedWorkspaceConfig {
  /** The parsed and validated YAML config. */
  yaml: WorkspaceYamlConfig;
  /** Variables from setup steps (name → stdout). */
  setupVars: Record<string, string>;
  /** The interpolated kickoff message (or undefined if no kickoff). */
  kickoff?: string;
}
