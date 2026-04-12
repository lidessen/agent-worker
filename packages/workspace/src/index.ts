// ── Workspace ──────────────────────────────────────────────────────────────
export { Workspace } from "./workspace.ts";
export { createWorkspace, createAgentTools } from "./factory.ts";
export type { AgentDirs } from "./factory.ts";

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

// ── Instruction Queue ─────────────────────────────────────────────────────
export { InstructionQueue } from "./loop/priority-queue.ts";

// ── Prompt ─────────────────────────────────────────────────────────────────
export { assemblePrompt, BASE_SECTIONS, soulSection, inboxSection } from "./loop/prompt.tsx";
export {
  workspacePromptSection,
  conversationSection,
  docsPromptSection,
  WORKSPACE_PROMPT_SECTIONS,
} from "./context/mcp/prompts.tsx";

// Re-export DEFAULT_SECTIONS as the full set (base + workspace) for external callers.
import { BASE_SECTIONS } from "./loop/prompt.tsx";
import { WORKSPACE_PROMPT_SECTIONS } from "./context/mcp/prompts.tsx";
export const DEFAULT_SECTIONS = [...BASE_SECTIONS, ...WORKSPACE_PROMPT_SECTIONS];
export type { PromptSection, PromptContext } from "./loop/prompt.tsx";

// ── MCP tools ──────────────────────────────────────────────────────────────
export { createWorkspaceTools, WORKSPACE_TOOL_DEFS } from "./context/mcp/server.ts";
export type { WorkspaceToolSet } from "./context/mcp/server.ts";
export { createChannelTools } from "./context/mcp/channel.ts";
export { createInboxTools } from "./context/mcp/inbox.ts";
export { createTeamTools } from "./context/mcp/team.ts";
export { createResourceTools } from "./context/mcp/resource.ts";
export { createWorkspaceMcpConfig } from "./context/mcp/http-server.ts";

// ── Workspace MCP Hub (per-workspace, debug + agent tools) ──────────────
export { WorkspaceMcpHub } from "./mcp-server.ts";
export type { WorkspaceMcpHubOptions } from "./mcp-server.ts";

// ── Utilities ──────────────────────────────────────────────────────────────
export { nanoid, extractMentions } from "./utils.ts";

// ── Config (YAML) ─────────────────────────────────────────────────────
export {
  loadWorkspaceDef,
  parseWorkspaceDef,
  toWorkspaceConfig,
  resolveModel,
  resolveConnections,
  saveConnection,
  loadSecrets,
  saveSecrets,
  setSecret,
  deleteSecret,
  getSecretsPath,
  interpolate,
  runSetupSteps,
} from "./config/index.ts";
export type {
  AgentRole,
  WorkspaceDef,
  ConnectionDef,
  AgentDef,
  ModelSpec,
  ModelDef,
  SetupStep,
  ResolvedWorkspace,
  ResolvedAgent,
  ResolvedModel,
  LoadOptions,
  ToWorkspaceConfigOptions,
  RuntimeResolver,
} from "./config/index.ts";

// ── Kernel state (Task / Attempt / Handoff / Artifact) ────────────────────
export { InMemoryWorkspaceStateStore, FileWorkspaceStateStore } from "./state/index.ts";
export type {
  SourceRef,
  TaskStatus,
  Task,
  CreateTaskInput,
  TaskPatch,
  AttemptStatus,
  Attempt,
  CreateAttemptInput,
  AttemptPatch,
  HandoffKind,
  Handoff,
  CreateHandoffInput,
  Artifact,
  CreateArtifactInput,
  WorkspaceStateStore,
  TaskFilter,
} from "./state/index.ts";

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
  WorkspaceAgentSnapshot,
  WorkspaceStateSnapshot,
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
  ChronicleEntry,
  ChronicleStoreInterface,
} from "./types.ts";
