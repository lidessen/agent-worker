import type { AgentConfig, AgentState, AgentLoop } from "@agent-worker/agent";
import type { ResolvedAgent, ResolvedWorkspace, WorkspaceDef } from "@agent-worker/workspace";

// ── Daemon configuration ──────────────────────────────────────────────────

export interface DaemonConfig {
  /** TCP port. Default: 0 (auto-assign). */
  port?: number;
  /** Hostname to bind. Default: "127.0.0.1". */
  host?: string;
  /** Data directory. Default: ~/.agent-worker */
  dataDir?: string;
  /** Auth token. Default: auto-generated. */
  token?: string;
}

// ── Daemon discovery ──────────────────────────────────────────────────────

export interface DaemonInfo {
  pid: number;
  host: string;
  port: number;
  token: string;
  startedAt: number;
}

// ── Managed agent ─────────────────────────────────────────────────────────

export type AgentKind = "config" | "ephemeral";

export interface ManagedAgentInfo {
  name: string;
  kind: AgentKind;
  state: AgentState;
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
  /** Workspace scope. If set, agent storage is under the workspace directory. */
  workspace?: string;
}

// ── Managed workspace ─────────────────────────────────────────────────────

export interface ManagedWorkspaceInfo {
  name: string;
  tag?: string;
  agents: string[];
  channels: string[];
  createdAt: number;
}

export interface CreateWorkspaceInput {
  /** Workspace YAML source (path or raw content). */
  source: string;
  /** Instance tag (e.g. "pr-123"). */
  tag?: string;
  /** Extra variables for template interpolation. */
  vars?: Record<string, string>;
}

// ── Runtime configuration (for HTTP-created agents) ──────────────────────

export type RuntimeType = "ai-sdk" | "claude-code" | "codex" | "cursor" | "mock";

/** Full runtime configuration for creating an agent via HTTP API. */
export interface RuntimeConfig {
  type: RuntimeType;

  /** Model identifier. Meaning depends on type:
   *  - ai-sdk: "provider:model" (e.g. "anthropic:claude-sonnet-4-20250514")
   *  - claude-code: model name (e.g. "sonnet", "opus")
   *  - codex/cursor: model name
   *  - mock: ignored */
  model?: string;

  /** System instructions for the agent. */
  instructions?: string;

  /** Working directory for CLI-based runtimes. Default: daemon cwd. */
  cwd?: string;

  /** Environment variable overrides (e.g. API keys). */
  env?: Record<string, string>;

  /** Runner kind. Default: "host". */
  runner?: "host" | "sandbox";

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

export interface RunRequest {
  /** Agent name to run against. */
  agent: string;
  /** User message. */
  message: string;
  /** If true, stream events via SSE. Default: false. */
  stream?: boolean;
}

export interface RunResponse {
  /** Agent's text response. */
  text: string;
  /** Events emitted during the run. */
  events: DaemonEvent[];
}

// ── Daemon events ─────────────────────────────────────────────────────────

export interface DaemonEvent {
  ts: number;
  type: string;
  [key: string]: unknown;
}
