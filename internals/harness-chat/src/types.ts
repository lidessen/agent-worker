// Public types for the single-agent chat HarnessType.
//
// A chat is one user, one capable model, and one growing
// conversation. The `ChatRuntime` (defined in `./runtime.ts`) owns
// the conversation thread + a small idle/thinking state machine.
// HarnessConfig opts in via `harnessTypeId: "single-agent-chat"` plus
// an `agent` block describing the model + instructions.

/** Stable id used in `harnessTypeId` and the registry. */
export const SINGLE_AGENT_CHAT_HARNESS_TYPE_ID = "single-agent-chat" as const;

export type ChatRole = "user" | "assistant" | "system";

export interface ChatTurn {
  /** Stable id (timestamp + nanoid). */
  id: string;
  /** Role producing this turn. */
  role: ChatRole;
  /** Final content of the turn. Streaming chunks coalesce into this. */
  content: string;
  /** Millisecond timestamp at which the turn was committed. */
  ts: number;
  /** Optional run-id correlating to a daemon `agent.runtime_event` stream. */
  runId?: string;
  /**
   * Optional error message when an assistant turn ended in failure.
   * Persisted so the conversation transcript reflects what actually
   * happened rather than silently dropping the failed reply.
   */
  error?: string;
}

/**
 * Snapshot slice emitted under
 * `HarnessStateSnapshot.typeExtensions["single-agent-chat"]`.
 */
export interface ChatSnapshot {
  agentName: string;
  runtime: string;
  state: "idle" | "thinking";
  turnCount: number;
  /** Tail of the conversation, capped for diagnostics. */
  recent: ChatTurn[];
}

/**
 * Subset of `HarnessConfig` the chat type reads. Today
 * `HarnessConfig` doesn't include a first-class `agent` field
 * (coord uses `agents: string[]`); chat reads `(config as any).agent`
 * to keep the substrate config schema unchanged. A future config
 * cleanup may promote this to a typed field.
 */
export interface ChatHarnessAgentConfig {
  /** Display name for the agent in the conversation transcript. */
  name?: string;
  /** Runtime to dispatch through (claude-code | codex | cursor | ai-sdk | mock). */
  runtime?: string;
  /** Resolved model identifier; opaque to chat (passed through to the loop). */
  model?: { id: string; provider?: string; full: string };
  /** System prompt / instructions for the agent. */
  instructions?: string;
}
