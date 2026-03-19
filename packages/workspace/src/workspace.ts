import { join } from "node:path";
import type {
  WorkspaceConfig,
  WorkspaceRuntime,
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
  readonly contextProvider: ContextProvider;
  readonly eventLog: EventLog;
  readonly bridge: ChannelBridgeInterface;
  readonly instructionQueue: InstructionQueueInterface;

  private readonly channelStore: ChannelStore;
  private readonly inboxStore: InboxStore;
  private readonly statusStore: StatusStore;
  private readonly bridgeImpl: ChannelBridge;

  /** Agent name → set of joined channels. */
  private agentChannels = new Map<string, Set<string>>();

  constructor(config: WorkspaceConfig) {
    this.name = config.name;
    this.tag = config.tag;
    this.defaultChannel = config.defaultChannel ?? "general";
    this.storageDir = config.storageDir;

    const storage = config.storage ?? new MemoryStorage();
    const channels = config.channels ?? [this.defaultChannel];

    // Create stores
    this.channelStore = new ChannelStore(storage, channels);
    this.inboxStore = new InboxStore(storage);
    const documentStore = new DocumentStore(storage);
    const resourceStore = new ResourceStore(storage);
    this.statusStore = new StatusStore(storage);
    const timelineStore = new TimelineStore(storage);

    // Composite provider
    this.contextProvider = new CompositeContextProvider({
      channels: this.channelStore,
      inbox: this.inboxStore,
      documents: documentStore,
      resources: resourceStore,
      status: this.statusStore,
      timeline: timelineStore,
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
    // Load status store
    await this.statusStore.load();

    // Load channel index
    await this.channelStore.loadIndex();

    // Load agent inboxes
    for (const agentName of this.agentChannels.keys()) {
      await this.inboxStore.load(agentName);
    }
  }

  async shutdown(): Promise<void> {
    await this.bridgeImpl.shutdown();
  }

  async registerAgent(name: string, channels?: string[]): Promise<void> {
    const agentChs = new Set<string>(channels ?? [this.defaultChannel]);
    this.agentChannels.set(name, agentChs);

    await this.statusStore.set(name, "idle");
    await this.inboxStore.markRunStart(name);
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
    if (!this.storageDir) return undefined;
    return join(this.storageDir, "sandbox");
  }

  /** Get the agent's sandbox directory (working directory for bash/files). */
  agentSandboxDir(agentName: string): string | undefined {
    if (!this.storageDir) return undefined;
    return join(this.storageDir, "agents", agentName, "sandbox");
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
    for (const [agentName, channels] of this.agentChannels) {
      if (agentName === message.from) continue; // Don't self-deliver
      if (!channels.has(message.channel)) continue;

      // Check if agent is mentioned or if this is a channel broadcast
      const isMentioned = message.mentions.includes(agentName);
      await this.enqueueToAgent(message, agentName, isMentioned ? "normal" : "background");
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
      priority: p,
      state: "pending",
      enqueuedAt: new Date().toISOString(),
    });
  }
}
