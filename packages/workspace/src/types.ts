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

// ── Workspace config ───────────────────────────────────────────────────────

export interface WorkspaceConfig {
  name: string;
  tag?: string;
  channels?: string[];
  defaultChannel?: string;
  agents?: string[];
  connections?: ChannelAdapter[];
  storage?: StorageBackend;
  /** Root directory for this workspace's file storage (docs, chronicle, channels). */
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
   * The full set of source-repo paths referenced by any agent's
   * worktree spec in this workspace. Used at `init()` time to run
   * `pruneWorktrees` across each repo for crash recovery. The
   * workspace itself stays runtime-agnostic — this is just the
   * union of per-agent worktree targets materialised for the
   * init scan. Populated by `toWorkspaceConfig`.
   */
  worktreeRepos?: readonly string[];
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

export interface WorkspaceAgentSnapshot {
  name: string;
  status: AgentStatus;
  currentTask?: string;
  channels: string[];
  inbox: InboxEntry[];
  recentActivity: TimelineEvent[];
}

export interface WorkspaceStateSnapshot {
  name: string;
  tag?: string;
  defaultChannel: string;
  channels: string[];
  documents: string[];
  chronicle: ChronicleEntry[];
  queuedInstructions: Instruction[];
  agents: WorkspaceAgentSnapshot[];
}

// ── Workspace runtime interface ────────────────────────────────────────────

export interface WorkspaceRuntime {
  readonly name: string;
  readonly tag: string | undefined;
  readonly defaultChannel: string;
  readonly contextProvider: ContextProvider;
  readonly eventLog: EventLog;
  readonly bridge: ChannelBridgeInterface;
  readonly instructionQueue: InstructionQueueInterface;
  /** Root directory for this workspace's file storage. Undefined for memory-only workspaces. */
  readonly storageDir: string | undefined;
  /** Shared workspace sandbox directory (collaborative files visible to all agents). */
  readonly workspaceSandboxDir: string | undefined;
  /** Kernel state store (Task/Attempt/Handoff/Artifact) — see ./state/. */
  readonly stateStore: import("./state/index.ts").WorkspaceStateStore;

  /** Initialize workspace: recover from crashes, start connections. */
  init(): Promise<void>;
  /** Shutdown workspace: stop connections, flush stores. */
  shutdown(): Promise<void>;
  /** Register an agent with the workspace. */
  registerAgent(name: string, channels?: string[]): Promise<void>;
  /** Get the agent's sandbox directory (working directory for bash/files). */
  agentSandboxDir(agentName: string): string | undefined;
  /** Return a unified snapshot of workspace state for debug/tests. */
  snapshotState(opts?: {
    inboxLimit?: number;
    timelineLimit?: number;
    chronicleLimit?: number;
    queuedLimit?: number;
  }): Promise<WorkspaceStateSnapshot>;
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
