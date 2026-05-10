/**
 * AwClient — shared HTTP client for agent-worker daemon.
 *
 * Used by CLI, Web UI, MCP, and tests. All daemon communication
 * goes through this client.
 */
import type {
  DaemonInfo,
  DaemonEvent,
  ManagedAgentInfo,
  ManagedHarnessInfo,
  RuntimeConfig,
} from "./types.ts";
import { readDaemonInfo, defaultDataDir } from "./discovery.ts";
import { execa } from "execa";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

export interface HealthInfo {
  status: string;
  pid: number;
  uptime: number;
  agents: number;
  harnesss: number;
  runtimes?: Array<{
    name: string;
    status: string;
    available: boolean;
  }>;
}

export interface CursorResult<T> {
  entries: T[];
  cursor: number;
}

export interface SendResult {
  sent: number | boolean;
  state?: string;
  routed_to?: string;
}

export interface AgentStateResult {
  state: string;
  currentTask?: string;
  inbox: Array<{
    id: string;
    status: string;
    priority?: string;
    from?: string;
    content: string;
    timestamp: number;
  }>;
  todos: Array<{
    id: string;
    status: string;
    text: string;
  }>;
  history: number;
}

export interface ChannelMessage {
  id: string;
  from: string;
  content: string;
  timestamp: string;
  mentions?: string[];
  to?: string;
}

export interface DocInfo {
  name: string;
}

export class AwClient {
  private baseUrl: string;
  private token: string;

  constructor(opts: { baseUrl: string; token: string }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.token = opts.token;
  }

  /** Connect using daemon discovery file. Throws if daemon is not running. */
  static async discover(dataDir?: string): Promise<AwClient> {
    const dir = dataDir ?? defaultDataDir();
    const info = await readDaemonInfo(dir);
    if (!info) {
      throw new Error(
        "Daemon is not running (use 'aw daemon start' or any command that auto-starts it)",
      );
    }
    return new AwClient({
      baseUrl: `http://${info.host}:${info.port}`,
      token: info.token,
    });
  }

  /** Create from DaemonInfo directly. */
  static fromInfo(info: DaemonInfo): AwClient {
    return new AwClient({
      baseUrl: `http://${info.host}:${info.port}`,
      token: info.token,
    });
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json",
    };
  }

  private async request<T>(path: string, opts?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: { ...this.headers(), ...opts?.headers },
    });

    const body: unknown = await res.json();
    if (!res.ok) {
      const err = body as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return body as T;
  }

  private async sseStream<T>(path: string): Promise<AsyncIterable<T>> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    return {
      [Symbol.asyncIterator]() {
        let buffer = "";
        return {
          async next(): Promise<IteratorResult<T>> {
            while (true) {
              const { value, done } = await reader.read();
              if (done) return { value: undefined as unknown as T, done: true };

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop()!; // keep incomplete line

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    return { value: JSON.parse(line.slice(6)) as T, done: false };
                  } catch {
                    /* skip malformed */
                  }
                }
              }
            }
          },
        };
      },
    };
  }

  // ── Daemon ──────────────────────────────────────────────────────────

  async health(): Promise<HealthInfo> {
    const res = await fetch(`${this.baseUrl}/health`);
    return (await res.json()) as HealthInfo;
  }

  async shutdown(): Promise<void> {
    await this.request("/shutdown", { method: "POST" });
  }

  async readEvents(cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/events${q}`);
  }

  streamEvents(cursor?: number): Promise<AsyncIterable<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.sseStream(`/events/stream${q}`);
  }

  // ── Agents ──────────────────────────────────────────────────────────

  async listAgents(): Promise<ManagedAgentInfo[]> {
    const res = await this.request<{ agents: ManagedAgentInfo[] }>("/agents");
    return res.agents;
  }

  async createAgent(name: string, runtime: RuntimeConfig): Promise<ManagedAgentInfo> {
    return this.request("/agents", {
      method: "POST",
      body: JSON.stringify({ name, runtime }),
    });
  }

  async getAgent(name: string): Promise<ManagedAgentInfo> {
    return this.request(`/agents/${encodeURIComponent(name)}`);
  }

  async removeAgent(name: string): Promise<void> {
    await this.request(`/agents/${encodeURIComponent(name)}`, { method: "DELETE" });
  }

  async sendToAgent(
    name: string,
    messages: Array<{ content: string; from?: string; delayMs?: number }>,
  ): Promise<SendResult> {
    return this.request(`/agents/${encodeURIComponent(name)}/send`, {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
  }

  async readResponses(
    name: string,
    opts?: { cursor?: number; harness?: string },
  ): Promise<CursorResult<DaemonEvent>> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    if (opts?.harness) params.set("harness", opts.harness);
    const q = params.toString() ? `?${params}` : "";
    return this.request(`/agents/${encodeURIComponent(name)}/responses${q}`);
  }

  streamResponses(
    name: string,
    opts?: { cursor?: number; harness?: string },
  ): Promise<AsyncIterable<DaemonEvent>> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    if (opts?.harness) params.set("harness", opts.harness);
    const q = params.toString() ? `?${params}` : "";
    return this.sseStream(`/agents/${encodeURIComponent(name)}/responses/stream${q}`);
  }

  async readAgentEvents(name: string, cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/agents/${encodeURIComponent(name)}/events${q}`);
  }

  streamAgentEvents(name: string, cursor?: number): Promise<AsyncIterable<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.sseStream(`/agents/${encodeURIComponent(name)}/events/stream${q}`);
  }

  async getAgentState(name: string): Promise<AgentStateResult> {
    return this.request(`/agents/${encodeURIComponent(name)}/state`);
  }

  // ── Harnesss ──────────────────────────────────────────────────────

  async listHarnesss(): Promise<ManagedHarnessInfo[]> {
    const res = await this.request<{ harnesss: ManagedHarnessInfo[] }>("/harnesss");
    return res.harnesss;
  }

  async createHarness(
    source: string,
    opts?: {
      name?: string;
      configDir?: string;
      sourcePath?: string;
      tag?: string;
      vars?: Record<string, string>;
      mode?: "service" | "task";
    },
  ): Promise<ManagedHarnessInfo> {
    return this.request("/harnesss", {
      method: "POST",
      body: JSON.stringify({ source, ...opts }),
    });
  }

  async waitHarness(
    key: string,
    timeout?: string,
  ): Promise<{ status: string; result?: Record<string, unknown> }> {
    const q = timeout ? `?timeout=${timeout}` : "";
    return this.request(`/harnesss/${encodeURIComponent(key)}/wait${q}`);
  }

  async getHarness(key: string): Promise<ManagedHarnessInfo> {
    return this.request(`/harnesss/${encodeURIComponent(key)}`);
  }

  async getHarnessStatus(key: string): Promise<Record<string, unknown>> {
    return this.request(`/harnesss/${encodeURIComponent(key)}/status`);
  }

  async listChannels(key: string): Promise<string[]> {
    const res = await this.request<{ channels: string[] }>(
      `/harnesss/${encodeURIComponent(key)}/channels`,
    );
    return res.channels;
  }

  async peekInbox(key: string, agent: string): Promise<any[]> {
    const res = await this.request<{ entries: any[] }>(
      `/harnesss/${encodeURIComponent(key)}/inbox/${encodeURIComponent(agent)}`,
    );
    return res.entries;
  }

  async stopHarness(key: string): Promise<void> {
    await this.request(`/harnesss/${encodeURIComponent(key)}`, { method: "DELETE" });
  }

  async sendToHarness(
    key: string,
    opts: { content: string; from?: string; agent?: string; channel?: string },
  ): Promise<SendResult> {
    return this.request(`/harnesss/${encodeURIComponent(key)}/send`, {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async readChannel(
    key: string,
    channel: string,
    opts?: { limit?: number; since?: string; agent?: string },
  ): Promise<{ channel: string; messages: ChannelMessage[] }> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts?.since) params.set("since", opts.since);
    if (opts?.agent) params.set("agent", opts.agent);
    const q = params.toString() ? `?${params}` : "";
    return this.request(
      `/harnesss/${encodeURIComponent(key)}/channels/${encodeURIComponent(channel)}${q}`,
    );
  }

  async clearChannel(key: string, channel: string): Promise<void> {
    await this.request(
      `/harnesss/${encodeURIComponent(key)}/channels/${encodeURIComponent(channel)}`,
      { method: "DELETE" },
    );
  }

  streamChannel(
    key: string,
    channel: string,
    opts?: { agent?: string },
  ): Promise<AsyncIterable<DaemonEvent>> {
    const params = new URLSearchParams();
    if (opts?.agent) params.set("agent", opts.agent);
    const q = params.toString() ? `?${params}` : "";
    return this.sseStream(
      `/harnesss/${encodeURIComponent(key)}/channels/${encodeURIComponent(channel)}/stream${q}`,
    );
  }

  async readHarnessEvents(key: string, cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/harnesss/${encodeURIComponent(key)}/events${q}`);
  }

  streamHarnessEvents(key: string, cursor?: number): Promise<AsyncIterable<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.sseStream(`/harnesss/${encodeURIComponent(key)}/events/stream${q}`);
  }

  /**
   * Read entries from the harness chronicle (append-only human-readable
   * timeline of decisions / task transitions / milestones). Optional
   * limit caps the response size (default 50, max 500); category filters
   * by the category name (e.g. "task", "decision", "milestone").
   */
  async readHarnessChronicle(
    key: string,
    opts?: { limit?: number; category?: string },
  ): Promise<{
    entries: Array<{
      id: string;
      timestamp: string;
      author: string;
      category: string;
      content: string;
    }>;
  }> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts?.category) params.set("category", opts.category);
    const qs = params.toString();
    return this.request(`/harnesss/${encodeURIComponent(key)}/chronicle${qs ? `?${qs}` : ""}`);
  }

  // ── Task ledger ─────────────────────────────────────────────────────

  /**
   * List tasks from the harness's kernel state store. `status` is a
   * comma-separated filter (e.g. "draft,open,in_progress"); `ownerLeadId`
   * filters by owning lead.
   */
  async listHarnessTasks(
    key: string,
    opts?: { status?: string; ownerLeadId?: string },
  ): Promise<{ tasks: Record<string, unknown>[] }> {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.ownerLeadId) params.set("ownerLeadId", opts.ownerLeadId);
    const qs = params.toString();
    return this.request(`/harnesss/${encodeURIComponent(key)}/tasks${qs ? `?${qs}` : ""}`);
  }

  /** Fetch a single task with its Wakes and handoffs. */
  async getHarnessTask(
    key: string,
    taskId: string,
  ): Promise<{
    task: Record<string, unknown>;
    wakes: Record<string, unknown>[];
    handoffs: Record<string, unknown>[];
  }> {
    return this.request(
      `/harnesss/${encodeURIComponent(key)}/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  /** Create a new task in the harness ledger. */
  async createHarnessTask(
    key: string,
    body: {
      title: string;
      goal: string;
      status?: string;
      priority?: number;
      ownerLeadId?: string;
      acceptanceCriteria?: string;
      sourceKind?: string;
      sourceRef?: string;
    },
  ): Promise<{ task: Record<string, unknown> }> {
    return this.request(`/harnesss/${encodeURIComponent(key)}/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  /** Patch an existing task (title / goal / status / priority / owner / acceptance). */
  async updateHarnessTask(
    key: string,
    taskId: string,
    body: {
      title?: string;
      goal?: string;
      status?: string;
      priority?: number;
      ownerLeadId?: string;
      acceptanceCriteria?: string;
    },
  ): Promise<{ task: Record<string, unknown> }> {
    return this.request(
      `/harnesss/${encodeURIComponent(key)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  /** Dispatch a task to a worker — creates a Wake and enqueues the assignment. */
  async dispatchHarnessTask(
    key: string,
    taskId: string,
    body: { worker: string; priority?: "immediate" | "normal" | "background" },
  ): Promise<{ task: Record<string, unknown>; wake: Record<string, unknown> }> {
    return this.request(
      `/harnesss/${encodeURIComponent(key)}/tasks/${encodeURIComponent(taskId)}/dispatch`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  }

  /**
   * Close a task with status "completed" — finalizes the active Wake (if
   * any), records a completed handoff, and transitions the task.
   */
  async completeHarnessTask(
    key: string,
    taskId: string,
    body?: { summary?: string },
  ): Promise<{
    task: Record<string, unknown>;
    wakes: Record<string, unknown>[];
    handoffs: Record<string, unknown>[];
  }> {
    return this.request(
      `/harnesss/${encodeURIComponent(key)}/tasks/${encodeURIComponent(taskId)}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      },
    );
  }

  /**
   * Close a task with status "aborted" — finalizes the active Wake (if
   * any) as cancelled, records an aborted handoff, and transitions the
   * task.
   */
  async abortHarnessTask(
    key: string,
    taskId: string,
    body?: { reason?: string },
  ): Promise<{
    task: Record<string, unknown>;
    wakes: Record<string, unknown>[];
    handoffs: Record<string, unknown>[];
  }> {
    return this.request(
      `/harnesss/${encodeURIComponent(key)}/tasks/${encodeURIComponent(taskId)}/abort`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      },
    );
  }

  // ── Documents ───────────────────────────────────────────────────────

  async listDocs(harness: string): Promise<DocInfo[]> {
    const res = await this.request<{ docs: DocInfo[] }>(
      `/harnesss/${encodeURIComponent(harness)}/docs`,
    );
    return res.docs;
  }

  async readDoc(harness: string, name: string): Promise<string> {
    const res = await this.request<{ name: string; content: string }>(
      `/harnesss/${encodeURIComponent(harness)}/docs/${encodeURIComponent(name)}`,
    );
    return res.content;
  }

  async writeDoc(harness: string, name: string, content: string): Promise<void> {
    await this.request(
      `/harnesss/${encodeURIComponent(harness)}/docs/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ content }) },
    );
  }

  async appendDoc(harness: string, name: string, content: string): Promise<void> {
    await this.request(
      `/harnesss/${encodeURIComponent(harness)}/docs/${encodeURIComponent(name)}`,
      { method: "PATCH", body: JSON.stringify({ content }) },
    );
  }
}

// ── Auto-start daemon ────────────────────────────────────────────────────

/**
 * Ensure the daemon is running, starting it if necessary.
 * Returns an AwClient connected to the (possibly just-started) daemon.
 *
 * CLI commands that need a daemon should call this instead of AwClient.discover().
 * Read-only / inspection commands should use AwClient.discover() directly
 * so they fail fast when the daemon isn't running.
 */
export async function ensureDaemon(
  dataDir?: string,
  opts?: { extraArgs?: string[] },
): Promise<AwClient> {
  const dir = dataDir ?? defaultDataDir();
  const existing = await readDaemonInfo(dir);
  if (existing) {
    return AwClient.fromInfo(existing);
  }
  const info = await spawnDaemon(dir, opts?.extraArgs);
  return AwClient.fromInfo(info);
}

/**
 * Spawn a daemon process in the background and wait for it to be ready.
 * Returns the DaemonInfo once the daemon has written its discovery file.
 */
async function spawnDaemon(dataDir: string, extraArgs?: string[]): Promise<DaemonInfo> {
  const cliEntry = join(dirname(fileURLToPath(import.meta.url)), "cli", "index.ts");

  // Strip CLAUDECODE so nested Claude Code sessions can inherit
  // the host's login state instead of being blocked.
  const env = { ...process.env };
  delete env.CLAUDECODE;

  // Use absolute path to the current runtime to avoid PATH lookup issues.
  // Also inject the runtime's bin directory into PATH so child processes
  // (e.g. bun spawned by the daemon) can find bun without relying on the
  // user's PATH being inherited correctly.
  const runtime = process.execPath;
  const bunBinDir = dirname(runtime);
  env.PATH = `${bunBinDir}:${env.PATH || ""}`;

  const dataDirArgs = dataDir !== defaultDataDir() ? ["--data-dir", dataDir] : [];
  const runtimeArgs = [
    ...process.execArgv,
    cliEntry,
    "daemon",
    "start",
    ...dataDirArgs,
    ...(extraArgs ?? []),
  ];

  const subprocess = execa(runtime, runtimeArgs, {
    env,
    detached: true,
    stdio: "ignore",
  });
  subprocess.unref();

  // Poll for daemon.json (up to 5s)
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 200));
    const info = await readDaemonInfo(dataDir);
    if (info) {
      // Verify the daemon is actually responding
      try {
        const res = await fetch(`http://${info.host}:${info.port}/health`);
        if (res.ok) return info;
      } catch {
        // Not ready yet
      }
    }
  }

  throw new Error("Failed to auto-start daemon (timed out after 5s)");
}
