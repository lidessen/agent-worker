// ── Agent ────────────────────────────────────────────────────────────────────
export { Agent } from "./agent.ts";

// ── Subsystems ───────────────────────────────────────────────────────────────
export { Inbox } from "./inbox.ts";
export { TodoManager } from "./todo.ts";
export { InMemoryNotesStorage } from "./notes.ts";
export { SendGuard } from "./send.ts";
export { ContextEngine } from "./context-engine.ts";
export { MemoryManager, InMemoryMemoryStorage } from "./memory.ts";
export { RunCoordinator } from "./run-coordinator.ts";

// ── Bridge (CLI loop infrastructure) ────────────────────────────────────────
export { ToolBridge, type BridgeTransport, AgentMcpServer, LoopWiring } from "./bridge/index.ts";
export type { LoopWiringDeps } from "./bridge/index.ts";

// ── Storage implementations ─────────────────────────────────────────────────
export { FileNotesStorage } from "./storage/file-notes.ts";
export { FileMemoryStorage } from "./storage/file-memory.ts";

// ── Toolkit ──────────────────────────────────────────────────────────────────
export { createBuiltinTools, mergeTools, validateToolNamespace } from "./toolkit.ts";
export { BUILTIN_TOOLS, createToolHandlers, zodParamsToSource } from "./tool-registry.ts";
export type { ToolHandlerDeps, ToolDef, ToolHandler } from "./tool-registry.ts";

// ── Types ────────────────────────────────────────────────────────────────────
export type {
  AgentState,
  AgentConfig,
  AgentLoop,
  AgentEvents,
  LoopCapability,
  PrepareStepFunction,
  InboxMessage,
  InboxConfig,
  WaitResult,
  TodoItem,
  NotesStorage,
  MemoryEntry,
  MemoryStorage,
  MemoryConfig,
  Turn,
  AssembledPrompt,
  ContextConfig,
  ToolKitConfig,
  Message,
  RunInfo,
} from "./types.ts";
