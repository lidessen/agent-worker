import { join } from "node:path";
import type {
  WorkspaceConfig,
  WorkspaceRuntime,
  WorkspaceStateSnapshot,
  ContextProvider,
  EventLog,
  ChannelBridgeInterface,
  InstructionQueueInterface,
  Message,
  Priority,
} from "./types.ts";
import { ChannelStore } from "./context/stores/channel.ts";
import { InboxStore } from "./context/stores/inbox.ts";
import { DocumentStore } from "./context/stores/document.ts";
import { ResourceStore } from "./context/stores/resource.ts";
import { StatusStore } from "./context/stores/status.ts";
import { TimelineStore } from "./context/stores/timeline.ts";
import { ChronicleStore } from "./context/stores/chronicle.ts";
import { CompositeContextProvider } from "./context/provider.ts";
import { WorkspaceEventLog } from "./context/event-log.ts";
import { ChannelBridge } from "./context/bridge.ts";
import { InstructionQueue } from "./loop/priority-queue.ts";
import { MemoryStorage } from "./context/storage.ts";

export class Workspace implements WorkspaceRuntime {
  readonly name: string;
  readonly tag: string | undefined;
  readonly defaultChannel: string;
  readonly storageDir: string | undefined;
  private readonly _sandboxBaseDir: string | undefined;
  readonly contextProvider: ContextProvider;
  readonly eventLog: EventLog;
  readonly bridge: ChannelBridgeInterface;
  readonly instructionQueue: InstructionQueueInterface;

  private readonly channelStore: ChannelStore;
  private readonly inboxStore: InboxStore;
  private readonly statusStore: StatusStore;
  private readonly bridgeImpl: ChannelBridge;
  private initialized = false;

  /** Agent name → set of joined channels. */
  private agentChannels = new Map<string, Set<string>>();

  /** Optional team lead agent name (gets debug tools + all-channel access). */
  readonly lead: string | undefined;

  /** Agents that only wake on @mention, not channel broadcasts. */
  private readonly _onDemandAgents: Set<string>;

  constructor(config: WorkspaceConfig) {
    this.name = config.name;
    this.tag = config.tag;
    this.lead = config.lead;
    this.defaultChannel = config.defaultChannel ?? "general";
    this._onDemandAgents = new Set(config.onDemandAgents ?? []);
    this.storageDir = config.storageDir;
    this._sandboxBaseDir = config.sandboxBaseDir;

    const storage = config.storage ?? new MemoryStorage();
    const channels = config.channels ?? [this.defaultChannel];

    // Create stores
    this.channelStore = new ChannelStore(storage, channels);
    this.inboxStore = new InboxStore(storage);
    const documentStore = new DocumentStore(storage);
    const resourceStore = new ResourceStore(storage);
    this.statusStore = new StatusStore(storage);
    const timelineStore = new TimelineStore(storage);
    const chronicleStore = new ChronicleStore(storage);

    // Composite provider
    this.contextProvider = new CompositeContextProvider({
      channels: this.channelStore,
      inbox: this.inboxStore,
      documents: documentStore,
      resources: resourceStore,
      status: this.statusStore,
      timeline: timelineStore,
      chronicle: chronicleStore,
      lead: config.lead,
      maxMessageLength: config.maxMessageLength,
    });

    // Event log
    this.eventLog = new WorkspaceEventLog(timelineStore);

    // Channel bridge
    this.bridgeImpl = new ChannelBridge(this.channelStore);
    this.bridge = this.bridgeImpl;

    // Instruction queue
    this.instructionQueue = new InstructionQueue(config.queueConfig);

    // Wire channel messages to inbox routing
    this.channelStore.on("message", (message) => {
      this.routeMessageToInboxes(message);
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    // Load status store
    await this.statusStore.load();

    // Load channel index
    await this.channelStore.loadIndex();

    // Load agent inboxes
    for (const agentName of this.agentChannels.keys()) {
      await this.inboxStore.load(agentName);
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    await this.bridgeImpl.shutdown();
  }

  /** Whether the given agent name is the team lead. */
  isLead(name: string): boolean {
    return this.lead !== undefined && this.lead === name;
  }

  async registerAgent(name: string, channels?: string[]): Promise<void> {
    // Lead agents auto-join ALL channels (like external/debug users)
    const chs = this.isLead(name)
      ? this.contextProvider.channels.listChannels()
      : (channels ?? [this.defaultChannel]);
    const agentChs = new Set<string>(chs);
    this.agentChannels.set(name, agentChs);

    if (this.initialized) {
      await this.inboxStore.load(name);
    }

    if (!this.statusStore.getCached(name)) {
      await this.statusStore.set(name, "idle");
    }
  }

  /** Whether an agent is registered in this workspace. */
  hasAgent(name: string): boolean {
    return this.agentChannels.has(name);
  }

  /** Get the set of channels an agent has joined. */
  getAgentChannels(name: string): Set<string> {
    return this.agentChannels.get(name) ?? new Set();
  }

  /** Get the shared workspace sandbox directory (collaborative files). */
  get workspaceSandboxDir(): string | undefined {
    const base = this._sandboxBaseDir ?? this.storageDir;
    if (!base) return undefined;
    return join(base, "sandbox");
  }

  /** Get the agent's sandbox directory (working directory for bash/files). */
  agentSandboxDir(agentName: string): string | undefined {
    const base = this._sandboxBaseDir ?? this.storageDir;
    if (!base) return undefined;
    return join(base, "agents", agentName, "sandbox");
  }

  async snapshotState(opts?: {
    inboxLimit?: number;
    timelineLimit?: number;
    chronicleLimit?: number;
    queuedLimit?: number;
  }): Promise<WorkspaceStateSnapshot> {
    const inboxLimit = opts?.inboxLimit ?? 10;
    const timelineLimit = opts?.timelineLimit ?? 5;
    const chronicleLimit = opts?.chronicleLimit ?? 10;
    const queuedLimit = opts?.queuedLimit ?? 20;

    const documents = await this.contextProvider.documents.list();
    const chronicle = await this.contextProvider.chronicle.read({ limit: chronicleLimit });
    const queuedInstructions = this.instructionQueue.listAll().slice(-queuedLimit);

    const agents = await Promise.all(
      [...this.agentChannels.keys()].map(async (name) => {
        const status = await this.contextProvider.status.get(name);
        const inbox = (await this.contextProvider.inbox.inspect(name)).slice(0, inboxLimit);
        const recentActivity = await this.contextProvider.timeline.read(name, { limit: timelineLimit });
        return {
          name,
          status: status?.status ?? "idle",
          currentTask: status?.currentTask,
          channels: [...this.getAgentChannels(name)],
          inbox,
          recentActivity,
        };
      }),
    );

    return {
      name: this.name,
      tag: this.tag,
      defaultChannel: this.defaultChannel,
      channels: this.contextProvider.channels.listChannels(),
      documents,
      chronicle,
      queuedInstructions,
      agents,
    };
  }

  // ── Internal routing ──────────────────────────────────────────────────

  private async routeMessageToInboxes(message: Message): Promise<void> {
    // Only route "message" kind to inboxes (Invariant #12)
    if (message.kind && message.kind !== "message") return;

    // DMs: only route to recipient
    if (message.to) {
      await this.enqueueToAgent(message, message.to);
      return;
    }

    // Channel messages: route to all agents who joined this channel
    // Check if any mentioned name is a registered agent (not just any @text in the message)
    const hasAgentMention = message.mentions.some((m) => this.agentChannels.has(m));
    for (const [agentName, channels] of this.agentChannels) {
      if (agentName === message.from) continue; // Don't self-deliver
      if (!channels.has(message.channel)) continue;

      const isMentioned = message.mentions.includes(agentName);
      // on_demand agents only wake on @mention, skip them on broadcasts
      if (this._onDemandAgents.has(agentName) && !isMentioned) continue;
      // Lead gets normal priority for unmentioned messages (responsible for user comms)
      const isLeadFallback = !hasAgentMention && agentName === this.lead;
      await this.enqueueToAgent(
        message,
        agentName,
        isMentioned || isLeadFallback ? "normal" : "background",
      );
    }
  }

  private async enqueueToAgent(
    message: Message,
    agentName: string,
    priority?: Priority,
  ): Promise<void> {
    // Determine priority
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
