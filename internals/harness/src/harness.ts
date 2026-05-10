import { join } from "node:path";
import type {
  HarnessConfig,
  HarnessRuntime,
  HarnessStateSnapshot,
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
import { HarnessEventLog } from "./context/event-log.ts";
import { ChannelBridge } from "./context/bridge.ts";
import { InstructionQueue } from "./loop/priority-queue.ts";
import { MemoryStorage } from "./context/storage.ts";
import {
  FileHarnessStateStore,
  InMemoryHarnessStateStore,
  type HarnessStateStore,
} from "./state/index.ts";
import { extractAddressedMentions } from "./utils.ts";
import { pruneWorktrees } from "./worktree.ts";
import {
  createHarnessTypeRegistry,
  DEFAULT_HARNESS_TYPE_ID,
  runProduceExtension,
  type HarnessTypeRegistry,
} from "./type/index.ts";

export class Harness implements HarnessRuntime {
  readonly name: string;
  readonly tag: string | undefined;
  readonly defaultChannel: string;
  readonly storageDir: string | undefined;
  private readonly _sandboxBaseDir: string | undefined;
  readonly contextProvider: ContextProvider;
  readonly eventLog: EventLog;
  readonly bridge: ChannelBridgeInterface;
  readonly instructionQueue: InstructionQueueInterface;
  /**
   * Kernel state store — Task / Wake / Handoff canonical records.
   * Phase 1 wires this in as an in-memory store; a file-backed
   * implementation will arrive with the persistence work.
   */
  readonly stateStore: HarnessStateStore;

  /**
   * The `HarnessType` id this Harness is plugged into. Fixed at
   * construction. Defaults to `DEFAULT_HARNESS_TYPE_ID`. Slice 1 ships
   * with only the default no-op registered.
   */
  readonly harnessTypeId: string;

  /**
   * Process-scoped registry of `HarnessType`s. Owned by the daemon and
   * shared across every Harness; tests get a fresh per-construction
   * registry by default.
   */
  readonly harnessTypeRegistry: HarnessTypeRegistry;

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

  constructor(config: HarnessConfig, harnessTypeRegistry?: HarnessTypeRegistry) {
    this.name = config.name;
    this.tag = config.tag;
    this.lead = config.lead;
    this.defaultChannel = config.defaultChannel ?? "general";
    this._onDemandAgents = new Set(config.onDemandAgents ?? []);
    this.storageDir = config.storageDir;
    this._sandboxBaseDir = config.sandboxBaseDir;
    this.harnessTypeId = config.harnessTypeId ?? DEFAULT_HARNESS_TYPE_ID;
    this.harnessTypeRegistry = harnessTypeRegistry ?? createHarnessTypeRegistry();

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
    this.eventLog = new HarnessEventLog(timelineStore);

    // Channel bridge
    this.bridgeImpl = new ChannelBridge(this.channelStore);
    this.bridge = this.bridgeImpl;

    // Instruction queue
    this.instructionQueue = new InstructionQueue(config.queueConfig);

    // Kernel state store (Task / Wake / Handoff).
    // File-backed when the harness has a storage dir; in-memory otherwise.
    this.stateStore = this.storageDir
      ? new FileHarnessStateStore(join(this.storageDir, "state"))
      : new InMemoryHarnessStateStore();

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

    // Best-effort worktree prune across every distinct repo any Wake has
    // touched. Crash recovery: a worktree dir nuked out from under git
    // leaves a dangling ref; pruning clears those before orphan recovery's
    // terminal-event listener tries to remove the (already gone)
    // directory. Run BEFORE recoverOrphanedWakes so the cleanup path sees
    // a tidy git state. The set comes from the state store itself, not
    // from any harness-level config.
    await this.pruneOrphanWorktreeRefs();

    // Recover orphaned Wakes. If the state store was replayed from disk
    // and still has Wakes marked "running", the process that owned them
    // is gone — mark them as failed so a future dispatch isn't
    // permanently blocked by a stale active-Wake pointer. The terminal
    // transition fires `wake.terminal` which the harness registry has
    // already subscribed to for worktree cleanup.
    await this.recoverOrphanedWakes();

    this.initialized = true;
  }

  /**
   * Walk every Wake's worktrees, collect the unique source repo paths, and
   * run `pruneWorktrees` on each. Best-effort — each failure is logged but
   * doesn't block init.
   */
  private async pruneOrphanWorktreeRefs(): Promise<void> {
    let wakes: Awaited<ReturnType<typeof this.stateStore.listAllWakes>>;
    try {
      wakes = await this.stateStore.listAllWakes();
    } catch (err) {
      console.error(
        `[harness ${this.name}] could not list Wakes for worktree prune:`,
        err instanceof Error ? err.message : err,
      );
      return;
    }
    const repos = new Set<string>();
    for (const wake of wakes) {
      for (const wt of wake.worktrees ?? []) {
        repos.add(wt.repoPath);
      }
    }
    for (const repoPath of repos) {
      try {
        await pruneWorktrees(repoPath);
      } catch (err) {
        console.error(
          `[harness ${this.name}] worktree prune failed for ${repoPath}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /**
   * Scan the kernel state store for Wakes that are still marked "running"
   * at harness init time. These are orphaned by definition (no live
   * runtime could possibly be holding them — the process that was running
   * them died before it could stamp a terminal status).
   *
   * For each orphan:
   *   1. Mark the Wake as failed with an endedAt timestamp and a systemic
   *      resultSummary.
   *   2. Clear the owning task's activeWakeId so re-dispatch works.
   *   3. Record a `kind: "aborted"` handoff from "system" explaining that
   *      the Wake was orphaned.
   *   4. Append a chronicle entry under the "recovery" category.
   *
   * Best-effort: individual failures are logged but do not block init.
   */
  private async recoverOrphanedWakes(): Promise<void> {
    let recovered: string[] = [];
    try {
      const tasks = await this.stateStore.listTasks();
      for (const task of tasks) {
        const wakes = await this.stateStore.listWakes(task.id);
        for (const wake of wakes) {
          if (wake.status !== "running") continue;
          const summary = "orphaned by harness restart — marked failed on init";
          try {
            await this.stateStore.updateWake(wake.id, {
              status: "failed",
              endedAt: Date.now(),
              resultSummary: summary,
            });
            if (task.activeWakeId === wake.id) {
              await this.stateStore.updateTask(task.id, { activeWakeId: undefined });
            }
            // Orphan recovery uses the default no-op type — there's no
            // running Wake to extract harness-type-specific state from.
            await this.stateStore.createHandoff({
              taskId: task.id,
              closingWakeId: wake.id,
              createdBy: "system",
              kind: "aborted",
              summary,
              blockers: ["process restart"],
              harnessTypeId: DEFAULT_HARNESS_TYPE_ID,
            });
            recovered.push(wake.id);
          } catch (err) {
            console.error(
              `[harness ${this.name}] orphan recovery failed for Wake ${wake.id}:`,
              err,
            );
          }
        }
      }
    } catch (err) {
      console.error(`[harness ${this.name}] orphan recovery scan failed:`, err);
      return;
    }

    if (recovered.length === 0) return;

    // Chronicle entry so the human-readable timeline shows the recovery.
    try {
      await this.contextProvider.chronicle.append({
        author: "system",
        category: "recovery",
        content: `Marked ${recovered.length} orphaned Wake(s) as failed on harness restart: ${recovered.join(", ")}`,
      });
    } catch {
      // Chronicle is observational; a failure here is non-fatal.
    }
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

  /** Whether an agent is registered in this harness. */
  hasAgent(name: string): boolean {
    return this.agentChannels.has(name);
  }

  /** Get the set of channels an agent has joined. */
  getAgentChannels(name: string): Set<string> {
    return this.agentChannels.get(name) ?? new Set();
  }

  /** Get the shared harness sandbox directory (collaborative files). */
  get harnessSandboxDir(): string | undefined {
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
  }): Promise<HarnessStateSnapshot> {
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
        const recentActivity = await this.contextProvider.timeline.read(name, {
          limit: timelineLimit,
        });
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

    // Channel messages: route to agents who joined this channel.
    // We distinguish *addressed* mentions from in-body references:
    //   - "@maintainer Build X, then dispatch to @implementer" should
    //     only wake @maintainer. @implementer is a data reference.
    //   - "Hey @bob please review" still wakes @bob (no leading
    //     mentions → fall back to all mentions).
    // See extractAddressedMentions for the precise rule.
    const addressedNames = extractAddressedMentions(message.content).filter((m) =>
      this.agentChannels.has(m),
    );
    const hasAddressed = addressedNames.length > 0;
    for (const [agentName, channels] of this.agentChannels) {
      if (agentName === message.from) continue; // Don't self-deliver
      if (!channels.has(message.channel)) continue;

      const isAddressed = addressedNames.includes(agentName);
      // on_demand agents only wake when addressed; broadcasts and
      // body-only references never reach them.
      if (this._onDemandAgents.has(agentName) && !isAddressed) continue;

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
