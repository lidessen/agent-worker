// `MultiAgentCoordinationHarnessType` — the canonical concrete
// `HarnessType` for multi-agent coordination harnesses (channels,
// inbox, lead/worker routing, instruction queue, telegram bridge).
//
// This is the type that registers with the daemon's
// `HarnessTypeRegistry` at startup. Coord harness configs declare
// `harnessTypeId: "multi-agent-coordination"` to plug into it.
//
// Per design/decisions/006-harness-as-agent-environment.md, the
// substrate `Harness` class is type-agnostic; this type contributes
// every coord-flavored behavior via the `HarnessType` protocol's
// optional methods:
//
//   - `contributeRuntime` constructs the per-Harness
//     `CoordinationRuntime` that owns coord state (channel/inbox/
//     status stores, bridge, instruction queue, agent roster, lead
//     designation, defaultChannel, routing logic). The substrate
//     stashes it on `harness.typeRuntime`; callers reach it via the
//     `coordinationRuntime(harness)` typed accessor.
//   - `onInit` registers configured agents and starts configured
//     channel adapters; loads persisted store state.
//   - `onShutdown` tears down the bridge.
//   - `contributeMcpTools` returns the coord-flavored per-agent tool
//     set (channel_*, my_inbox*, no_action, my_status_set, team_*,
//     wait_inbox); substrate's `createHarnessTools` provides the
//     universal slice and `factory.buildAgentToolSet` merges the two.
//   - `snapshotExtension` returns the coord slice of
//     `HarnessStateSnapshot.typeExtensions["multi-agent-coordination"]`,
//     reading directly from the runtime.
//
// Future slice:
//   - `contributeContextSections` — `inboxSection` /
//     `responseGuidelines` (today imported by orchestrator
//     directly; future slice routes them through this hook).
//   - `parseConfig` — coord-shaped config (channels, lead, queue,
//     connections) projection from the raw `HarnessConfig`.

import type {
  AgentStatus,
  ContributeMcpToolsInput,
  ContributeRuntimeInput,
  HarnessConfig,
  HarnessToolHandler,
  HarnessType,
  InboxEntry,
  Instruction,
  OnInitInput,
  OnShutdownInput,
  SnapshotExtensionInput,
  StorageBackend,
  TimelineEvent,
  ToolDef,
} from "@agent-worker/harness";
import { CoordinationRuntime } from "./runtime.ts";
import { createCoordinationTools, COORDINATION_TOOL_DEFS } from "./mcp/server.ts";

/** Stable id used in `Handoff.extensions` and the registry. */
export const COORDINATION_HARNESS_TYPE_ID = "multi-agent-coordination" as const;

/**
 * Per-agent slice of the coord snapshot. Agents are coord-shaped (they
 * have channels and inboxes), so this lives here.
 */
export interface HarnessAgentSnapshot {
  name: string;
  status: AgentStatus;
  currentTask?: string;
  channels: string[];
  inbox: InboxEntry[];
  recentActivity: TimelineEvent[];
}

/**
 * Coord slice emitted under
 * `HarnessStateSnapshot.typeExtensions["multi-agent-coordination"]`.
 */
export interface CoordinationSnapshot {
  defaultChannel: string;
  channels: string[];
  queuedInstructions: Instruction[];
  agents: HarnessAgentSnapshot[];
}

/**
 * Shape of each item in `multiAgentCoordinationHarnessType.contributeMcpTools`'s
 * return value. The substrate's tool-merging boundary
 * (`factory.buildAgentToolSet`) iterates this list and inserts each
 * `{name, def, handler}` into the merged tool set + def map.
 */
export interface ContributedToolItem {
  name: string;
  def: ToolDef;
  handler: HarnessToolHandler;
}

/**
 * Shape the coord type expects from the substrate `Harness` instance
 * passed via `ContributeRuntimeInput.harness`. Kept narrow on purpose:
 * the type only reads what it needs to seed the runtime.
 */
interface CoordHostHarness {
  storage: StorageBackend;
  contextProvider: import("@agent-worker/harness").ContextProvider;
}

export const multiAgentCoordinationHarnessType: HarnessType<unknown, CoordinationRuntime> = {
  id: COORDINATION_HARNESS_TYPE_ID,
  label: "multi-agent coordination",

  contributeRuntime({ harness, config }: ContributeRuntimeInput): CoordinationRuntime {
    const h = harness as CoordHostHarness;
    return new CoordinationRuntime({
      config: config as HarnessConfig,
      storage: h.storage,
    });
  },

  async onInit({ runtime }: OnInitInput<CoordinationRuntime>): Promise<void> {
    if (!runtime) return;
    // Load persisted state (status / channel index / per-agent inboxes
    // for any agents already registered in this construction window).
    await runtime.load();
    // Register configured agents (each call also loads that agent's
    // inbox, so config-driven agents pick up their persisted entries).
    for (const name of runtime.agentsConfig) {
      await runtime.registerAgent(name);
    }
    // Attach configured channel adapters (telegram et al.) to the bridge.
    for (const adapter of runtime.connectionsConfig) {
      await runtime.bridge.addAdapter(adapter);
    }
  },

  async onShutdown({ runtime }: OnShutdownInput<CoordinationRuntime>): Promise<void> {
    if (!runtime) return;
    await runtime.shutdown();
  },

  contributeMcpTools({
    harness,
    runtime,
    agentName,
  }: ContributeMcpToolsInput<CoordinationRuntime>): ContributedToolItem[] {
    if (!runtime) return [];
    const h = harness as CoordHostHarness;
    const tools = createCoordinationTools({
      agentName,
      provider: h.contextProvider,
      agentChannels: runtime.getAgentChannels(agentName),
      lookupAgentChannels: (name) =>
        runtime.hasAgent(name) ? runtime.getAgentChannels(name) : undefined,
    });
    return Object.entries(tools).map(([name, handler]) => {
      const def = COORDINATION_TOOL_DEFS[name];
      if (!def) {
        throw new Error(`coord: missing COORDINATION_TOOL_DEFS entry for tool "${name}"`);
      }
      return { name, def, handler };
    });
  },

  async snapshotExtension({
    harness,
    runtime,
    opts,
  }: SnapshotExtensionInput<CoordinationRuntime>): Promise<CoordinationSnapshot | undefined> {
    if (!runtime) return undefined;
    const h = harness as CoordHostHarness;
    const inboxLimit = opts?.inboxLimit ?? 10;
    const timelineLimit = opts?.timelineLimit ?? 5;
    const queuedLimit = opts?.queuedLimit ?? 20;

    const channels = runtime.channelStore.listChannels();
    const queuedInstructions = runtime.instructionQueue.listAll().slice(-queuedLimit);

    const agentNames = [...runtime.agentChannels.keys()];
    const agents: HarnessAgentSnapshot[] = await Promise.all(
      agentNames.map(async (name): Promise<HarnessAgentSnapshot> => {
        const status = await h.contextProvider.status.get(name);
        const inbox = (await h.contextProvider.inbox.inspect(name)).slice(0, inboxLimit);
        const recentActivity = await h.contextProvider.timeline.read(name, {
          limit: timelineLimit,
        });
        return {
          name,
          status: status?.status ?? "idle",
          currentTask: status?.currentTask,
          channels: [...runtime.getAgentChannels(name)],
          inbox,
          recentActivity,
        };
      }),
    );

    return {
      defaultChannel: runtime.defaultChannel,
      channels,
      queuedInstructions,
      agents,
    };
  },
};
