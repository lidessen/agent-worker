// ── Harness ──────────────────────────────────────────────────────────────
export { Harness } from "./harness.ts";
export { createHarness, createAgentTools } from "./factory.ts";
export type { AgentDirs } from "./factory.ts";

// ── Context ────────────────────────────────────────────────────────────────
export { CompositeContextProvider } from "./context/provider.ts";
export { ChannelBridge } from "./context/bridge.ts";
export { HarnessEventLog } from "./context/event-log.ts";

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
  harnessPromptSection,
  conversationSection,
  docsPromptSection,
  HARNESS_PROMPT_SECTIONS,
} from "./context/mcp/prompts.tsx";

// Re-export DEFAULT_SECTIONS as the full set (base + harness) for external callers.
import { BASE_SECTIONS } from "./loop/prompt.tsx";
import { HARNESS_PROMPT_SECTIONS } from "./context/mcp/prompts.tsx";
export const DEFAULT_SECTIONS = [...BASE_SECTIONS, ...HARNESS_PROMPT_SECTIONS];
export type { PromptSection, PromptContext } from "./loop/prompt.tsx";

// ── MCP tools ──────────────────────────────────────────────────────────────
export { createHarnessTools, HARNESS_TOOL_DEFS } from "./context/mcp/server.ts";
export { createTaskTools, TASK_TOOL_DEFS } from "./context/mcp/task.ts";
export type { TaskTools, TaskToolsDeps } from "./context/mcp/task.ts";
export type { HarnessToolSet } from "./context/mcp/server.ts";
export { createChannelTools } from "./context/mcp/channel.ts";
export { createInboxTools } from "./context/mcp/inbox.ts";
export { createTeamTools } from "./context/mcp/team.ts";
export { createResourceTools } from "./context/mcp/resource.ts";
export { createHarnessMcpConfig } from "./context/mcp/http-server.ts";

// ── Harness MCP Hub (per-harness, debug + agent tools) ──────────────
export { HarnessMcpHub } from "./mcp-server.ts";
export type { HarnessMcpHubOptions } from "./mcp-server.ts";

// ── HarnessType protocol (decision 006) ───────────────────────────────────
export {
  DEFAULT_HARNESS_TYPE_ID,
  defaultHarnessType,
  createHarnessTypeRegistry,
  HandoffExtensionConsumeError,
  runProduceExtension,
  runConsumeExtension,
} from "./type/index.ts";
export type {
  HarnessType,
  HarnessTypeRegistry,
  ProduceExtensionInput,
  ConsumeExtensionInput,
  ProduceLogger,
} from "./type/index.ts";

// ── Utilities ──────────────────────────────────────────────────────────────
export { nanoid, extractMentions, extractAddressedMentions } from "./utils.ts";

// ── Git worktree (phase 1 isolation) ───────────────────────────────────────
export {
  provisionWorktree,
  removeWorktree,
  listWorktrees,
  pruneWorktrees,
  assertGitRepo,
} from "./worktree.ts";
export type { WorktreeEntry } from "./worktree.ts";

// ── Config (YAML) ─────────────────────────────────────────────────────
export {
  loadHarnessDef,
  parseHarnessDef,
  toHarnessConfig,
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
  HarnessDef,
  ConnectionDef,
  AgentDef,
  McpServerDef,
  ModelSpec,
  ModelDef,
  SetupStep,
  ResolvedHarness,
  ResolvedAgent,
  ResolvedModel,
  PolicyDef,
  LoadOptions,
  ToHarnessConfigOptions,
  RuntimeResolver,
} from "./config/index.ts";

// ── Kernel state (Task / Wake / Handoff) ──────────────────────────────────
export { InMemoryHarnessStateStore, FileHarnessStateStore } from "./state/index.ts";
export { buildLeadHooks } from "./loop/lead-hooks.ts";
export type { BuildLeadHooksOptions } from "./loop/lead-hooks.ts";
export type {
  SourceRef,
  TaskStatus,
  Task,
  CreateTaskInput,
  TaskPatch,
  WakeStatus,
  Wake,
  CreateWakeInput,
  WakePatch,
  Worktree,
  HandoffKind,
  HandoffExtensionPayload,
  Handoff,
  CreateHandoffInput,
  HarnessStateStore,
  WakeTerminalListener,
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
  HarnessConfig,
  // Adapter
  ChannelAdapter,
  ChannelBridgeInterface,
  BridgeSubscriber,
  HarnessAgentSnapshot,
  HarnessStateSnapshot,
  // Runtime
  HarnessRuntime,
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
