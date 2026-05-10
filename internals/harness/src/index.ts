// ── Harness ──────────────────────────────────────────────────────────────
export { Harness } from "./harness.ts";
export { createHarness, createAgentTools, buildAgentToolSet } from "./factory.ts";
export type { AgentDirs } from "./factory.ts";

// ── Context ────────────────────────────────────────────────────────────────
export { CompositeContextProvider } from "./context/provider.ts";
export { HarnessEventLog } from "./context/event-log.ts";

// ── Stores (substrate-only — coord stores live in @agent-worker/harness-coordination) ─
export { DocumentStore } from "./context/stores/document.ts";
export { ResourceStore } from "./context/stores/resource.ts";
export { TimelineStore } from "./context/stores/timeline.ts";

// ── Storage backends ───────────────────────────────────────────────────────
export { MemoryStorage, FileStorage } from "./context/storage.ts";

// ── Prompt ─────────────────────────────────────────────────────────────────
export { assemblePrompt, SUBSTRATE_BASE_SECTIONS, soulSection } from "./loop/prompt.tsx";
export {
  harnessPromptSection,
  conversationSection,
  docsPromptSection,
  HARNESS_PROMPT_SECTIONS,
} from "./context/mcp/prompts.tsx";
export type { PromptSection, PromptContext } from "./loop/prompt.tsx";

// ── MCP tools ──────────────────────────────────────────────────────────────
export { createHarnessTools, HARNESS_TOOL_DEFS } from "./context/mcp/server.ts";
export { createTaskTools, TASK_TOOL_DEFS } from "./context/mcp/task.ts";
export type { TaskTools, TaskToolsDeps } from "./context/mcp/task.ts";
export type { HarnessToolSet, HarnessToolHandler, ToolDef } from "./context/mcp/server.ts";
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
  HarnessTypeRuntime,
  ContributeRuntimeInput,
  OnInitInput,
  OnShutdownInput,
  ProduceExtensionInput,
  ConsumeExtensionInput,
  ContributedMcpTool,
  ContributedPromptSection,
  ContributeMcpToolsInput,
  ContributeContextSectionsInput,
  SnapshotExtensionInput,
  ParseConfigInput,
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
  HarnessSubstrateSnapshot,
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
