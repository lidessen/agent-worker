/**
 * WebClient — browser API client for agent-worker daemon.
 *
 * Standalone browser client (no Node.js dependencies).
 * SSE streaming logic ported from AwClient.sseStream().
 */

import type {
  HealthInfo,
  AgentInfo,
  HarnessInfo,
  AgentState,
  CursorResult,
  DaemonEvent,
  ChannelMessage,
  DocInfo,
  RuntimeConfig,
  HarnessStatus,
  HarnessInboxEntry,
  TaskSummary,
  TaskDetail,
  MonitorSnapshot,
  MonitorEvent,
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

  async listHarnesses(): Promise<HarnessInfo[]> {
    const res = await this.request<{ harnesses: HarnessInfo[] }>("/harnesses");
    return res.harnesses;
  }

  async getAgentState(name: string): Promise<AgentState> {
    return this.request(`/agents/${encodeURIComponent(name)}/state`);
  }

  async sendToAgent(name: string, messages: Array<{ content: string }>): Promise<void> {
    await this.request(`/agents/${encodeURIComponent(name)}/send`, {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
  }

  async readResponses(name: string, cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/agents/${encodeURIComponent(name)}/responses${q}`);
  }

  async readAgentEvents(name: string, cursor?: number): Promise<CursorResult<DaemonEvent>> {
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

  async deleteHarness(key: string): Promise<void> {
    await this.request(`/harnesses/${encodeURIComponent(key)}`, {
      method: "DELETE",
    });
  }

  async clearChannel(key: string, ch: string): Promise<void> {
    await this.request(
      `/harnesses/${encodeURIComponent(key)}/channels/${encodeURIComponent(ch)}`,
      { method: "DELETE" },
    );
  }

  // ── Create API ────────────────────────────────────────────────────

  async createHarness(opts: {
    source: string;
    name?: string;
    tag?: string;
    mode?: string;
  }): Promise<HarnessInfo> {
    return this.request("/harnesses", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  async createAgent(opts: { name: string; runtime: RuntimeConfig }): Promise<AgentInfo> {
    return this.request("/agents", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  // ── Harness API ──────────────────────────────────────────────────

  async getHarness(key: string): Promise<HarnessInfo> {
    return this.request(`/harnesses/${encodeURIComponent(key)}`);
  }

  async listChannels(key: string): Promise<string[]> {
    const res = await this.request<{ channels: string[] }>(
      `/harnesses/${encodeURIComponent(key)}/channels`,
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
      `/harnesses/${encodeURIComponent(key)}/channels/${encodeURIComponent(ch)}${q}`,
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
      `/harnesses/${encodeURIComponent(key)}/channels/${encodeURIComponent(ch)}/stream${q}`,
      opts?.signal,
    );
  }

  async sendToHarness(
    key: string,
    content: string,
    opts?: { channel?: string; agent?: string },
  ): Promise<void> {
    await this.request(`/harnesses/${encodeURIComponent(key)}/send`, {
      method: "POST",
      body: JSON.stringify({ content, channel: opts?.channel, agent: opts?.agent }),
    });
  }

  async listDocs(key: string): Promise<DocInfo[]> {
    const res = await this.request<{ docs: DocInfo[] }>(
      `/harnesses/${encodeURIComponent(key)}/docs`,
    );
    return res.docs;
  }

  async listHarnessTasks(
    key: string,
    opts?: { status?: string; ownerLeadId?: string },
  ): Promise<TaskSummary[]> {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.ownerLeadId) params.set("ownerLeadId", opts.ownerLeadId);
    const qs = params.toString();
    const res = await this.request<{ tasks: TaskSummary[] }>(
      `/harnesses/${encodeURIComponent(key)}/tasks${qs ? `?${qs}` : ""}`,
    );
    return res.tasks;
  }

  async getHarnessTask(key: string, taskId: string): Promise<TaskDetail> {
    return this.request<TaskDetail>(
      `/harnesses/${encodeURIComponent(key)}/tasks/${encodeURIComponent(taskId)}`,
    );
  }

  async readDoc(key: string, name: string): Promise<string> {
    const res = await this.request<{ content: string }>(
      `/harnesses/${encodeURIComponent(key)}/docs/${encodeURIComponent(name)}`,
    );
    return res.content;
  }

  async writeDoc(key: string, name: string, content: string): Promise<void> {
    await this.request(`/harnesses/${encodeURIComponent(key)}/docs/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async appendDoc(key: string, name: string, content: string): Promise<void> {
    await this.request(`/harnesses/${encodeURIComponent(key)}/docs/${encodeURIComponent(name)}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    });
  }

  // ── Harness Status & Events ──────────────────────────────────────

  async getHarnessStatus(key: string): Promise<HarnessStatus> {
    return this.request(`/harnesses/${encodeURIComponent(key)}/status`);
  }

  async peekInbox(key: string, agent: string): Promise<HarnessInboxEntry[]> {
    const res = await this.request<{ entries: HarnessInboxEntry[] }>(
      `/harnesses/${encodeURIComponent(key)}/inbox/${encodeURIComponent(agent)}`,
    );
    return res.entries ?? [];
  }

  async readHarnessEvents(key: string, cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/harnesses/${encodeURIComponent(key)}/events${q}`);
  }

  async *streamHarnessEvents(
    key: string,
    opts?: { cursor?: number; signal?: AbortSignal },
  ): AsyncGenerator<DaemonEvent> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    const q = params.toString() ? `?${params}` : "";
    yield* this.sseStream<DaemonEvent>(
      `/harnesses/${encodeURIComponent(key)}/events/stream${q}`,
      opts?.signal,
    );
  }

  // ── Daemon Events ──────────────────────────────────────────────────

  async readDaemonEvents(cursor?: number): Promise<CursorResult<DaemonEvent>> {
    const q = cursor !== undefined ? `?cursor=${cursor}` : "";
    return this.request(`/events${q}`);
  }

  async *streamDaemonEvents(opts?: {
    cursor?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<DaemonEvent> {
    const params = new URLSearchParams();
    if (opts?.cursor !== undefined) params.set("cursor", String(opts.cursor));
    const q = params.toString() ? `?${params}` : "";
    yield* this.sseStream<DaemonEvent>(`/events/stream${q}`, opts?.signal);
  }

  // ── Monitor (decision 004) ──────────────────────────────────────────

  async monitorSnapshot(): Promise<MonitorSnapshot> {
    return this.request("/monitor/snapshot");
  }

  async *streamMonitor(opts?: { signal?: AbortSignal }): AsyncGenerator<MonitorEvent> {
    yield* this.sseStream<MonitorEvent>("/monitor/stream", opts?.signal);
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
  private async *sseStream<T>(path: string, signal?: AbortSignal): AsyncGenerator<T> {
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
