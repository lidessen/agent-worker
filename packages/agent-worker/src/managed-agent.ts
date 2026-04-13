import { join } from "node:path";
import { mkdirSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { Agent, FileNotesStorage, FileMemoryStorage } from "@agent-worker/agent";
import type { AgentConfig, AgentState } from "@agent-worker/agent";
import type { LoopEvent } from "@agent-worker/loop";
import type { EventBus } from "@agent-worker/shared";
import { readFrom, parseJsonl } from "@agent-worker/shared";
import type { AgentKind, ManagedAgentInfo, DaemonEvent } from "./types.ts";

/**
 * ManagedAgent wraps an Agent instance with lifecycle metadata,
 * per-agent JSONL storage, and event forwarding for the daemon layer.
 */
export class ManagedAgent {
  readonly name: string;
  readonly kind: AgentKind;
  readonly runtime?: string;
  readonly createdAt: number;
  readonly agent: Agent;

  private _workspace?: string;
  private _responsesPath?: string;
  private _eventsPath?: string;
  private _inboxPath?: string;
  private _timelinePath?: string;
  private _currentResponseText = "";
  private _lastUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    contextWindow?: number;
    usedRatio?: number;
    source: "runtime" | "estimate";
    ts: number;
  } | null = null;

  constructor(opts: {
    name: string;
    kind: AgentKind;
    runtime?: string;
    config: AgentConfig;
    workspace?: string;
    bus?: EventBus;
    /**
     * Explicit directory for this agent's JSONL storage.
     * - Global agents: `<dataDir>/agents/<name>`
     * - Workspace agents: `<dataDir>/workspaces/<key>/agents/<name>`
     */
    agentDir?: string;
  }) {
    this.name = opts.name;
    this.kind = opts.kind;
    this.runtime = opts.runtime;
    this.createdAt = Date.now();
    this._workspace = opts.workspace;

    // Set up per-agent storage (preserve existing files across restarts)
    if (opts.agentDir) {
      mkdirSync(opts.agentDir, { recursive: true });
      this._responsesPath = join(opts.agentDir, "responses.jsonl");
      this._eventsPath = join(opts.agentDir, "events.jsonl");
      this._inboxPath = join(opts.agentDir, "inbox.jsonl");
      this._timelinePath = join(opts.agentDir, "timeline.jsonl");
      if (!existsSync(this._responsesPath)) writeFileSync(this._responsesPath, "");
      if (!existsSync(this._eventsPath)) writeFileSync(this._eventsPath, "");
      if (!existsSync(this._inboxPath)) writeFileSync(this._inboxPath, "");
      if (!existsSync(this._timelinePath)) writeFileSync(this._timelinePath, "");
    }

    // Inject bus + file-backed notes/memory storage when a durable
    // agentDir is available. This is the phase-2 slice-1 wiring —
    // the `FileNotesStorage` / `FileMemoryStorage` classes have
    // always existed; they just weren't being instantiated in prod.
    // Caller can still pre-populate these (e.g. tests) and we won't
    // clobber them.
    const notesStorage =
      opts.config.notesStorage ??
      (opts.agentDir ? new FileNotesStorage(join(opts.agentDir, "notes")) : undefined);
    const memory =
      opts.config.memory ??
      (opts.agentDir ? { storage: new FileMemoryStorage(opts.agentDir) } : undefined);

    const config: AgentConfig = {
      ...opts.config,
      name: opts.name,
      bus: opts.bus ?? opts.config.bus,
      notesStorage,
      memory,
    };
    this.agent = new Agent(config);
  }

  async init(): Promise<void> {
    await this.agent.init();
    this._wireEventListeners();
  }

  /** Wire Agent events → per-agent JSONL files. */
  private _wireEventListeners(): void {
    if (!this._responsesPath || !this._eventsPath) return;

    this.agent.on("stateChange", (state: AgentState) => {
      this._appendEvent({ type: "state_change", state });
      this._appendTimeline({ type: "state_change", state });
    });

    this.agent.on("messageReceived", (msg) => {
      this._appendEvent({
        type: "message_received",
        id: msg.id,
        from: msg.from,
        content: msg.content,
      });
      this._appendInbox({
        type: "received",
        id: msg.id,
        from: msg.from,
        content: msg.content,
      });
    });

    this.agent.on("runStart", (info) => {
      this._currentResponseText = "";
      this._appendEvent({ type: "run_start", runNumber: info.runNumber, trigger: info.trigger });
      this._appendTimeline({ type: "run_start", runNumber: info.runNumber, trigger: info.trigger });
    });

    this.agent.on("runEnd", (result) => {
      if (this._currentResponseText.trim()) {
        this._appendResponse({ type: "text", text: this._currentResponseText });
      }
      this._currentResponseText = "";
      this._appendEvent({
        type: "run_end",
        durationMs: result.durationMs,
        tokens: result.usage.totalTokens,
      });
      this._appendTimeline({
        type: "run_end",
        durationMs: result.durationMs,
        tokens: result.usage.totalTokens,
      });
    });

    this.agent.on("event", (event: LoopEvent) => {
      if (event.type === "text") {
        this._appendEvent({ type: "text", text: event.text });
        this._currentResponseText += event.text;
      } else if (event.type === "tool_call_start") {
        this._appendEvent({
          type: "runtime_event",
          eventKind: "tool",
          phase: "start",
          name: event.name,
          callId: event.callId,
          args: event.args,
        });
      } else if (event.type === "tool_call_end") {
        this._appendEvent({
          type: "runtime_event",
          eventKind: "tool",
          phase: "end",
          name: event.name,
          callId: event.callId,
          result: event.result,
          durationMs: event.durationMs,
          error: event.error,
        });
      } else if (event.type === "hook") {
        this._appendEvent({
          type: "runtime_event",
          eventKind: "hook",
          phase: event.phase,
          name: event.name,
          hookEvent: event.hookEvent,
          output: event.output,
          stdout: event.stdout,
          stderr: event.stderr,
          outcome: event.outcome,
        });
      } else if (event.type === "thinking") {
        this._appendEvent({ type: "thinking", text: event.text });
      } else if (event.type === "usage") {
        this._lastUsage = {
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.totalTokens,
          contextWindow: event.contextWindow,
          usedRatio: event.usedRatio,
          source: event.source,
          ts: Date.now(),
        };
        this._appendEvent({
          type: "runtime_event",
          eventKind: "usage",
          inputTokens: event.inputTokens,
          outputTokens: event.outputTokens,
          totalTokens: event.totalTokens,
          contextWindow: event.contextWindow,
          usedRatio: event.usedRatio,
          usageSource: event.source,
        });
      } else if (event.type === "error") {
        this._appendEvent({ type: "error", error: String(event.error) });
      }
    });

    this.agent.on("send", (target, content) => {
      this._appendResponse({ type: "send", target, content });
      this._appendTimeline({ type: "send", target, content });
    });

    this.agent.on("contextAssembled", (prompt) => {
      this._appendEvent({
        type: "context_assembled",
        tokenCount: prompt.tokenCount,
        turnCount: prompt.turns.length,
      });
    });
  }

  private _appendResponse(entry: Record<string, unknown>): void {
    if (!this._responsesPath) return;
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
    appendFileSync(this._responsesPath, line);
  }

  private _appendEvent(entry: Record<string, unknown>): void {
    if (!this._eventsPath) return;
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
    appendFileSync(this._eventsPath, line);
  }

  private _appendInbox(entry: Record<string, unknown>): void {
    if (!this._inboxPath) return;
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
    appendFileSync(this._inboxPath, line);
  }

  private _appendTimeline(entry: Record<string, unknown>): void {
    if (!this._timelinePath) return;
    const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
    appendFileSync(this._timelinePath, line);
  }

  /** Read responses from byte offset. */
  async readResponses(cursor = 0): Promise<{ entries: DaemonEvent[]; cursor: number }> {
    if (!this._responsesPath) return { entries: [], cursor: 0 };
    const { data, cursor: newCursor } = await readFrom(this._responsesPath, cursor);
    return { entries: parseJsonl<DaemonEvent>(data), cursor: newCursor };
  }

  /** Read events from byte offset. */
  async readEvents(cursor = 0): Promise<{ entries: DaemonEvent[]; cursor: number }> {
    if (!this._eventsPath) return { entries: [], cursor: 0 };
    const { data, cursor: newCursor } = await readFrom(this._eventsPath, cursor);
    return { entries: parseJsonl<DaemonEvent>(data), cursor: newCursor };
  }

  /** Read inbox from byte offset. */
  async readInbox(cursor = 0): Promise<{ entries: DaemonEvent[]; cursor: number }> {
    if (!this._inboxPath) return { entries: [], cursor: 0 };
    const { data, cursor: newCursor } = await readFrom(this._inboxPath, cursor);
    return { entries: parseJsonl<DaemonEvent>(data), cursor: newCursor };
  }

  /** Read timeline from byte offset. */
  async readTimeline(cursor = 0): Promise<{ entries: DaemonEvent[]; cursor: number }> {
    if (!this._timelinePath) return { entries: [], cursor: 0 };
    const { data, cursor: newCursor } = await readFrom(this._timelinePath, cursor);
    return { entries: parseJsonl<DaemonEvent>(data), cursor: newCursor };
  }

  async stop(): Promise<void> {
    if (this.agent.state !== "stopped") {
      await this.agent.stop();
    }
  }

  get state(): AgentState {
    return this.agent.state;
  }

  /** Latest cumulative token usage reported by the runtime, if the loop supports usageStream. */
  get lastUsage(): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    contextWindow?: number;
    usedRatio?: number;
    source: "runtime" | "estimate";
    ts: number;
  } | null {
    return this._lastUsage;
  }

  get info(): ManagedAgentInfo {
    return {
      name: this.name,
      kind: this.kind,
      state: this.state,
      runtime: this.runtime,
      createdAt: this.createdAt,
      workspace: this._workspace,
    };
  }

  /** Send a message to this agent's inbox. */
  push(message: { content: string; from?: string }): void {
    this._appendInbox({ type: "push", from: message.from, content: message.content });
    this.agent.push(message);
  }

  private _runQueue: Promise<{ text: string; events: LoopEvent[] }> = Promise.resolve({
    text: "",
    events: [],
  });

  /**
   * Send a message and collect the text response.
   * Serialized: concurrent calls are queued so events never mix.
   */
  async run(message: string, from?: string): Promise<{ text: string; events: LoopEvent[] }> {
    const prev = this._runQueue;
    const next = prev.catch(() => {}).then(() => this._doRun(message, from));
    this._runQueue = next;
    return next;
  }

  private async _doRun(
    message: string,
    from?: string,
  ): Promise<{ text: string; events: LoopEvent[] }> {
    const events: LoopEvent[] = [];
    const textParts: string[] = [];

    const handler = (event: LoopEvent) => {
      events.push(event);
      if (event.type === "text") {
        textParts.push(event.text);
      }
    };

    this.agent.on("event", handler);

    // Push message and wait for processing to complete
    this.agent.push({ content: message, from });

    // Wait for agent to finish processing
    await this.waitForIdle();

    this.agent.off("event", handler);

    return { text: textParts.join(""), events };
  }

  /** Wait until the agent returns to idle or waiting state. */
  private waitForIdle(): Promise<void> {
    return new Promise((resolve) => {
      const s = this.agent.state;
      if (s === "idle" || s === "waiting" || s === "stopped" || s === "error") {
        resolve();
        return;
      }
      const onState = (state: AgentState) => {
        if (state === "idle" || state === "waiting" || state === "stopped" || state === "error") {
          this.agent.off("stateChange", onState);
          resolve();
        }
      };
      this.agent.on("stateChange", onState);
    });
  }
}
