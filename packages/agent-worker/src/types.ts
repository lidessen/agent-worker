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

export type DaemonEventType =
  | "daemon_started"
  | "daemon_stopped"
  | "agent_created"
  | "agent_removed"
  | "agent_state_change"
  | "agent_run_start"
  | "agent_run_end"
  | "agent_text"
  | "agent_tool_call"
  | "agent_error"
  | "workspace_created"
  | "workspace_stopped"
  | "workspace_kickoff"
  | "error";

export interface DaemonEvent {
  ts: number;
  type: DaemonEventType;
  [key: string]: unknown;
}
