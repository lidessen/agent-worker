// ── Workspace ──────────────────────────────────────────────────────────────
export { Workspace } from "./workspace.ts";
export { createWorkspace, createWiredLoop, createAgentTools } from "./factory.ts";
export type { WiredLoopConfig, AgentDirs } from "./factory.ts";

// ── Context ────────────────────────────────────────────────────────────────
export { CompositeContextProvider } from "./context/provider.ts";
export { ChannelBridge } from "./context/bridge.ts";
export { WorkspaceEventLog } from "./context/event-log.ts";

// ── Stores ─────────────────────────────────────────────────────────────────
export { ChannelStore } from "./context/stores/channel.ts";
export { InboxStore } from "./context/stores/inbox.ts";
export { DocumentStore } from "./context/stores/document.ts";
export { ResourceStore } from "./context/stores/resource.ts";
export { StatusStore } from "./context/stores/status.ts";
export { TimelineStore } from "./context/stores/timeline.ts";

// ── Storage backends ───────────────────────────────────────────────────────
export { MemoryStorage, FileStorage } from "./context/storage.ts";

// ── Loop ───────────────────────────────────────────────────────────────────
export { WorkspaceAgentLoop } from "./loop/loop.ts";
export type { AgentLoopConfig } from "./loop/loop.ts";
export { InstructionQueue } from "./loop/priority-queue.ts";

// ── Prompt ─────────────────────────────────────────────────────────────────
export {
  assemblePrompt,
  BASE_SECTIONS,
  soulSection,
  inboxSection,
  currentTaskSection,
} from "./loop/prompt.ts";
export {
  workspacePromptSection,
  docsPromptSection,
  WORKSPACE_PROMPT_SECTIONS,
} from "./context/mcp/prompts.ts";

// Re-export DEFAULT_SECTIONS as the full set (base + workspace) for external callers.
import { BASE_SECTIONS } from "./loop/prompt.ts";
import { WORKSPACE_PROMPT_SECTIONS } from "./context/mcp/prompts.ts";
export const DEFAULT_SECTIONS = [...BASE_SECTIONS, ...WORKSPACE_PROMPT_SECTIONS];
export type { PromptSection, PromptContext } from "./loop/prompt.ts";

// ── MCP tools ──────────────────────────────────────────────────────────────
export { createWorkspaceTools, WORKSPACE_TOOL_DEFS } from "./context/mcp/server.ts";
export type { WorkspaceToolSet } from "./context/mcp/server.ts";
export { createChannelTools } from "./context/mcp/channel.ts";
export { createInboxTools } from "./context/mcp/inbox.ts";
export { createTeamTools } from "./context/mcp/team.ts";
export { createResourceTools } from "./context/mcp/resource.ts";

// ── Utilities ──────────────────────────────────────────────────────────────
export { nanoid, extractMentions } from "./utils.ts";

// ── Config (YAML) ─────────────────────────────────────────────────────
export {
  loadWorkspaceDef,
  parseWorkspaceDef,
  toWorkspaceConfig,
  resolveModel,
  resolveConnections,
  loadSecrets,
  saveSecrets,
  setSecret,
  deleteSecret,
  getSecretsPath,
  resolveRuntime,
  discoverCliRuntime,
  detectAiSdkModel,
  interpolate,
  runSetupSteps,
} from "./config/index.ts";
export type {
  WorkspaceDef,
  ConnectionDef,
  AgentDef,
  ModelSpec,
  ModelDef,
  SetupStep,
  ResolvedWorkspace,
  ResolvedAgent,
  ResolvedModel,
  RuntimeResolution,
  LoadOptions,
  ToWorkspaceConfigOptions,
} from "./config/index.ts";

// ── Adapters ──────────────────────────────────────────────────────────────
export { TelegramAdapter, runTelegramAuth } from "./adapters/telegram.ts";
export type {
  TelegramAdapterConfig,
  AuthResult as TelegramAuthResult,
} from "./adapters/telegram.ts";

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  // Message & Channel
  EventKind,
  Priority,
  InboxState,
  ToolCallData,
  Message,
  InboxEntry,
  // Instruction Queue
  Instruction,
  QueueConfig,
  // Event Log
  TimelineEvent,
  // Resource
  Resource,
  // Agent Status
  AgentStatus,
  AgentStatusEntry,
  // Document
  Document,
  // Storage
  StorageBackend,
  // Config
  WorkspaceConfig,
  // Adapter
  ChannelAdapter,
  ChannelBridgeInterface,
  BridgeSubscriber,
  // Runtime
  WorkspaceRuntime,
  ContextProvider,
  EventLog,
  InstructionQueueInterface,
  // Store interfaces
  ChannelStoreInterface,
  InboxStoreInterface,
  DocumentStoreInterface,
  ResourceStoreInterface,
  StatusStoreInterface,
  TimelineStoreInterface,
} from "./types.ts";
