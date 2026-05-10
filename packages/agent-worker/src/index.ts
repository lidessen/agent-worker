// ── Daemon ────────────────────────────────────────────────────────────────
export { Daemon, startDaemon } from "./daemon.ts";

// ── Client ───────────────────────────────────────────────────────────────
export { AwClient, ensureDaemon } from "./client.ts";
export type {
  HealthInfo,
  CursorResult,
  SendResult,
  AgentStateResult,
  ChannelMessage,
  DocInfo,
} from "./client.ts";

// ── Registries ────────────────────────────────────────────────────────────
export { AgentRegistry } from "./agent-registry.ts";
export { HarnessRegistry } from "./harness-registry.ts";

// ── Managed instances ─────────────────────────────────────────────────────
export { ManagedAgent } from "./managed-agent.ts";
export { GlobalAgentStub } from "./global-agent-stub.ts";
export { ManagedHarness } from "./managed-harness.ts";
export type { AgentHandle } from "./agent-registry.ts";

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
  AgentKind,
  ManagedAgentInfo,
  CreateAgentInput,
  ManagedHarnessInfo,
  CreateHarnessInput,
  RuntimeType,
  RuntimeConfig,
  HarnessMode,
  HarnessStatus,
  RunnerKind,
  RunnerConfig,
} from "./types.ts";

// ── Loop factory ─────────────────────────────────────────────────────────
export { createLoopFromConfig } from "./loop-factory.ts";

// ── Target parsing ───────────────────────────────────────────────────────
export { parseTarget, formatTarget } from "./cli/target.ts";
export type { Target } from "./cli/target.ts";

// ── Re-exports from lower packages ────────────────────────────────────────
export { Agent } from "@agent-worker/agent";
export type { AgentConfig, AgentState, AgentLoop } from "@agent-worker/agent";

export { AiSdkLoop, ClaudeCodeLoop, CodexLoop, CursorLoop, MockLoop } from "@agent-worker/loop";
export type { LoopRun, LoopEvent, LoopResult, LoopStatus } from "@agent-worker/loop";

export { Harness, createHarness } from "@agent-worker/harness";
export type { HarnessDef, ResolvedHarness, ResolvedAgent } from "@agent-worker/harness";

// ── Orchestrator (moved from harness) ──────────────────────────────────
export { HarnessOrchestrator, createOrchestrator } from "./orchestrator.ts";
export type { OrchestratorConfig } from "./orchestrator.ts";

// ── Runtime resolution (moved from harness) ───────────────────────────
export { resolveRuntime, discoverCliRuntime, detectAiSdkModel } from "./resolve-runtime.ts";
export type { RuntimeResolution } from "./resolve-runtime.ts";

export { EventBus, bus } from "@agent-worker/shared";
export type { BusEvent, EventLevel, EventFilter, EventSubscription } from "@agent-worker/shared";
