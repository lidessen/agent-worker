// ── Daemon ────────────────────────────────────────────────────────────────
export { Daemon, startDaemon } from "./daemon.ts";

// ── Registries ────────────────────────────────────────────────────────────
export { AgentRegistry } from "./agent-registry.ts";
export { WorkspaceRegistry } from "./workspace-registry.ts";

// ── Managed instances ─────────────────────────────────────────────────────
export { ManagedAgent } from "./managed-agent.ts";
export { ManagedWorkspace } from "./managed-workspace.ts";

// ── Event log ─────────────────────────────────────────────────────────────
export { DaemonEventLog } from "./event-log.ts";

// ── Discovery ─────────────────────────────────────────────────────────────
export {
  readDaemonInfo,
  writeDaemonInfo,
  removeDaemonInfo,
  daemonInfoPath,
  defaultDataDir,
  generateToken,
} from "./discovery.ts";

// ── Runner ────────────────────────────────────────────────────────────────
export { HostRunner, SandboxRunner, createRunner } from "./runner.ts";
export type { AgentRunner, ExecResult } from "./runner.ts";

// ── Types ─────────────────────────────────────────────────────────────────
export type {
  DaemonConfig,
  DaemonInfo,
  DaemonEvent,
  DaemonEventType,
  AgentKind,
  ManagedAgentInfo,
  CreateAgentInput,
  ManagedWorkspaceInfo,
  CreateWorkspaceInput,
  RunnerKind,
  RunnerConfig,
  RunRequest,
  RunResponse,
} from "./types.ts";

// ── Re-exports from lower packages ────────────────────────────────────────
export { Agent } from "@agent-worker/agent";
export type { AgentConfig, AgentState, AgentLoop } from "@agent-worker/agent";

export { AiSdkLoop, ClaudeCodeLoop, CodexLoop, CursorLoop } from "@agent-worker/loop";
export type { LoopRun, LoopEvent, LoopResult, LoopStatus } from "@agent-worker/loop";

export { Workspace, createWorkspace, createWiredLoop } from "@agent-worker/workspace";
export type { WorkspaceDef, ResolvedWorkspace, ResolvedAgent } from "@agent-worker/workspace";
