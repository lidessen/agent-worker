import type {
  LoopRun,
  LoopStatus,
  LoopEvent,
  LoopResult,
  PreflightResult,
} from "@agent-worker/loop";
import type { ToolSet } from "ai";

// ── Agent state machine ────────────────────────────────────────────────────

export type AgentState = "idle" | "waiting" | "processing" | "error" | "stopped";

// ── AgentLoop capability interface ─────────────────────────────────────────

export type LoopCapability =
  | "directTools"
  | "prepareStep"
  | "interruptible"
  | "hooks"
  | "usageStream";

export type PrepareStepResult = {
  system?: string;
  activeTools?: string[];
};

export type PrepareStepFunction = (options: {
  steps: unknown[];
  stepNumber: number;
  model: unknown;
  messages: unknown[];
  experimental_context: unknown;
}) => PrepareStepResult | Promise<PrepareStepResult>;

/** Structured input for loop.run(). */
export interface LoopInput {
  /** System prompt (dashboard context). */
  system: string;
  /** User-facing prompt (notification signal). */
  prompt: string;
}

export interface AgentLoop {
  supports: readonly LoopCapability[];
  run(input: string | LoopInput): LoopRun;
  cancel(): void;
  get status(): LoopStatus;
  preflight?(): Promise<PreflightResult>;
  cleanup?(): Promise<void>;

  /** Set tools for next run. Present when supports includes "directTools". */
  setTools?(tools: ToolSet): void;
  /** Set prepareStep hook. Present when supports includes "prepareStep". */
  setPrepareStep?(fn: PrepareStepFunction): void;
  /** Add MCP server config for CLI loops. Present when supports is empty (CLI). */
  setMcpConfig?(configPath: string): void;
  /** Add live MCP server objects for SDK-capable loops. */
  setMcpServers?(servers: Record<string, unknown>): void;
  /** Resume a known app-server thread/session if supported. */
  setThreadId?(threadId: string): void;
  /** Inject a short follow-up into the currently active turn if supported. */
  interrupt?(input: string): Promise<void>;
  /** Register runtime hook callbacks when supported. */
  setHooks?(hooks: Record<string, unknown>): void;
}

// ── Inbox ──────────────────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  content: string;
  from?: string;
  timestamp: number;
  status: "unread" | "read";
}

export interface InboxConfig {
  /** Debounce delay for wake-up. Default: 200ms */
  debounceMs?: number;
  /** Messages shorter than this are auto-read in peek. Default: 200 chars */
  peekThreshold?: number;
}

// ── Reminders ─────────────────────────────────────────────────────────────

export interface ReminderResult {
  id: string;
  label: string;
  reason: "completed" | "timeout";
  message?: string;
}

// ── Todo ───────────────────────────────────────────────────────────────────

export interface TodoItem {
  id: string;
  text: string;
  status: "pending" | "done";
}

// ── Notes ──────────────────────────────────────────────────────────────────

export interface NotesStorage {
  read(key: string): Promise<string | null>;
  write(key: string, content: string): Promise<void>;
  list(): Promise<string[]>;
  delete(key: string): Promise<void>;
}

// ── Memory ─────────────────────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  text: string;
  source: string;
  timestamp: number;
}

export interface MemoryStorage {
  add(entry: Omit<MemoryEntry, "id">): Promise<string>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  list(limit?: number): Promise<MemoryEntry[]>;
  remove(id: string): Promise<void>;
}

// ── Context engine ─────────────────────────────────────────────────────────

export interface Turn {
  role: "user" | "assistant" | "tool";
  content: string;
}

export interface AssembledPrompt {
  system: string;
  turns: Turn[];
  tokenCount: number;
  /** Snapshot of inbox peek at assembly time (for history persistence). */
  inboxSnapshot?: string;
  /** Snapshot of pending todos at assembly time (for history persistence). */
  todoSnapshot?: string;
}

export interface ContextConfig {
  /** Total token budget for assembled prompt. Default: 8000 */
  maxTokens?: number;
  /** Memory budget as fraction of remaining. Default: 0.20 */
  memoryBudget?: number;
  /** Custom token estimator. Default: chars/4 */
  tokenEstimator?: (text: string) => number;
}

// ── Memory config ──────────────────────────────────────────────────────────

export interface MemoryConfig {
  /** Storage backend. Default: file-based */
  storage?: MemoryStorage;
  /** Extraction model — completion API endpoint or model instance. */
  extractionModel?: string | unknown;
  /** Custom extraction function (alternative to model-based extraction) */
  extractMemories?: (turns: Turn[]) => Promise<string[]>;
  /** When to extract. Default: "checkpoint" */
  extractAt?: "checkpoint" | "event" | "idle" | "never";
  /** Max memories to inject per prompt. Default: 10 */
  maxInjected?: number;
}

// ── Toolkit ────────────────────────────────────────────────────────────────

export interface ToolKitConfig {
  /** User-defined AI SDK tools */
  tools?: ToolSet;
  /** Include builtins (todo, notes, memory). Default: true */
  includeBuiltins?: boolean;
}

export interface RuntimeHooksConfig {
  /** Runtime-specific hook definitions, passed through to loops that support hooks. */
  hooks?: Record<string, unknown>;
}

// ── Agent lifecycle hooks ──────────────────────────────────────────────────

/** Cumulative usage snapshot taken from a LoopEvent.usage event. */
export interface UsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextWindow?: number;
  usedRatio?: number;
  source: "runtime" | "estimate";
}

export type PressureLevel = "soft" | "hard";

/**
 * Thresholds used to decide when to fire onContextPressure. Absolute token
 * limits always apply when set. Ratio limits apply only when the runtime
 * reports contextWindow on the usage event. If both are set, whichever
 * triggers first wins.
 */
export interface ContextThresholds {
  /** Absolute total-token threshold for the "soft" pressure level. */
  softTokens?: number;
  /** Absolute total-token threshold for the "hard" pressure level. */
  hardTokens?: number;
  /** Ratio threshold (0..1) for the "soft" pressure level. Default 0.70. */
  softRatio?: number;
  /** Ratio threshold (0..1) for the "hard" pressure level. Default 0.90. */
  hardRatio?: number;
}

export interface PressureContext {
  level: PressureLevel;
  usage: UsageSnapshot;
  runNumber: number;
}

/**
 * Action returned by onContextPressure.
 *
 * - `continue` — ignore and keep running
 * - `end` — gracefully stop after the current run completes (handoff summary optional)
 *
 * A future `compact` action will support cancel+restart-with-rolled-up context.
 */
export type PressureAction = { kind: "continue" } | { kind: "end"; summary?: string };

export interface CheckpointContext {
  reason: "run_start" | "run_end" | "event";
  runNumber: number;
}

export type CheckpointAction = { kind: "noop" } | { kind: "inject"; content: string };

/**
 * Agent-level lifecycle hooks. Implementations typically close over task /
 * workspace state at assignment time. Fires are routed through the Agent,
 * not the loop — they are orthogonal to `runtimeHooks` (which are Claude
 * Code SDK hooks passed into the CLI runtime).
 */
export interface AgentLifecycleHooks {
  /** Fires when the runtime-reported usage crosses a configured threshold. */
  onContextPressure?: (ctx: PressureContext) => Promise<PressureAction> | PressureAction;
  /** Fires at run boundaries and on relevant events. Reserved for a follow-up PR. */
  onCheckpoint?: (
    ctx: CheckpointContext,
  ) => Promise<CheckpointAction | void> | CheckpointAction | void;
}

// ── Agent config ───────────────────────────────────────────────────────────

export interface AgentConfig {
  /** Display name */
  name?: string;
  /** System instructions prepended to every prompt */
  instructions?: string;
  /** Which loop backend to use */
  loop: AgentLoop;
  /** Tool assembly config */
  toolkit?: ToolKitConfig;
  /** Runtime hook config for loops that support hooks. */
  runtimeHooks?: RuntimeHooksConfig;
  /** Max loop.run() calls per wake cycle. Default: 10 */
  maxRuns?: number;
  /** Inbox config */
  inbox?: InboxConfig;
  /** Context engine config */
  context?: ContextConfig;
  /** Notes storage backend. Default: in-memory */
  notesStorage?: NotesStorage;
  /** Memory config. Optional — disabled when not provided */
  memory?: MemoryConfig;
  /** Shared event bus. When provided, Agent emits structured BusEvents directly. */
  bus?: import("@agent-worker/shared").EventBus;
  /** Agent-level lifecycle hooks (onContextPressure, onCheckpoint). */
  hooks?: AgentLifecycleHooks;
  /** Thresholds used by onContextPressure. Default softRatio=0.70, hardRatio=0.90. */
  contextThresholds?: ContextThresholds;
}

// ── Message input ──────────────────────────────────────────────────────────

export interface Message {
  content: string;
  from?: string;
}

// ── Run info ───────────────────────────────────────────────────────────────

export interface RunInfo {
  runNumber: number;
  trigger: "next_message" | "next_todo";
}

// ── Event emitter types ────────────────────────────────────────────────────

export interface AgentEvents {
  stateChange: (state: AgentState) => void;
  event: (event: LoopEvent) => void;
  runStart: (info: RunInfo) => void;
  runEnd: (result: LoopResult) => void;
  messageReceived: (message: InboxMessage) => void;
  send: (target: string, content: string) => void;
  contextAssembled: (prompt: AssembledPrompt) => void;
}
