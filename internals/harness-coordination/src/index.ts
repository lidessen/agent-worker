// `@agent-worker/harness-coordination` — peer `HarnessType` package
// providing the multi-agent coordination flavor (channels, inboxes,
// status, bridge, instruction queue, lead routing, telegram adapter,
// channel/inbox/team MCP tools).
//
// Per design/decisions/006-harness-as-agent-environment.md, the
// substrate `Harness` class is type-agnostic; every coord-flavored
// piece of state and behavior lives here. A coord-typed Harness reaches
// its runtime via the typed accessor `coordinationRuntime(harness)`.

import type { Harness } from "@agent-worker/harness";
import { CoordinationRuntime } from "./runtime.ts";
import { COORDINATION_HARNESS_TYPE_ID } from "./type.ts";

// ── Stores ─────────────────────────────────────────────────────────────────
export { ChannelStore } from "./stores/channel.ts";
export { InboxStore } from "./stores/inbox.ts";
export { StatusStore } from "./stores/status.ts";

// ── Bridge ─────────────────────────────────────────────────────────────────
export { ChannelBridge } from "./bridge.ts";

// ── Instruction Queue ─────────────────────────────────────────────────────
export { InstructionQueue } from "./priority-queue.ts";

// ── Lead lifecycle hooks ──────────────────────────────────────────────────
export { buildLeadHooks } from "./lead-hooks.ts";
export type { BuildLeadHooksOptions } from "./lead-hooks.ts";

// ── Telegram adapter ──────────────────────────────────────────────────────
export { TelegramAdapter, runTelegramAuth } from "./adapters/telegram.ts";
export type { TelegramAdapterConfig, AuthResult } from "./adapters/telegram.ts";

// ── Prompt sections ────────────────────────────────────────────────────────
export {
  inboxSection,
  responseGuidelines,
  COORDINATION_BASE_SECTIONS,
} from "./prompt.tsx";

// ── MCP tools (coord-flavored) ────────────────────────────────────────────
export { createCoordinationTools, COORDINATION_TOOL_DEFS } from "./mcp/server.ts";
export type { CoordinationToolsContext } from "./mcp/server.ts";
export { createChannelTools } from "./mcp/channel.ts";
export { createInboxTools } from "./mcp/inbox.ts";
export { createTeamTools } from "./mcp/team.ts";

// ── Per-Harness runtime (canonical owner of coord state) ─────────────────
export { CoordinationRuntime } from "./runtime.ts";
export type { CoordinationRuntimeInput } from "./runtime.ts";

// ── HarnessType — coord ───────────────────────────────────────────────────
export {
  COORDINATION_HARNESS_TYPE_ID,
  multiAgentCoordinationHarnessType,
} from "./type.ts";
export type {
  ContributedToolItem,
  CoordinationSnapshot,
  HarnessAgentSnapshot,
} from "./type.ts";

// ── Typed accessor ─────────────────────────────────────────────────────────

/**
 * Narrow the substrate Harness's opaque `typeRuntime` slot to the
 * concrete `CoordinationRuntime`. Throws when the harness is plugged
 * into a different type — coord-flavored callers depend on this state
 * unconditionally, so a wrong-type access is a programmer error worth
 * surfacing loudly.
 */
export function coordinationRuntime(harness: Harness): CoordinationRuntime {
  if (harness.harnessTypeId !== COORDINATION_HARNESS_TYPE_ID) {
    throw new Error(
      `coordinationRuntime: harness "${harness.name}" is plugged into type ` +
        `"${harness.harnessTypeId}", not "${COORDINATION_HARNESS_TYPE_ID}".`,
    );
  }
  const rt = harness.typeRuntime;
  if (!(rt instanceof CoordinationRuntime)) {
    throw new Error(
      `coordinationRuntime: harness "${harness.name}" is missing its CoordinationRuntime — ` +
        `was multiAgentCoordinationHarnessType registered before construction?`,
    );
  }
  return rt;
}
