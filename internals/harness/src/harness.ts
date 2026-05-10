import { join } from "node:path";
import type {
  HarnessConfig,
  HarnessRuntime,
  HarnessStateSnapshot,
  HarnessSubstrateSnapshot,
  ContextProvider,
  EventLog,
  StorageBackend,
} from "./types.ts";
import { DocumentStore } from "./context/stores/document.ts";
import { ResourceStore } from "./context/stores/resource.ts";
import { TimelineStore } from "./context/stores/timeline.ts";
import { ChronicleStore } from "./context/stores/chronicle.ts";
import { CompositeContextProvider } from "./context/provider.ts";
import { HarnessEventLog } from "./context/event-log.ts";
import { MemoryStorage } from "./context/storage.ts";
import {
  noopChannelStore,
  noopInboxStore,
  noopStatusStore,
} from "./context/stubs.ts";
import {
  FileHarnessStateStore,
  InMemoryHarnessStateStore,
  type HarnessStateStore,
} from "./state/index.ts";
import { pruneWorktrees } from "./worktree.ts";
import {
  createHarnessTypeRegistry,
  DEFAULT_HARNESS_TYPE_ID,
  type HarnessTypeRegistry,
  type HarnessTypeRuntime,
} from "./type/index.ts";

/**
 * Substrate Harness — the type-agnostic environment that wires shared
 * infrastructure (storage, document/resource/timeline/chronicle stores,
 * Task/Wake/Handoff state, worktree provisioning, sandbox paths) and
 * delegates every coord-flavored concern to the registered `HarnessType`.
 *
 * Coord-shaped state — channel/inbox/status data, the channel bridge,
 * the priority instruction queue, the agent roster, lead designation,
 * the default channel, and channel-to-inbox routing — lives in the
 * coord type's `CoordinationRuntime`. Reach it via the typed accessor
 * `coordinationRuntime(harness)` exported from
 * `@agent-worker/harness-coordination`.
 */
export class Harness implements HarnessRuntime {
  readonly name: string;
  readonly tag: string | undefined;
  readonly storageDir: string | undefined;
  /** Shared `StorageBackend`; coord runtime constructs its stores from it. */
  readonly storage: StorageBackend;
  private readonly _sandboxBaseDir: string | undefined;
  readonly contextProvider: ContextProvider;
  readonly eventLog: EventLog;
  /**
   * Kernel state store — Task / Wake / Handoff canonical records.
   * Substrate-owned: every HarnessType shares this surface.
   */
  readonly stateStore: HarnessStateStore;

  /**
   * The `HarnessType` id this Harness is plugged into. Fixed at
   * construction. Defaults to `DEFAULT_HARNESS_TYPE_ID`.
   */
  readonly harnessTypeId: string;

  /**
   * Process-scoped registry of `HarnessType`s. Owned by the daemon and
   * shared across every Harness; tests get a fresh per-construction
   * registry by default.
   */
  readonly harnessTypeRegistry: HarnessTypeRegistry;

  /**
   * Per-Harness runtime slot owned by the registered `HarnessType`. Whatever
   * the type's `contributeRuntime` returns at construction is stashed here
   * verbatim; the substrate never inspects it. Types expose typed accessors
   * (e.g. `coordinationRuntime(harness)`) for callers that need narrowed
   * access. `undefined` when the type contributes no per-Harness state.
   */
  readonly typeRuntime: HarnessTypeRuntime | undefined;

  private initialized = false;

  constructor(config: HarnessConfig, harnessTypeRegistry?: HarnessTypeRegistry) {
    this.name = config.name;
    this.tag = config.tag;
    this.storageDir = config.storageDir;
    this._sandboxBaseDir = config.sandboxBaseDir;
    this.harnessTypeId = config.harnessTypeId ?? DEFAULT_HARNESS_TYPE_ID;
    this.harnessTypeRegistry = harnessTypeRegistry ?? createHarnessTypeRegistry();

    // Substrate storage is built first because the type's
    // `contributeRuntime` may reads it via `harness.storage` to seed
    // its own stores (coord does this for channel/inbox/status).
    this.storage = config.storage ?? new MemoryStorage();

    // Substrate stores — universal across types.
    const documentStore = new DocumentStore(this.storage);
    const resourceStore = new ResourceStore(this.storage);
    const timelineStore = new TimelineStore(this.storage);
    const chronicleStore = new ChronicleStore(this.storage);

    // Resolve the type and let it contribute its per-Harness runtime.
    // For coord this constructs `CoordinationRuntime` (with its own
    // channel/inbox/status stores, bridge, and instruction queue);
    // for non-coord types `contributeRuntime` is absent and the slot
    // stays undefined. The provider below pulls coord-flavored stores
    // from the runtime when present, otherwise falls through to no-op
    // stubs whose methods reject so non-coord harnesses can't silently
    // route messages.
    const resolvedType = this.harnessTypeRegistry.resolve(this.harnessTypeId);
    this.typeRuntime = resolvedType.contributeRuntime
      ? resolvedType.contributeRuntime({ harness: this, config })
      : undefined;

    // Surface coord-flavored stores via the substrate provider when
    // the runtime exposes them. Duck-typed access keeps the substrate
    // layering clean (no import of the coord runtime class).
    const coordLike = this.typeRuntime as
      | {
          channelStore?: ContextProvider["channels"];
          inboxStore?: ContextProvider["inbox"];
          statusStore?: ContextProvider["status"];
        }
      | undefined;
    this.contextProvider = new CompositeContextProvider({
      channels: coordLike?.channelStore ?? noopChannelStore,
      inbox: coordLike?.inboxStore ?? noopInboxStore,
      status: coordLike?.statusStore ?? noopStatusStore,
      documents: documentStore,
      resources: resourceStore,
      timeline: timelineStore,
      chronicle: chronicleStore,
      lead: config.lead,
      maxMessageLength: config.maxMessageLength,
    });

    this.eventLog = new HarnessEventLog(timelineStore);

    // Kernel state store (Task / Wake / Handoff). File-backed when the
    // harness has a storage dir; in-memory otherwise.
    this.stateStore = this.storageDir
      ? new FileHarnessStateStore(join(this.storageDir, "state"))
      : new InMemoryHarnessStateStore();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

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

    // Run the type's `onInit` hook last so types can rely on substrate
    // state (state store, paths, kernel) being live. For coord this is
    // where store loading, configured-agent registration, and
    // adapter starting happen.
    const resolvedType = this.harnessTypeRegistry.resolve(this.harnessTypeId);
    if (resolvedType.onInit) {
      await resolvedType.onInit({ harness: this, runtime: this.typeRuntime });
    }

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
    // The type's `onShutdown` runs first so types can flush state /
    // close adapters (coord's runtime tears down its bridge here)
    // before substrate work would be torn down. Errors are caught
    // and logged but do not block — leaving sockets/processes around
    // is worse than a noisy log.
    const resolvedType = this.harnessTypeRegistry.resolve(this.harnessTypeId);
    if (resolvedType.onShutdown) {
      try {
        await resolvedType.onShutdown({ harness: this, runtime: this.typeRuntime });
      } catch (err) {
        console.error(
          `[harness ${this.name}] onShutdown failed for type "${resolvedType.id}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }
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
    const chronicleLimit = opts?.chronicleLimit ?? 10;

    const documents = await this.contextProvider.documents.list();
    const chronicle = await this.contextProvider.chronicle.read({ limit: chronicleLimit });

    const substrate: HarnessSubstrateSnapshot = {
      name: this.name,
      tag: this.tag,
      harnessTypeId: this.harnessTypeId,
      documents,
      chronicle,
    };

    // Per-type slice — populated by the registered type's
    // `snapshotExtension` if defined. Coord type emits channels /
    // inbox / queue / agents under its id.
    const typeExtensions: Record<string, unknown> = {};
    const resolvedType = this.harnessTypeRegistry.resolve(this.harnessTypeId);
    if (resolvedType.snapshotExtension) {
      const extension = await resolvedType.snapshotExtension({
        harness: this,
        runtime: this.typeRuntime,
        opts,
      });
      if (extension !== undefined) {
        typeExtensions[resolvedType.id] = extension;
      }
    }

    return { substrate, typeExtensions };
  }
}
