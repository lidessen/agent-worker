import type { AgentConfig, AgentState, AgentLoop } from "@agent-worker/agent";
import type { LoopToolsOptions } from "@agent-worker/loop";

// ── Daemon configuration ──────────────────────────────────────────────────

export interface DaemonConfig {
  /** TCP port. Default: 0 (auto-assign). */
  port?: number;
  /** Hostname to bind. Default: "0.0.0.0". */
  host?: string;
  /** Allow requests from Tailscale peers without auth token. Default: false. */
  trustTailscale?: boolean;
  /** Data directory. Default: ~/.agent-worker */
  dataDir?: string;
  /** Auth token. Default: auto-generated. */
  token?: string;
  /** MCP hub port. Default: 42424. Set to 0 for auto-assign (useful in tests). */
  mcpPort?: number;
  /** Directory containing the built web UI (SPA). Default: packages/web/dist relative to project root. */
  webDistDir?: string;
}

// ── Daemon discovery ──────────────────────────────────────────────────────

export interface DaemonInfo {
  pid: number;
  host: string;
  port: number;
  token: string;
  startedAt: number;
  listenHost?: string;
  /** Port of the workspace MCP hub (debug + agent tools via MCP protocol). */
  mcpPort?: number;
}

// ── Managed agent ─────────────────────────────────────────────────────────

export type AgentKind = "config" | "ephemeral";

export interface ManagedAgentInfo {
  name: string;
  kind: AgentKind;
  state: AgentState;
  runtime?: string;
  createdAt: number;
  /** Workspace this agent belongs to, if any. */
  workspace?: string;
}

export interface CreateAgentInput {
  name: string;
  instructions?: string;
  /** Loop backend to use. If not provided, caller must supply a pre-built loop. */
  loop?: AgentLoop;
  /** Agent config (full). Takes precedence over individual fields. */
  config?: AgentConfig;
  /** Kind: config-loaded or ephemeral (API-created). Default: "ephemeral". */
  kind?: AgentKind;
  /** Runtime type label (e.g. "mock", "claude-code"). */
  runtime?: string;
  /** Workspace scope. If set, agent storage is under the workspace directory. */
  workspace?: string;
}

// ── Managed workspace ─────────────────────────────────────────────────────

export type WorkspaceMode = "service" | "task";
export type WorkspaceStatus = "running" | "completed" | "failed";

export interface ManagedWorkspaceInfo {
  name: string;
  tag?: string;
  agents: string[];
  channels: string[];
  default_channel: string;
  createdAt: number;
  mode: WorkspaceMode;
  status: WorkspaceStatus;
}

export interface CreateWorkspaceInput {
  /** Workspace YAML source (path or raw content). */
  source: string;
  /** Fallback workspace name (used when YAML doesn't specify one). */
  name?: string;
  /** Directory of the source config file (used to resolve relative data_dir). */
  configDir?: string;
  /** Absolute path to the source YAML file (for manifest persistence). */
  sourcePath?: string;
  /** Internal: set by restoreFromManifest to skip setup steps and kickoff. */
  _restore?: boolean;
  /** Instance tag (e.g. "pr-123"). */
  tag?: string;
  /** Extra variables for template interpolation. */
  vars?: Record<string, string>;
  /** Workspace mode. "task" auto-removes on completion. Default: "service". */
  mode?: WorkspaceMode;
}

// ── Runtime configuration (for HTTP-created agents) ──────────────────────

export type RuntimeType = "ai-sdk" | "claude-code" | "codex" | "cursor" | "mock";

/** Full runtime configuration for creating an agent via HTTP API. */
export interface RuntimeConfig {
  type: RuntimeType;

  /** Model identifier. Meaning depends on type:
   *  - ai-sdk: "provider:model" format
   *  - claude-code: model alias (e.g. "sonnet", "opus")
   *  - codex/cursor: model name
   *  - mock: ignored */
  model?: string;

  /** System instructions for the agent. */
  instructions?: string;

  /** Working directory for CLI-based runtimes. Default: daemon cwd. */
  cwd?: string;

  /** Additional directories the agent is allowed to access beyond cwd.
   *  Used for shared workspace sandbox, mounted repos, etc.
   *  Currently advisory (passed to tool instructions); will be enforced in future. */
  allowedPaths?: string[];

  /** Environment variable overrides (e.g. API keys). */
  env?: Record<string, string>;

  /** Runner kind. Default: "host". */
  runner?: "host" | "sandbox";

  /** Loop tools config (grep, web_fetch, web_search, web_browse). ai-sdk only.
   *  Set to false to disable all loop tools. */
  loopTools?: LoopToolsOptions | false;

  /** Mock-specific: response delay in ms. */
  mockDelay?: number;

  /** Mock-specific: fixed response text. */
  mockResponse?: string;
}

// ── Agent runner ──────────────────────────────────────────────────────────

export type RunnerKind = "host" | "sandbox";

export interface RunnerConfig {
  kind: RunnerKind;
  /** Working directory for host runner. */
  cwd?: string;
  /** Sandbox image/config (future). */
  sandbox?: Record<string, unknown>;
}

// ── Daemon events ─────────────────────────────────────────────────────────

export interface DaemonEvent {
  ts: number;
  type: string;
  [key: string]: unknown;
}
