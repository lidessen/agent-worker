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
  ManagedWorkspaceInfo,
  RuntimeConfig,
} from "./types.ts";
import { readDaemonInfo, defaultDataDir } from "./discovery.ts";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

export interface HealthInfo {
  status: string;
  pid: number;
  uptime: number;
  agents: number;
  workspaces: number;
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
  inbox: Array<{
    id: string;
    status: string;
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

  /** Connect using daemon discovery file. Auto-starts daemon if not running. */
  static async discover(dataDir?: string): Promise<AwClient> {
    const dir = dataDir ?? defaultDataDir();
    let info = await readDaemonInfo(dir);
    if (!info) {
      info = await autoStartDaemon(dir);
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
    opts?: { cursor?: number; workspace?: string },
  ): Promise<CursorResult<DaemonEvent>> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    if (opts?.workspace) params.set("workspace", opts.workspace);
    const q = params.toString() ? `?${params}` : "";
    return this.request(`/agents/${encodeURIComponent(name)}/responses${q}`);
  }

  streamResponses(
    name: string,
    opts?: { cursor?: number; workspace?: string },
  ): Promise<AsyncIterable<DaemonEvent>> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    if (opts?.workspace) params.set("workspace", opts.workspace);
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

  // ── Workspaces ──────────────────────────────────────────────────────

  async listWorkspaces(): Promise<ManagedWorkspaceInfo[]> {
    const res = await this.request<{ workspaces: ManagedWorkspaceInfo[] }>("/workspaces");
    return res.workspaces;
  }

  async createWorkspace(
    source: string,
    opts?: {
      name?: string;
      configDir?: string;
      tag?: string;
      vars?: Record<string, string>;
      mode?: "service" | "task";
    },
  ): Promise<ManagedWorkspaceInfo> {
    return this.request("/workspaces", {
      method: "POST",
      body: JSON.stringify({ source, ...opts }),
    });
  }

  async waitWorkspace(
    key: string,
    timeout?: string,
  ): Promise<{ status: string; result?: Record<string, unknown> }> {
    const q = timeout ? `?timeout=${timeout}` : "";
    return this.request(`/workspaces/${encodeURIComponent(key)}/wait${q}`);
  }

  async getWorkspace(key: string): Promise<ManagedWorkspaceInfo> {
    return this.request(`/workspaces/${encodeURIComponent(key)}`);
  }

  async getWorkspaceStatus(key: string): Promise<Record<string, unknown>> {
    return this.request(`/workspaces/${encodeURIComponent(key)}/status`);
  }

  async listChannels(key: string): Promise<string[]> {
    const res = await this.request<{ channels: string[] }>(
      `/workspaces/${encodeURIComponent(key)}/channels`,
    );
    return res.channels;
  }

  async peekInbox(key: string, agent: string): Promise<any[]> {
    const res = await this.request<{ entries: any[] }>(
      `/workspaces/${encodeURIComponent(key)}/inbox/${encodeURIComponent(agent)}`,
    );
    return res.entries;
  }

  async stopWorkspace(key: string): Promise<void> {
    await this.request(`/workspaces/${encodeURIComponent(key)}`, { method: "DELETE" });
  }

  async sendToWorkspace(
    key: string,
    opts: { content: string; from?: string; agent?: string; channel?: string },
  ): Promise<SendResult> {
    return this.request(`/workspaces/${encodeURIComponent(key)}/send`, {
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
      `/workspaces/${encodeURIComponent(key)}/channels/${encodeURIComponent(channel)}${q}`,
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
      `/workspaces/${encodeURIComponent(key)}/channels/${encodeURIComponent(channel)}/stream${q}`,
    );
  }

  async readWorkspaceEvents(key: string, cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/workspaces/${encodeURIComponent(key)}/events${q}`);
  }

  streamWorkspaceEvents(key: string, cursor?: number): Promise<AsyncIterable<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.sseStream(`/workspaces/${encodeURIComponent(key)}/events/stream${q}`);
  }

  // ── Documents ───────────────────────────────────────────────────────

  async listDocs(workspace: string): Promise<DocInfo[]> {
    const res = await this.request<{ docs: DocInfo[] }>(
      `/workspaces/${encodeURIComponent(workspace)}/docs`,
    );
    return res.docs;
  }

  async readDoc(workspace: string, name: string): Promise<string> {
    const res = await this.request<{ name: string; content: string }>(
      `/workspaces/${encodeURIComponent(workspace)}/docs/${encodeURIComponent(name)}`,
    );
    return res.content;
  }

  async writeDoc(workspace: string, name: string, content: string): Promise<void> {
    await this.request(
      `/workspaces/${encodeURIComponent(workspace)}/docs/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ content }) },
    );
  }

  async appendDoc(workspace: string, name: string, content: string): Promise<void> {
    await this.request(
      `/workspaces/${encodeURIComponent(workspace)}/docs/${encodeURIComponent(name)}`,
      { method: "PATCH", body: JSON.stringify({ content }) },
    );
  }
}

// ── Auto-start daemon ────────────────────────────────────────────────────

/**
 * Spawn a daemon process in the background and wait for it to be ready.
 * Returns the DaemonInfo once the daemon has written its discovery file.
 */
async function autoStartDaemon(dataDir: string): Promise<DaemonInfo> {
  const cliEntry = join(dirname(fileURLToPath(import.meta.url)), "cli", "index.ts");

  // Strip CLAUDECODE so nested Claude Code sessions can inherit
  // the host's login state instead of being blocked.
  const env = { ...process.env };
  delete env.CLAUDECODE;

  // Detect current runtime to spawn the daemon with the same one.
  // Under bun: spawn "bun run <file>".
  // Under node/tsx: spawn the same node binary with the same exec flags
  // (e.g. --import tsx) so TypeScript files are handled correctly.
  const isBun = !!process.versions.bun;
  const command = isBun ? "bun" : process.execPath;
  const args = [...(isBun ? ["run"] : process.execArgv), cliEntry, "daemon", "start"];

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    env,
  });
  child.unref();

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
