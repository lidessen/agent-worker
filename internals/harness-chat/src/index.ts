// `@agent-worker/harness-chat` — peer `HarnessType` package
// providing the single-agent chat flavor: one agent, one
// conversation thread, idle/thinking state machine. No coord-flavored
// state.
//
// Per design/decisions/008-single-agent-chat-harness-type.md, this
// type plugs into the universal `Harness` substrate via the
// `HarnessType` protocol from `@agent-worker/harness`.

import type { Harness } from "@agent-worker/harness";
import { ChatRuntime } from "./runtime.ts";
import { SINGLE_AGENT_CHAT_HARNESS_TYPE_ID } from "./types.ts";

// ── Per-Harness runtime (canonical owner of chat state) ─────────────────
export { ChatRuntime } from "./runtime.ts";
export type { ChatRuntimeInput } from "./runtime.ts";

// ── HarnessType — chat ──────────────────────────────────────────────────
export {
  SINGLE_AGENT_CHAT_HARNESS_TYPE_ID,
  singleAgentChatHarnessType,
} from "./type.ts";
export type {
  ChatHarnessAgentConfig,
  ChatRole,
  ChatSnapshot,
  ChatTurn,
} from "./types.ts";

// ── Typed accessor ─────────────────────────────────────────────────────────

/**
 * Narrow the substrate Harness's opaque `typeRuntime` slot to the
 * concrete `ChatRuntime`. Throws when the harness is plugged into a
 * different type — chat-flavored callers depend on this state
 * unconditionally, so wrong-type access is a programmer error worth
 * surfacing loudly. Mirrors `coordinationRuntime` from the coord
 * package.
 */
export function chatRuntime(harness: Harness): ChatRuntime {
  if (harness.harnessTypeId !== SINGLE_AGENT_CHAT_HARNESS_TYPE_ID) {
    throw new Error(
      `chatRuntime: harness "${harness.name}" is plugged into type ` +
        `"${harness.harnessTypeId}", not "${SINGLE_AGENT_CHAT_HARNESS_TYPE_ID}".`,
    );
  }
  const rt = harness.typeRuntime;
  if (!(rt instanceof ChatRuntime)) {
    throw new Error(
      `chatRuntime: harness "${harness.name}" is missing its ChatRuntime — ` +
        `was singleAgentChatHarnessType registered before construction?`,
    );
  }
  return rt;
}
