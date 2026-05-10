// Substrate MCP tool builder and tool-definition catalog.
//
// `createHarnessTools` returns the universal tool slice that every
// HarnessType inherits: resource_*, chronicle_*, task_* / wake_* /
// handoff_* (gated on a state store), and worktree_* (gated on an
// active Wake). Coord-flavored tools (channel_*, my_inbox*,
// no_action, my_status_set, team_*, wait_inbox) are contributed by
// `multiAgentCoordinationHarnessType` via `contributeMcpTools` and
// merged at the per-agent boundary by `factory.createAgentTools` /
// the per-agent MCP server.
//
// `HARNESS_TOOL_DEFS` is the static def catalog mirroring the
// substrate slice; coord exports `COORDINATION_TOOL_DEFS` for the
// rest. Stdio-entry / MCP server registration merge both at use
// site.

import type { ContextProvider, InstructionQueueInterface } from "../../types.ts";
import type { HarnessStateStore } from "../../state/index.ts";
import type { HarnessTypeRegistry } from "../../type/index.ts";
import { createResourceTools } from "./resource.ts";
import { createTaskTools, TASK_TOOL_DEFS } from "./task.ts";
import { createWakeTools, WAKE_TOOL_DEFS } from "./wake-tools.ts";

/** Handler function for a single MCP tool — receives args, returns the text result. */
export type HarnessToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface HarnessToolSet {
  [name: string]: HarnessToolHandler;
}

/**
 * Tool-definition metadata shared between substrate's
 * `HARNESS_TOOL_DEFS` and any `HarnessType`'s contributed tool
 * catalog (e.g. coord's `COORDINATION_TOOL_DEFS`). Used by MCP
 * server registration and the stdio-entry catalog.
 */
export interface ToolDef {
  description: string;
  parameters: Record<string, { type: string; description?: string }>;
  required: readonly string[];
}

export interface HarnessToolsOptions {
  stateStore?: HarnessStateStore;
  /** Harness name — used as the `harnessId` when creating tasks. */
  harnessName?: string;
  /** Harness key (`name` or `name:tag`) — used by Wake-scoped tools for
   *  filesystem path layout. Defaults to `harnessName`. */
  harnessKey?: string;
  /** Daemon data directory — root of `harness-data/`. Required to enable
   *  Wake-scoped tools (worktree_*). */
  dataDir?: string;
  /** Instruction queue — enables task_dispatch when present. */
  instructionQueue?: InstructionQueueInterface;
  /**
   * The active Wake for this agent at tool-injection time. When set,
   * Wake-scoped tools (worktree_*) are added to the returned tool set,
   * closure-bound to this Wake id. The orchestrator computes this per-run
   * via `stateStore.findActiveWake(agentName)`. Undefined → no worktree
   * tools (the agent is between dispatches).
   */
  activeWakeId?: string;
  /** HarnessType registry consulted by `handoff_create`. */
  harnessTypeRegistry?: HarnessTypeRegistry;
  /** HarnessType id this Harness is plugged into. Defaults to "default". */
  harnessTypeId?: string;
}

/**
 * Build the substrate-universal tool slice for a given agent.
 * Coord-flavored tools (channels / inbox / team) are contributed
 * separately by the registered `HarnessType` and merged at the
 * boundary; this function does not inspect the type.
 */
export function createHarnessTools(
  agentName: string,
  provider: ContextProvider,
  options: HarnessToolsOptions = {},
): HarnessToolSet {
  const resourceTools = createResourceTools(agentName, provider);
  const taskTools =
    options.stateStore && options.harnessName
      ? createTaskTools(agentName, options.harnessName, options.stateStore, {
          instructionQueue: options.instructionQueue,
          chronicle: provider.chronicle,
          harnessTypeRegistry: options.harnessTypeRegistry,
          harnessTypeId: options.harnessTypeId,
        })
      : null;
  // Wake-scoped tools are present iff the orchestrator passed an active
  // Wake id AND the registry passed dataDir + harnessKey. Tool factory
  // closures over the Wake id so every call inside this run targets the
  // same Wake.
  const wakeTools =
    options.stateStore && options.dataDir && options.activeWakeId
      ? createWakeTools(agentName, options.activeWakeId, {
          stateStore: options.stateStore,
          harnessKey: options.harnessKey ?? options.harnessName ?? "default",
          dataDir: options.dataDir,
        })
      : null;

  return {
    // Resource tools
    resource_create: (args) =>
      resourceTools.resource_create(args as Parameters<typeof resourceTools.resource_create>[0]),
    resource_read: (args) =>
      resourceTools.resource_read(args as Parameters<typeof resourceTools.resource_read>[0]),

    // Chronicle tools
    chronicle_append: async (args) => {
      const { category, content } = args as { category: string; content: string };
      const entry = await provider.chronicle.append({ author: agentName, category, content });
      return `Chronicle entry recorded: ${entry.id}`;
    },
    chronicle_read: async (args) => {
      const { limit, category } = args as { limit?: number; category?: string };
      const entries = await provider.chronicle.read({ limit, category });
      if (entries.length === 0) return "No chronicle entries.";
      return entries
        .map((e) => `[${e.timestamp}] ${e.category} (@${e.author}): ${e.content}`)
        .join("\n");
    },

    // Task ledger tools (Phase 2b/3a — only present when a state store is wired)
    ...(taskTools
      ? {
          task_create: (args) =>
            taskTools.task_create(args as Parameters<typeof taskTools.task_create>[0]),
          task_list: (args) =>
            taskTools.task_list(args as Parameters<typeof taskTools.task_list>[0]),
          task_get: (args) => taskTools.task_get(args as Parameters<typeof taskTools.task_get>[0]),
          task_update: (args) =>
            taskTools.task_update(args as Parameters<typeof taskTools.task_update>[0]),
          wake_create: (args) =>
            taskTools.wake_create(args as Parameters<typeof taskTools.wake_create>[0]),
          wake_list: (args) =>
            taskTools.wake_list(args as Parameters<typeof taskTools.wake_list>[0]),
          wake_get: (args) => taskTools.wake_get(args as Parameters<typeof taskTools.wake_get>[0]),
          wake_update: (args) =>
            taskTools.wake_update(args as Parameters<typeof taskTools.wake_update>[0]),
          handoff_create: (args) =>
            taskTools.handoff_create(args as Parameters<typeof taskTools.handoff_create>[0]),
          handoff_list: (args) =>
            taskTools.handoff_list(args as Parameters<typeof taskTools.handoff_list>[0]),
          task_dispatch: (args) =>
            taskTools.task_dispatch(args as Parameters<typeof taskTools.task_dispatch>[0]),
        }
      : {}),

    // Wake-scoped tools — only present when the orchestrator has bound
    // this tool set to an active Wake. Workers between dispatches don't
    // see them, which matches the "tools have a lifecycle scope" mental
    // model.
    ...(wakeTools
      ? {
          worktree_create: (args) =>
            wakeTools.worktree_create(args as Parameters<typeof wakeTools.worktree_create>[0]),
          worktree_list: () => wakeTools.worktree_list(),
          worktree_remove: (args) =>
            wakeTools.worktree_remove(args as Parameters<typeof wakeTools.worktree_remove>[0]),
        }
      : {}),
  };
}

/** Substrate tool-definition catalog. Merged with type-contributed
 *  defs (e.g. `COORDINATION_TOOL_DEFS`) at the consumer boundary. */
export const HARNESS_TOOL_DEFS: Record<string, ToolDef> = {
  resource_create: {
    description: "Create a resource for large content",
    parameters: {
      content: { type: "string", description: "Content to store" },
    },
    required: ["content"],
  },
  resource_read: {
    description: "Read a resource by ID. Use this to retrieve content stored via resource_create.",
    parameters: {
      id: { type: "string", description: "Resource ID" },
    },
    required: ["id"],
  },
  chronicle_append: {
    description:
      "Record an observation to the team chronicle — an append-only log of decisions, plans, " +
      "corrections, patterns, milestones, and insights. Unlike team_doc (editable shared docs), " +
      "chronicle entries are immutable and ordered by time.",
    parameters: {
      category: {
        type: "string",
        description:
          "Entry category: decision, plan, task, correction, pattern, milestone, or insight",
      },
      content: { type: "string", description: "Observation content" },
    },
    required: ["category", "content"],
  },
  chronicle_read: {
    description:
      "Read entries from the team chronicle, optionally filtered by category or limited to recent entries.",
    parameters: {
      limit: { type: "number", description: "Max entries to return (most recent)" },
      category: { type: "string", description: "Filter by category" },
    },
    required: [],
  },
  ...TASK_TOOL_DEFS,
  ...WAKE_TOOL_DEFS,
};
