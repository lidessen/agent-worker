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

export type LoopCapability = "directTools" | "prepareStep";

export type PrepareStepFunction = (options: {
  steps: unknown[];
  stepNumber: number;
  model: unknown;
  messages: unknown[];
  experimental_context: unknown;
}) => unknown;

export interface AgentLoop {
  supports: LoopCapability[];
  run(prompt: string): LoopRun;
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
  extractAt?: "checkpoint" | "idle" | "never";
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
