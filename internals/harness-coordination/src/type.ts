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
// the coord-flavored behavior via the `HarnessType` protocol's
// optional methods.
//
// Current scope:
//   - `contributeRuntime` stashes the coord-shaped slices of
//     `HarnessConfig` (`agents`, `connections`) so `onInit` can act on
//     them without re-reading config.
//   - `onInit` registers configured agents and starts configured
//     channel adapters (telegram et al.) on the substrate Harness.
//     `factory.createHarness` no longer orchestrates these steps.
//   - `snapshotExtension` returns the coord slice of
//     `HarnessStateSnapshot.typeExtensions["multi-agent-coordination"]`,
//     reading from the substrate `Harness` instance's still-attached
//     coord state via type cast.
//
// Future slices fill in:
//   - Move coord state fields/methods out of substrate `Harness` into
//     the coord runtime (the heavy ~290-caller ownership cut).
//   - `contributeMcpTools` — channel/inbox/team/wait_inbox MCP tools.
//   - `contributeContextSections` — `inboxSection` /
//     `responseGuidelines` (today imported by orchestrator
//     directly; future slice routes them through this hook).
//   - `parseConfig` — coord-shaped config (channels, lead, queue,
//     connections) projection from the raw `HarnessConfig`.

import type {
  AgentStatus,
  ChannelAdapter,
  ChannelBridgeInterface,
  ContributeRuntimeInput,
  HarnessConfig,
  HarnessType,
  InboxEntry,
  Instruction,
  OnInitInput,
  SnapshotExtensionInput,
  TimelineEvent,
} from "@agent-worker/harness";

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
 * Per-Harness runtime slot for the coord type, populated by
 * `contributeRuntime` at construction. Holds the slices of
 * `HarnessConfig` that `onInit` needs to act on (`agents` to register
 * and `connections` to attach to the bridge). The substrate Harness
 * stashes this verbatim on `harness.typeRuntime` and never inspects
 * it; the type's lifecycle hooks are the only readers.
 *
 * After the full ownership cut, this also owns the channel/inbox/
 * status stores, bridge, and instruction queue — today those still
 * live on substrate Harness.
 */
export interface CoordHarnessTypeRuntime {
  agents: string[];
  connections: ChannelAdapter[];
}

/**
 * Substrate `Harness` shape this type currently reads from. The full
 * cut moves the fields below into the coord runtime; for now they
 * still live on substrate, accessed by type cast at the boundary.
 * Kept narrow on purpose — only the parts the lifecycle hooks need.
 */
interface CoordHarnessLike {
  defaultChannel: string;
  instructionQueue: { listAll(): Instruction[] };
  contextProvider: {
    channels: { listChannels(): string[] };
    inbox: { inspect(name: string): Promise<InboxEntry[]> };
    status: { get(name: string): Promise<{ status: AgentStatus; currentTask?: string } | null> };
    timeline: { read(name: string, opts?: { limit?: number }): Promise<TimelineEvent[]> };
  };
  getAgentChannels(name: string): Set<string>;
  registerAgent(name: string, channels?: string[]): Promise<void>;
  bridge: ChannelBridgeInterface;
  // Iterating this private-ish map is the cleanest way to enumerate
  // the agents this Harness knows about today; the cut moves
  // ownership entirely to coord and removes the cross-package access.
  ["agentChannels"]: Map<string, Set<string>>;
}

export const multiAgentCoordinationHarnessType: HarnessType<unknown, CoordHarnessTypeRuntime> = {
  id: COORDINATION_HARNESS_TYPE_ID,
  label: "multi-agent coordination",

  contributeRuntime({ config }: ContributeRuntimeInput): CoordHarnessTypeRuntime {
    const c = config as HarnessConfig;
    return {
      agents: c.agents ?? [],
      connections: c.connections ?? [],
    };
  },

  async onInit({ harness, runtime }: OnInitInput<CoordHarnessTypeRuntime>): Promise<void> {
    if (!runtime) return;
    const h = harness as CoordHarnessLike;
    for (const name of runtime.agents) {
      await h.registerAgent(name);
    }
    for (const adapter of runtime.connections) {
      await h.bridge.addAdapter(adapter);
    }
  },

  async snapshotExtension({ harness, opts }: SnapshotExtensionInput<CoordHarnessTypeRuntime>): Promise<CoordinationSnapshot> {
    const h = harness as CoordHarnessLike;
    const inboxLimit = opts?.inboxLimit ?? 10;
    const timelineLimit = opts?.timelineLimit ?? 5;
    const queuedLimit = opts?.queuedLimit ?? 20;

    const channels = h.contextProvider.channels.listChannels();
    const queuedInstructions = h.instructionQueue.listAll().slice(-queuedLimit);

    const agents: HarnessAgentSnapshot[] = await Promise.all(
      [...h.agentChannels.keys()].map(async (name): Promise<HarnessAgentSnapshot> => {
        const status = await h.contextProvider.status.get(name);
        const inbox = (await h.contextProvider.inbox.inspect(name)).slice(0, inboxLimit);
        const recentActivity = await h.contextProvider.timeline.read(name, { limit: timelineLimit });
        return {
          name,
          status: status?.status ?? "idle",
          currentTask: status?.currentTask,
          channels: [...h.getAgentChannels(name)],
          inbox,
          recentActivity,
        };
      }),
    );

    return {
      defaultChannel: h.defaultChannel,
      channels,
      queuedInstructions,
      agents,
    };
  },
};
