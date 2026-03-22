export interface HealthInfo {
  status: string;
  agents: number;
  workspaces: number;
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
  workspace?: string;
}

export interface WorkspaceInfo {
  name: string;
  mode?: string;
  status: string;
  agents: string[];
  createdAt: number;
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
  workspace?: string;
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

export interface WorkspaceStatus {
  name: string;
  tag?: string;
  key: string;
  mode: string;
  status: string;
  agents: string[];
  agent_details: Array<{ name: string; runtime: string }>;
  channels: string[];
  loops: Array<{ name: string; running: boolean }>;
}

export interface WorkspaceInboxEntry {
  messageId: string;
  channel: string;
  priority: string;
  state: string;
  enqueuedAt: number;
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
