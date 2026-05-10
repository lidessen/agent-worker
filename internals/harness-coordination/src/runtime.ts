// Per-Harness runtime for the multi-agent coordination type.
//
// `CoordinationRuntime` owns every piece of state that the coord
// flavor needs at runtime: the channel/inbox/status data stores, the
// channel bridge, the priority instruction queue, the agent roster
// (agentChannels + on-demand set + lead designation), and the
// channel-to-inbox routing logic. The substrate `Harness` class is
// type-agnostic and no longer holds any of this.
//
// `multiAgentCoordinationHarnessType.contributeRuntime` constructs
// an instance from the provided `HarnessConfig` + the substrate's
// shared `StorageBackend`; the substrate stashes it on
// `harness.typeRuntime`. Callers reach it through the typed accessor
// `coordinationRuntime(harness)` (see `./index.ts`).

import type {
  ChannelAdapter,
  HarnessConfig,
  Message,
  Priority,
  StorageBackend,
} from "@agent-worker/harness";
import { extractAddressedMentions } from "@agent-worker/harness";
import { ChannelStore } from "./stores/channel.ts";
import { InboxStore } from "./stores/inbox.ts";
import { StatusStore } from "./stores/status.ts";
import { ChannelBridge } from "./bridge.ts";
import { InstructionQueue } from "./priority-queue.ts";

export interface CoordinationRuntimeInput {
  config: HarnessConfig;
  storage: StorageBackend;
}

export class CoordinationRuntime {
  /** Fallback channel name when an agent is registered without an explicit channel list. */
  readonly defaultChannel: string;
  /** Optional team-lead agent name. Lead auto-joins every channel and gets fallback routing. */
  readonly lead: string | undefined;

  /** Persistent channel-message store; emits "message" events that drive routing. */
  readonly channelStore: ChannelStore;
  /** Per-agent inbox store. */
  readonly inboxStore: InboxStore;
  /** Per-agent status store. */
  readonly statusStore: StatusStore;
  /** Channel-event bridge connecting external adapters (Telegram, …) to channels. */
  readonly bridge: ChannelBridge;
  /** Priority instruction queue dispatched by the orchestrator. */
  readonly instructionQueue: InstructionQueue;

  /** Coord-shaped slices of `HarnessConfig` cached for `onInit`. */
  readonly agentsConfig: string[];
  readonly connectionsConfig: ChannelAdapter[];

  private readonly _agentChannels = new Map<string, Set<string>>();
  private readonly onDemandAgents: Set<string>;

  constructor(input: CoordinationRuntimeInput) {
    const { config, storage } = input;

    this.defaultChannel = config.defaultChannel ?? "general";
    this.lead = config.lead;
    this.onDemandAgents = new Set(config.onDemandAgents ?? []);
    this.agentsConfig = config.agents ?? [];
    this.connectionsConfig = config.connections ?? [];

    const channels = config.channels ?? [this.defaultChannel];
    this.channelStore = new ChannelStore(storage, channels);
    this.inboxStore = new InboxStore(storage);
    this.statusStore = new StatusStore(storage);
    this.bridge = new ChannelBridge(this.channelStore);
    this.instructionQueue = new InstructionQueue(config.queueConfig);

    // Wire channel events to inbox routing. The listener stays attached
    // for the runtime's lifetime; `shutdown` tears down the bridge but
    // the channel store's listeners are GC'd with the runtime instance.
    this.channelStore.on("message", (message) => {
      void this.routeMessageToInboxes(message);
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Load persisted state from storage and load inboxes for any agents
   * already registered in this runtime. Idempotent at the store level.
   * Called from `multiAgentCoordinationHarnessType.onInit` after the
   * substrate has finished its own setup.
   */
  async load(): Promise<void> {
    await this.statusStore.load();
    await this.channelStore.loadIndex();
    for (const name of this._agentChannels.keys()) {
      await this.inboxStore.load(name);
    }
  }

  /** Tear down the bridge (closes channel-store subscribers from adapters). */
  async shutdown(): Promise<void> {
    await this.bridge.shutdown();
  }

  // ── Agent roster ───────────────────────────────────────────────────────

  /** Whether the given agent name is the team lead. */
  isLead(name: string): boolean {
    return this.lead !== undefined && this.lead === name;
  }

  /** Whether an agent is registered in this runtime. */
  hasAgent(name: string): boolean {
    return this._agentChannels.has(name);
  }

  /** Get the set of channels an agent has joined (empty set when not registered). */
  getAgentChannels(name: string): Set<string> {
    return this._agentChannels.get(name) ?? new Set();
  }

  /** Read-only view of the agent → joined-channels map. */
  get agentChannels(): ReadonlyMap<string, ReadonlySet<string>> {
    return this._agentChannels;
  }

  /**
   * Register an agent with this runtime: join the requested channels
   * (or default + lead-all-channels), load the agent's persisted inbox,
   * and seed an idle status entry if none exists yet.
   */
  async registerAgent(name: string, channels?: string[]): Promise<void> {
    // Lead agents auto-join ALL channels (like external/debug users)
    const chs = this.isLead(name)
      ? this.channelStore.listChannels()
      : (channels ?? [this.defaultChannel]);
    this._agentChannels.set(name, new Set<string>(chs));

    await this.inboxStore.load(name);

    if (!this.statusStore.getCached(name)) {
      await this.statusStore.set(name, "idle");
    }
  }

  // ── Routing ────────────────────────────────────────────────────────────

  private async routeMessageToInboxes(message: Message): Promise<void> {
    // Only route "message" kind to inboxes (Invariant #12)
    if (message.kind && message.kind !== "message") return;

    // DMs: only route to recipient
    if (message.to) {
      await this.enqueueToAgent(message, message.to);
      return;
    }

    // Channel messages: route to agents who joined this channel.
    // *Addressed* mentions vs in-body references are distinguished:
    //   - "@maintainer Build X, then dispatch to @implementer" wakes
    //     only @maintainer; @implementer is a data reference.
    //   - "Hey @bob please review" still wakes @bob (no leading
    //     mentions → fall back to all mentions).
    // See extractAddressedMentions for the precise rule.
    const addressedNames = extractAddressedMentions(message.content).filter((m) =>
      this._agentChannels.has(m),
    );
    const hasAddressed = addressedNames.length > 0;
    for (const [agentName, channels] of this._agentChannels) {
      if (agentName === message.from) continue; // Don't self-deliver
      if (!channels.has(message.channel)) continue;

      const isAddressed = addressedNames.includes(agentName);
      // on_demand agents only wake when addressed; broadcasts and
      // body-only references never reach them.
      if (this.onDemandAgents.has(agentName) && !isAddressed) continue;

      // Addressed messages deliver only to their targets. Unaddressed
      // messages are broadcasts — still visible via channel_read, but
      // only the lead wakes (at normal priority, for user comms) and
      // other agents get a background inbox entry they may ignore.
      if (hasAddressed && !isAddressed) continue;

      const isLeadFallback = !hasAddressed && agentName === this.lead;
      await this.enqueueToAgent(
        message,
        agentName,
        isAddressed || isLeadFallback ? "normal" : "background",
      );
    }
  }

  private async enqueueToAgent(
    message: Message,
    agentName: string,
    priority?: Priority,
  ): Promise<void> {
    let p: Priority = priority ?? "normal";
    if (message.to === agentName) {
      p = "immediate"; // DM = immediate
    } else if (message.mentions.includes(agentName)) {
      p = "normal"; // @mention = normal
    }

    const hasEntry = await this.inboxStore.hasEntry(agentName, message.id);
    if (hasEntry) return; // Invariant #7: no duplicate delivery

    await this.inboxStore.enqueue(agentName, {
      messageId: message.id,
      channel: message.channel,
      from: message.from,
      preview: message.content.replace(/\n/g, " ").slice(0, 100),
      priority: p,
      state: "pending",
      enqueuedAt: new Date().toISOString(),
    });
  }
}
