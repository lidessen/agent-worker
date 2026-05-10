export interface HealthInfo {
  status: string;
  agents: number;
  harnesses: number;
  uptime: number;
  runtimes?: RuntimeHealth[];
}

export interface RuntimeHealth {
  name: string;
  status: string;
  available: boolean;
}

export interface AgentInfo {
  name: string;
  kind: string;
  state: string;
  runtime: string;
  model?: string;
  createdAt: number;
  harness?: string;
}

export interface HarnessInfo {
  name: string;
  label?: string;
  mode?: string;
  status: string;
  agents: string[];
  createdAt: number;
  /** `HarnessType` id this instance plugs into (e.g. `multi-agent-coordination`, `single-agent-chat`). */
  harnessTypeId?: string;
}

export interface InboxItem {
  id: string;
  content: string;
  from?: string;
  status?: string;
  channel?: string;
  priority?: string;
  timestamp?: number;
}

export interface TodoItem {
  id: string;
  status: string;
  text: string;
}

export interface AgentState {
  state: string;
  inbox: InboxItem[];
  todos?: TodoItem[];
  currentTask?: string;
  harness?: string;
  history?: number;
}

export interface CursorResult<T> {
  entries: T[];
  cursor: number;
}

export interface DaemonEvent {
  ts: number;
  type: string;
  [key: string]: unknown;
}

export interface ChannelMessage {
  id: string;
  channel: string;
  from: string;
  content: string;
  timestamp: string;
  mentions?: string[];
  to?: string;
}

export interface DocInfo {
  name: string;
}

export interface HarnessStatus {
  name: string;
  label?: string;
  tag?: string;
  key: string;
  mode: string;
  status: string;
  agents: string[];
  agent_details: Array<{ name: string; runtime: string }>;
  channels: string[];
  loops: Array<{ name: string; running: boolean }>;
}

export interface HarnessInboxEntry {
  messageId: string;
  channel: string;
  priority: string;
  state: string;
  enqueuedAt: number;
}

// ── Task ledger (harness-led hierarchical state) ────────────────────────

export type TaskStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "blocked"
  | "completed"
  | "aborted"
  | "failed";

export interface TaskSummary {
  id: string;
  harnessId: string;
  title: string;
  goal: string;
  status: TaskStatus;
  priority?: number;
  ownerLeadId?: string;
  activeWakeId?: string;
  acceptanceCriteria?: string;
  sourceRefs: Array<{ kind: string; ref?: string; excerpt?: string; ts: number }>;
  createdAt: number;
  updatedAt: number;
}

export interface WakeSummary {
  id: string;
  taskId: string;
  agentName: string;
  role: "lead" | "worker" | "observer";
  status: "running" | "completed" | "failed" | "cancelled" | "handed_off";
  startedAt: number;
  endedAt?: number;
  resultSummary?: string;
  runtimeType?: string;
  sessionId?: string;
}

export interface HandoffSummary {
  id: string;
  taskId: string;
  closingWakeId: string;
  createdAt: number;
  createdBy: string;
  kind: "progress" | "blocked" | "completed" | "aborted";
  summary: string;
  completed: string[];
  pending: string[];
  blockers: string[];
  decisions: string[];
  resources: string[];
  workLogPointer?: string;
  extensions: Record<string, unknown>;
}

export interface TaskDetail {
  task: TaskSummary;
  wakes: WakeSummary[];
  handoffs: HandoffSummary[];
}

// ── Runtime configuration (for HTTP-created agents) ──────────────────────

export type RuntimeType = "ai-sdk" | "claude-code" | "codex" | "cursor" | "mock";

export interface RuntimeConfig {
  type: RuntimeType;
  model?: string;
  instructions?: string;
  cwd?: string;
  env?: Record<string, string>;
  runner?: "host" | "sandbox";
  mockDelay?: number;
  mockResponse?: string;
}

// ── Monitor (decision 004) ─────────────────────────────────────────────────

export interface ConcurrencySample {
  ts: number;
  activeAgents: number;
  activeRequirements: number;
  pendingOnAuth: number;
  structuralCap: number;
}

export interface C1Metrics {
  current: ConcurrencySample;
  peak30d: number;
  timeShare24h: { ge3: number; eq2: number; eq1: number; eq0: number };
  thresholds: {
    structuralCapMin: number;
    peak30dMin: number;
    timeShareGe2Min: number;
  };
}

export type InterventionType = "authorization" | "acceptance" | "rescue" | "other";

export interface Intervention {
  id: string;
  ts: number;
  type: InterventionType;
  harness?: string;
  agent?: string;
  reason?: string;
  responseLatencyMs?: number;
}

export interface C3Metrics {
  totals: {
    authorization: number;
    acceptance: number;
    rescue: number;
    other: number;
    total: number;
  };
  rescueRatio: number;
  perRequirementAuthAcceptance: number;
  recent: Intervention[];
  thresholds: {
    rescueRatioMax: number;
    perRequirementAuthAcceptanceMax: number;
  };
}

export interface C4Metrics {
  allSilentRatio: number;
  authWaitNonBlockingUtilization: number;
  phantomBlockEvents: number;
  windowSamples: number;
  thresholds: {
    allSilentRatioMax: number;
    authWaitNonBlockingUtilizationMin: number;
    phantomBlockEventsMaxPerMonth: number;
  };
}

export type BindingSource = "closed" | "open" | "unknown";

export interface BindingEntry {
  harness: string;
  agent: string;
  runtime: string;
  model: string;
  provider?: string;
  source: BindingSource;
  ossFallbackConfigured: boolean;
}

export interface C2Metrics {
  uncoveredCount: number;
  failedCount: number;
  reachability: number;
  totalBindings: number;
  bySource: { closed: number; open: number; unknown: number };
  bindings: BindingEntry[];
  thresholds: {
    uncoveredCountMax: number;
    failedCountMax: number;
    reachabilityMin: number;
  };
}

export interface MonitorSnapshot {
  ts: number;
  uptimeSec: number;
  c1: C1Metrics;
  c2?: C2Metrics;
  c3?: C3Metrics;
  c4?: C4Metrics;
}

export type MonitorEvent =
  | { kind: "sample"; sample: ConcurrencySample }
  | { kind: "snapshot"; snapshot: MonitorSnapshot }
  | { kind: "intervention"; intervention: Intervention };

// ── Chat (decision 008) ────────────────────────────────────────────────────

export type ChatRole = "user" | "assistant" | "system";

export interface ChatTurn {
  id: string;
  role: ChatRole;
  content: string;
  ts: number;
  runId?: string;
  error?: string;
}
