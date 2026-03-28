/**
 * WebClient — browser API client for agent-worker daemon.
 *
 * Standalone browser client (no Node.js dependencies).
 * SSE streaming logic ported from AwClient.sseStream().
 */

import type {
  HealthInfo,
  AgentInfo,
  WorkspaceInfo,
  AgentState,
  CursorResult,
  DaemonEvent,
  ChannelMessage,
  DocInfo,
  RuntimeConfig,
  WorkspaceStatus,
  WorkspaceInboxEntry,
} from "./types.ts";

export class WebClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }

  // ── Public API ──────────────────────────────────────────────────────

  async health(): Promise<HealthInfo> {
    return this.request("/health");
  }

  async listAgents(): Promise<AgentInfo[]> {
    const res = await this.request<{ agents: AgentInfo[] }>("/agents");
    return res.agents;
  }

  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    const res = await this.request<{ workspaces: WorkspaceInfo[] }>("/workspaces");
    return res.workspaces;
  }

  async getAgentState(name: string): Promise<AgentState> {
    return this.request(`/agents/${encodeURIComponent(name)}/state`);
  }

  async sendToAgent(
    name: string,
    messages: Array<{ content: string }>,
  ): Promise<void> {
    await this.request(`/agents/${encodeURIComponent(name)}/send`, {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
  }

  async readResponses(
    name: string,
    cursor?: number,
  ): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/agents/${encodeURIComponent(name)}/responses${q}`);
  }

  async readAgentEvents(
    name: string,
    cursor?: number,
  ): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/agents/${encodeURIComponent(name)}/events${q}`);
  }

  async *streamResponses(
    name: string,
    opts?: { cursor?: number; signal?: AbortSignal },
  ): AsyncGenerator<DaemonEvent> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    const q = params.toString() ? `?${params}` : "";
    yield* this.sseStream<DaemonEvent>(
      `/agents/${encodeURIComponent(name)}/responses/stream${q}`,
      opts?.signal,
    );
  }

  async *streamAgentEvents(
    name: string,
    opts?: { cursor?: number; signal?: AbortSignal },
  ): AsyncGenerator<DaemonEvent> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    const q = params.toString() ? `?${params}` : "";
    yield* this.sseStream<DaemonEvent>(
      `/agents/${encodeURIComponent(name)}/events/stream${q}`,
      opts?.signal,
    );
  }

  // ── Delete API ────────────────────────────────────────────────────

  async deleteAgent(name: string): Promise<void> {
    await this.request(`/agents/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  async deleteWorkspace(key: string): Promise<void> {
    await this.request(`/workspaces/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  }

  async clearChannel(key: string, ch: string): Promise<void> {
    await this.request(
      `/workspaces/${encodeURIComponent(key)}/channels/${encodeURIComponent(ch)}`,
      { method: "DELETE" },
    );
  }

  // ── Create API ────────────────────────────────────────────────────

  async createWorkspace(opts: {
    source: string;
    name?: string;
    tag?: string;
    mode?: string;
  }): Promise<WorkspaceInfo> {
    return this.request("/workspaces", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async createAgent(opts: {
    name: string;
    runtime: RuntimeConfig;
  }): Promise<AgentInfo> {
    return this.request("/agents", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  // ── Workspace API ──────────────────────────────────────────────────

  async getWorkspace(key: string): Promise<WorkspaceInfo> {
    return this.request(`/workspaces/${encodeURIComponent(key)}`);
  }

  async listChannels(key: string): Promise<string[]> {
    const res = await this.request<{ channels: string[] }>(
      `/workspaces/${encodeURIComponent(key)}/channels`,
    );
    return res.channels;
  }

  async readChannel(
    key: string,
    ch: string,
    opts?: { limit?: number; since?: string },
  ): Promise<ChannelMessage[]> {
    const params = new URLSearchParams();
    if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts?.since !== undefined) params.set("since", opts.since);
    const q = params.toString() ? `?${params}` : "";
    const res = await this.request<{ messages: ChannelMessage[] }>(
      `/workspaces/${encodeURIComponent(key)}/channels/${encodeURIComponent(ch)}${q}`,
    );
    return res.messages;
  }

  async *streamChannel(
    key: string,
    ch: string,
    opts?: { cursor?: number; signal?: AbortSignal },
  ): AsyncGenerator<ChannelMessage> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    const q = params.toString() ? `?${params}` : "";
    yield* this.sseStream<ChannelMessage>(
      `/workspaces/${encodeURIComponent(key)}/channels/${encodeURIComponent(ch)}/stream${q}`,
      opts?.signal,
    );
  }

  async sendToWorkspace(
    key: string,
    content: string,
    opts?: { channel?: string; agent?: string },
  ): Promise<void> {
    await this.request(`/workspaces/${encodeURIComponent(key)}/send`, {
      method: "POST",
      body: JSON.stringify({ content, channel: opts?.channel, agent: opts?.agent }),
    });
  }

  async listDocs(key: string): Promise<DocInfo[]> {
    const res = await this.request<{ docs: DocInfo[] }>(
      `/workspaces/${encodeURIComponent(key)}/docs`,
    );
    return res.docs;
  }

  async readDoc(key: string, name: string): Promise<string> {
    const res = await this.request<{ content: string }>(
      `/workspaces/${encodeURIComponent(key)}/docs/${encodeURIComponent(name)}`,
    );
    return res.content;
  }

  async writeDoc(key: string, name: string, content: string): Promise<void> {
    await this.request(
      `/workspaces/${encodeURIComponent(key)}/docs/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ content }) },
    );
  }

  async appendDoc(key: string, name: string, content: string): Promise<void> {
    await this.request(
      `/workspaces/${encodeURIComponent(key)}/docs/${encodeURIComponent(name)}`,
      { method: "PATCH", body: JSON.stringify({ content }) },
    );
  }

  // ── Workspace Status & Events ──────────────────────────────────────

  async getWorkspaceStatus(key: string): Promise<WorkspaceStatus> {
    return this.request(`/workspaces/${encodeURIComponent(key)}/status`);
  }

  async peekInbox(key: string, agent: string): Promise<WorkspaceInboxEntry[]> {
    const res = await this.request<{ entries: WorkspaceInboxEntry[] }>(
      `/workspaces/${encodeURIComponent(key)}/inbox/${encodeURIComponent(agent)}`,
    );
    return res.entries ?? [];
  }

  async readWorkspaceEvents(
    key: string,
    cursor?: number,
  ): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/workspaces/${encodeURIComponent(key)}/events${q}`);
  }

  async *streamWorkspaceEvents(
    key: string,
    opts?: { cursor?: number; signal?: AbortSignal },
  ): AsyncGenerator<DaemonEvent> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    const q = params.toString() ? `?${params}` : "";
    yield* this.sseStream<DaemonEvent>(
      `/workspaces/${encodeURIComponent(key)}/events/stream${q}`,
      opts?.signal,
    );
  }

  // ── Daemon Events ──────────────────────────────────────────────────

  async readDaemonEvents(cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/events${q}`);
  }

  async *streamDaemonEvents(
    opts?: { cursor?: number; signal?: AbortSignal },
  ): AsyncGenerator<DaemonEvent> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    const q = params.toString() ? `?${params}` : "";
    yield* this.sseStream<DaemonEvent>(`/events/stream${q}`, opts?.signal);
  }

  // ── HTTP helpers ────────────────────────────────────────────────────

  private authHeaders(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    return h;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.authHeaders(),
        ...init?.headers,
      },
    });

    const body: unknown = await res.json();
    if (!res.ok) {
      const err = body as { error?: string };
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    return body as T;
  }

  /**
   * SSE stream parser — ported from AwClient.sseStream().
   *
   * Uses fetch() + ReadableStream reader to parse Server-Sent Events.
   * Yields one parsed object per `data: ...\n\n` frame.
   * Handles abort gracefully (catches abort error and returns).
   */
  private async *sseStream<T>(
    path: string,
    signal?: AbortSignal,
  ): AsyncGenerator<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, { headers, signal });

    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) return;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop()!; // incomplete frame stays in buffer

        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                yield JSON.parse(line.slice(6)) as T;
              } catch {
                /* skip malformed JSON */
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      // Abort signals throw DOMException with name "AbortError"
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      throw err;
    } finally {
      reader.releaseLock();
    }
  }
}
