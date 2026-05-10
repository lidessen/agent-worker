// Per-Harness runtime for the single-agent chat HarnessType.
//
// Owns the conversation thread + the simple idle/thinking state
// machine. Conversation history is persisted to a JSONL file via the
// substrate's `StorageBackend`; one line per turn.

import type { StorageBackend } from "@agent-worker/harness";
import { nanoid } from "@agent-worker/harness";
import type { ChatHarnessAgentConfig, ChatRole, ChatTurn } from "./types.ts";

const CONVERSATION_FILE = "conversation.jsonl";

export interface ChatRuntimeInput {
  agent: ChatHarnessAgentConfig;
  storage: StorageBackend;
}

export class ChatRuntime {
  /** Display name; appears in transcripts and the snapshot. */
  readonly agentName: string;
  /** Loop runtime to dispatch through (claude-code | codex | ai-sdk …). */
  readonly runtimeId: string;
  /** Resolved model spec (opaque to chat — passed through to the loop). */
  readonly model: ChatHarnessAgentConfig["model"];
  /** Optional system prompt. */
  readonly instructions: string | undefined;
  /** Optional working directory passed to the agent loop. */
  readonly cwd: string | undefined;

  /** Idle = nothing in flight; Thinking = a turn is dispatching. */
  state: "idle" | "thinking" = "idle";

  private readonly storage: StorageBackend;
  private readonly turns: ChatTurn[] = [];
  private loaded = false;

  constructor(input: ChatRuntimeInput) {
    const { agent, storage } = input;
    this.agentName = agent.name ?? "assistant";
    this.runtimeId = agent.runtime ?? "mock";
    this.model = agent.model;
    this.instructions = agent.instructions;
    this.cwd = agent.cwd;
    this.storage = storage;
  }

  /**
   * Plain-data summary of the agent's static configuration. Used by
   * the daemon's `/chat-info` endpoint to surface runtime + model +
   * cwd in the conversation header so the user can tell their chats
   * apart when several point at different projects.
   */
  info(): {
    agentName: string;
    runtime: string;
    model?: { id: string; provider?: string; full: string };
    cwd?: string;
    instructions?: string;
  } {
    return {
      agentName: this.agentName,
      runtime: this.runtimeId,
      model: this.model,
      cwd: this.cwd,
      instructions: this.instructions,
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Restore the conversation thread from persisted JSONL. Idempotent
   * — calling twice doesn't double-load. Called from the type's
   * `onInit` hook.
   */
  async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    const lines = await this.storage.readLines(CONVERSATION_FILE);
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const turn = JSON.parse(line) as ChatTurn;
        if (turn && typeof turn.content === "string" && turn.role && turn.id) {
          this.turns.push(turn);
        }
      } catch {
        // Skip corrupted line; preserve the rest.
      }
    }
  }

  /**
   * No-op for chat (no background work, no adapters). Defined so the
   * `HarnessType.onShutdown` hook has a concrete target.
   */
  async shutdown(): Promise<void> {
    /* nothing to release */
  }

  // ── Turns ──────────────────────────────────────────────────────────────

  /** Number of turns in the conversation. */
  get turnCount(): number {
    return this.turns.length;
  }

  /** Read-only view of the full conversation. */
  get conversation(): ReadonlyArray<ChatTurn> {
    return this.turns;
  }

  /** Last N turns (newest last) for prompt assembly / snapshot. */
  recent(limit: number): ChatTurn[] {
    if (limit >= this.turns.length) return this.turns.slice();
    return this.turns.slice(this.turns.length - limit);
  }

  /**
   * Append a turn; persists synchronously to JSONL before returning.
   * The dispatcher calls this at user-message arrival and at
   * assistant-response completion (or failure with `error` set).
   */
  async appendTurn(input: { role: ChatRole; content: string; runId?: string; error?: string }): Promise<ChatTurn> {
    const turn: ChatTurn = {
      id: `t-${Date.now()}-${nanoid()}`,
      role: input.role,
      content: input.content,
      ts: Date.now(),
      runId: input.runId,
      error: input.error,
    };
    this.turns.push(turn);
    await this.storage.appendLine(CONVERSATION_FILE, JSON.stringify(turn));
    return turn;
  }

  // ── State transitions ──────────────────────────────────────────────────

  /**
   * Acquire the `thinking` slot. Throws if another turn is already in
   * flight — the chat shape is intentionally single-flight; concurrent
   * turns belong to a separate chat harness.
   */
  beginThinking(): void {
    if (this.state !== "idle") {
      throw new Error(`chat busy: state=${this.state}`);
    }
    this.state = "thinking";
  }

  /** Release the slot, regardless of success or failure. */
  endThinking(): void {
    this.state = "idle";
  }
}
