// ── Message & Channel types ────────────────────────────────────────────────

export type EventKind = "message" | "tool_call" | "system" | "output" | "debug";

export type Priority = "immediate" | "normal" | "background";

export type InboxState = "pending" | "seen" | "deferred";

export interface ToolCallData {
  name: string;
  args?: Record<string, unknown>;
  result?: string;
}

export interface Message {
  id: string;
  timestamp: string;
  from: string;
  channel: string;
  content: string;
  mentions: string[];
  to?: string;
  kind?: EventKind;
  toolCall?: ToolCallData;
}

export interface InboxEntry {
  messageId: string;
  channel: string;
  /** Sender of the message that triggered this notification. */
  from: string;
  /** First 100 characters of the message content. */
  preview: string;
  priority: Priority;
  state: InboxState;
  enqueuedAt: string;
  deferredUntil?: string;
}

// ── Instruction Queue types ────────────────────────────────────────────────

export interface Instruction {
  id: string;
  agentName: string;
  messageId: string;
  channel: string;
  content: string;
  priority: Priority;
  enqueuedAt: string;
  preemptionCount?: number;
  progressState?: string;
}

export interface QueueConfig {
  immediateQuota?: number;
  normalQuota?: number;
  maxBackgroundWait?: number;
  maxPreemptions?: number;
  backgroundTtl?: number; // ms, default 5 * 60 * 1000
  maxSize?: number; // default 200
}

// ── Chronicle types ───────────────────────────────────────────────────────

export interface ChronicleEntry {
  id: string;
  timestamp: string;
  author: string;
  category: string; // decision, plan, task, correction, pattern, milestone, insight
  content: string;
}

export interface ChronicleStoreInterface {
  append(entry: Omit<ChronicleEntry, "id" | "timestamp">): Promise<ChronicleEntry>;
  read(opts?: { limit?: number; category?: string }): Promise<ChronicleEntry[]>;
}

// ── Event Log types ────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  timestamp: string;
  agentName: string;
  kind: EventKind;
  content: string;
  toolCall?: ToolCallData;
}

/**
 * Per-Wake event seen by a HarnessType's `produceExtension` hook.
 * Today, the events array passed into the hook is sourced from the
 * timeline / event log, so `HarnessEvent` aliases `TimelineEvent`.
 * When the work-log slice introduces a richer event surface, the
 * alias becomes a discriminated union without changing call sites.
 */
export type HarnessEvent = TimelineEvent;

// ── Resource types ─────────────────────────────────────────────────────────

export interface Resource {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

// ── Agent status types ─────────────────────────────────────────────────────

export type AgentStatus = "idle" | "running" | "paused" | "stopped";

export interface AgentStatusEntry {
  name: string;
  status: AgentStatus;
  updatedAt: string;
  currentTask?: string;
}

// ── Document types ─────────────────────────────────────────────────────────

export interface Document {
  name: string;
  content: string;
  updatedAt: string;
  updatedBy: string;
}

// ── Storage backend interface ──────────────────────────────────────────────

export interface StorageBackend {
  /** Append a line to a file (creates if needed). */
  appendLine(path: string, line: string): Promise<void>;
  /** Read all lines from a file. Returns [] if not found. */
  readLines(path: string): Promise<string[]>;
  /** Write raw content to a file (overwrites). */
  writeFile(path: string, content: string): Promise<void>;
  /** Read raw content from a file. Returns null if not found. */
  readFile(path: string): Promise<string | null>;
  /** List files in a directory. Returns [] if not found. */
  listFiles(dir: string): Promise<string[]>;
  /** Delete a file. No-op if not found. */
  deleteFile(path: string): Promise<void>;
}

// ── Harness config ───────────────────────────────────────────────────────

export interface HarnessConfig {
  name: string;
  tag?: string;
  channels?: string[];
  defaultChannel?: string;
  agents?: string[];
  connections?: ChannelAdapter[];
  storage?: StorageBackend;
  /** Root directory for this harness's file storage (docs, chronicle, channels). */
  storageDir?: string;
  /** Root directory for agent sandboxes. Defaults to storageDir if not set.
   *  Separate from storageDir when data_dir points to a repo (knowledge in repo,
   *  sandboxes in daemon-managed dir). */
  sandboxBaseDir?: string;
  queueConfig?: QueueConfig;
  /** SmartSend threshold in characters. Default: 1200 */
  maxMessageLength?: number;
  /** Optional team lead agent name (gets debug tools + all-channel access). */
  lead?: string;
  /** Agent names that are on-demand (only wake on @mention, not broadcasts). */
  onDemandAgents?: string[];
  /**
   * `HarnessType` id this Harness is constructed under. Fixed at
   * construction; never changes. Defaults to `DEFAULT_HARNESS_TYPE_ID`
   * when omitted. Per decision 006, slice 1 only registers the default
   * no-op type — concrete types (coordination, coding, ...) plug in via
   * the registry in later slices.
   */
  harnessTypeId?: string;
}

// ── Channel Bridge & Adapter ───────────────────────────────────────────────

export interface ChannelAdapter {
  readonly platform: string;
  start(bridge: ChannelBridgeInterface): Promise<void>;
  shutdown(): Promise<void>;
}

export interface ChannelBridgeInterface {
  /** Send a message from an external platform into a channel. */
  send(channel: string, from: string, content: string): Promise<Message>;
  /** Subscribe to channel messages. */
  subscribe(callback: BridgeSubscriber): void;
  /** Unsubscribe. */
  unsubscribe(callback: BridgeSubscriber): void;
  /** Register and start an adapter. */
  addAdapter(adapter: ChannelAdapter): Promise<void>;
}

export type BridgeSubscriber = (message: Message) => void;

/**
 * Substrate slice of `HarnessStateSnapshot`. Universal across types —
 * carries identity, the registered type id, and the substrate stores'
 * data (documents, chronicle).
 */
export interface HarnessSubstrateSnapshot {
  name: string;
  tag?: string;
  harnessTypeId: string;
  documents: string[];
  chronicle: ChronicleEntry[];
}

/**
 * Unified snapshot shape per resolved Q #3 of the substrate-cut
 * blueprint: substrate slice plus a `typeExtensions` map keyed by
 * `HarnessType.id`. A coord harness emits its slice under
 * `typeExtensions["multi-agent-coordination"]`; future types
 * (coding/writing/...) plug in symmetrically. Stitcher helpers can
 * project a flat view per consumer's preference.
 */
export interface HarnessStateSnapshot {
  substrate: HarnessSubstrateSnapshot;
  typeExtensions: Record<string, unknown>;
}

// ── Harness runtime interface ────────────────────────────────────────────

export interface HarnessRuntime {
  readonly name: string;
  readonly tag: string | undefined;
  readonly contextProvider: ContextProvider;
  readonly eventLog: EventLog;
  /** Root directory for this harness's file storage. Undefined for memory-only harnesses. */
  readonly storageDir: string | undefined;
  /** Shared harness sandbox directory (collaborative files visible to all agents). */
  readonly harnessSandboxDir: string | undefined;
  /** Kernel state store (Task / Wake / Handoff) — see ./state/. */
  readonly stateStore: import("./state/index.ts").HarnessStateStore;

  /** Initialize harness: recover from crashes, start connections. */
  init(): Promise<void>;
  /** Shutdown harness: stop connections, flush stores. */
  shutdown(): Promise<void>;
  /** Get the agent's sandbox directory (working directory for bash/files). */
  agentSandboxDir(agentName: string): string | undefined;
  /** Return a unified snapshot of harness state for debug/tests. */
  snapshotState(opts?: {
    inboxLimit?: number;
    timelineLimit?: number;
    chronicleLimit?: number;
    queuedLimit?: number;
  }): Promise<HarnessStateSnapshot>;
}

// ── ContextProvider interface ──────────────────────────────────────────────

export interface ContextProvider {
  readonly channels: ChannelStoreInterface;
  readonly inbox: InboxStoreInterface;
  readonly documents: DocumentStoreInterface;
  readonly resources: ResourceStoreInterface;
  readonly status: StatusStoreInterface;
  readonly timeline: TimelineStoreInterface;
  readonly chronicle: ChronicleStoreInterface;
  /** Team lead agent name (if set). */
  readonly lead?: string;

  /** Post a message to a channel. Throws if content exceeds the length limit. */
  send(msg: { channel: string; from: string; content: string; to?: string }): Promise<Message>;
}

// ── Store interfaces ───────────────────────────────────────────────────────

export interface ChannelStoreInterface {
  append(channel: string, message: Omit<Message, "id" | "timestamp">): Promise<Message>;
  read(
    channel: string,
    opts?: { since?: string; sinceId?: string; limit?: number },
  ): Promise<Message[]>;
  getMessage(channel: string, messageId: string): Promise<Message | null>;
  listChannels(): string[];
  createChannel(name: string): void;
  clear(channel: string): Promise<void>;

  on(event: "message", listener: (message: Message) => void): void;
  off(event: "message", listener: (message: Message) => void): void;
}

export interface InboxStoreInterface {
  enqueue(agentName: string, entry: InboxEntry): Promise<void>;
  peek(agentName: string): Promise<InboxEntry[]>;
  /** Inspect inbox state without mutating delivery state or filtering non-runnable entries. */
  inspect(agentName: string): Promise<InboxEntry[]>;
  ack(agentName: string, messageId: string): Promise<void>;
  defer(agentName: string, messageId: string, until?: string): Promise<void>;
  markSeen(agentName: string, messageId: string): Promise<void>;
  markRunStart(agentName: string): Promise<void>;
  hasEntry(agentName: string, messageId: string): Promise<boolean>;
  /** Returns a promise that resolves when a new inbox entry arrives for the agent. */
  onNewEntry(agentName: string): Promise<void>;
}

export interface DocumentStoreInterface {
  read(name: string): Promise<string | null>;
  write(name: string, content: string, updatedBy: string): Promise<void>;
  append(name: string, content: string, updatedBy: string): Promise<void>;
  list(): Promise<string[]>;
  create(name: string, content: string, createdBy: string): Promise<void>;
}

export interface ResourceStoreInterface {
  create(content: string, createdBy: string): Promise<Resource>;
  read(id: string): Promise<Resource | null>;
}

export interface StatusStoreInterface {
  set(name: string, status: AgentStatus, currentTask?: string): Promise<void>;
  get(name: string): Promise<AgentStatusEntry | null>;
  getAll(): Promise<AgentStatusEntry[]>;
  /** Sync read from in-memory cache (for use in non-async contexts). */
  getCached(name: string): AgentStatusEntry | null;
}

export interface TimelineStoreInterface {
  append(event: Omit<TimelineEvent, "id" | "timestamp">): Promise<TimelineEvent>;
  read(agentName: string, opts?: { limit?: number }): Promise<TimelineEvent[]>;
}

// ── EventLog interface ─────────────────────────────────────────────────────

export interface EventLog {
  log(
    agentName: string,
    kind: EventKind,
    content: string,
    opts?: { toolCall?: ToolCallData },
  ): Promise<TimelineEvent>;
}

// ── InstructionQueue interface ─────────────────────────────────────────────

export interface InstructionQueueInterface {
  enqueue(instruction: Instruction): void;
  dequeue(agentName: string): Instruction | null;
  peek(agentName: string): Instruction | null;
  shouldYield(agentName: string): boolean;
  /** List all pending instructions across all agents (debug/admin use). */
  listAll(): Instruction[];
  readonly size: number;
}
