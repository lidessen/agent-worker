// `@agent-worker/harness-coordination` — peer `HarnessType` package
// providing the multi-agent coordination flavor (channels, inboxes,
// status, bridge, instruction queue, lead routing, telegram adapter,
// channel/inbox/team MCP tools).
//
// Per design/decisions/006-harness-as-agent-environment.md, the
// substrate `Harness` class is type-agnostic; coordination state lives
// here and plugs into a Harness instance via the `HarnessType` protocol
// from `@agent-worker/harness`.

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

// ── HarnessType — coord ───────────────────────────────────────────────────
export {
  COORDINATION_HARNESS_TYPE_ID,
  multiAgentCoordinationHarnessType,
} from "./type.ts";
export type {
  ContributedToolItem,
  CoordHarnessTypeRuntime,
  CoordinationSnapshot,
  HarnessAgentSnapshot,
} from "./type.ts";
