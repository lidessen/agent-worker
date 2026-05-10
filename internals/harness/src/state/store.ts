// ── Harness state store interface ───────────────────────────────────────
//
// Defines the minimal contract for reading and writing the kernel state
// records: Task, Wake, Handoff. (Artifact is gone — concrete outputs live
// as Resources, referenced in Handoff.resources.)
//
// In-memory and file-backed implementations live here and in
// ./file-store.ts.

import type {
  CreateHandoffInput,
  CreateTaskInput,
  CreateWakeInput,
  Handoff,
  Task,
  TaskPatch,
  TaskStatus,
  Wake,
  WakePatch,
  WakeStatus,
} from "./types.ts";
import { TERMINAL_WAKE_STATUSES } from "./types.ts";

export interface TaskFilter {
  status?: TaskStatus[];
  ownerLeadId?: string;
}

/** Callback for Wake lifecycle events — see `HarnessStateStore.on`. */
export type WakeTerminalListener = (wake: Wake) => void | Promise<void>;

export interface HarnessStateStore {
  // ── Task ────────────────────────────────────────────────────────────
  createTask(input: CreateTaskInput): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  listTasks(filter?: TaskFilter): Promise<Task[]>;

  // ── Wake ────────────────────────────────────────────────────────────
  createWake(input: CreateWakeInput): Promise<Wake>;
  getWake(id: string): Promise<Wake | null>;
  updateWake(id: string, patch: WakePatch): Promise<Wake>;
  listWakes(taskId: string): Promise<Wake[]>;
  /**
   * Find the agent's current running Wake, if any. Used by the per-run
   * tool injector to closure Wake-scoped tools over the active Wake id.
   * Returns the oldest running Wake when there are multiple (there should
   * be at most one by invariant).
   */
  findActiveWake(agentName: string): Promise<Wake | null>;
  /**
   * All Wakes across all tasks. Used by harness init to collect the
   * unique set of worktree repo paths for crash recovery `pruneWorktrees`
   * scans.
   */
  listAllWakes(): Promise<Wake[]>;

  // ── Handoff ─────────────────────────────────────────────────────────
  createHandoff(input: CreateHandoffInput): Promise<Handoff>;
  getHandoff(id: string): Promise<Handoff | null>;
  listHandoffs(taskId: string): Promise<Handoff[]>;

  // ── Lifecycle events ────────────────────────────────────────────────
  /**
   * Subscribe to Wake lifecycle events. `wake.terminal` fires when
   * `updateWake` flips a running Wake to any terminal status
   * (`completed` / `failed` / `cancelled` / `handed_off`). Listeners are
   * called sequentially with the post-update Wake snapshot; exceptions are
   * logged and swallowed so one bad listener doesn't break the update.
   *
   * Returns an unsubscribe function.
   */
  on(event: "wake.terminal", listener: WakeTerminalListener): () => void;
}

// ── In-memory implementation ──────────────────────────────────────────────

function genId(prefix: string): string {
  // 12 hex chars of randomness is plenty for in-test uniqueness and still
  // short enough to read in logs.
  const rnd = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}_${rnd}`;
}

/**
 * Simple in-memory implementation suitable for tests and ephemeral runs.
 * Not safe for multi-process use. A file-backed store lives in file-store.ts.
 */
export class InMemoryHarnessStateStore implements HarnessStateStore {
  private tasks = new Map<string, Task>();
  private wakes = new Map<string, Wake>();
  private handoffs = new Map<string, Handoff>();
  /** `wake.terminal` listeners. */
  protected wakeTerminalListeners = new Set<WakeTerminalListener>();

  on(event: "wake.terminal", listener: WakeTerminalListener): () => void {
    if (event !== "wake.terminal") {
      throw new Error(`Unknown HarnessStateStore event: ${event}`);
    }
    this.wakeTerminalListeners.add(listener);
    return () => {
      this.wakeTerminalListeners.delete(listener);
    };
  }

  /**
   * Fire `wake.terminal` listeners sequentially. Errors are caught and
   * logged; listener faults must not break the triggering update path.
   */
  protected async emitWakeTerminal(wake: Wake): Promise<void> {
    for (const listener of this.wakeTerminalListeners) {
      try {
        await listener(wake);
      } catch (err) {
        console.error(
          `[state-store] wake.terminal listener failed for ${wake.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /**
   * Internal helper: detect a non-terminal → terminal status transition
   * between two snapshots of the same Wake.
   */
  protected isTerminalTransition(prev: WakeStatus, next: WakeStatus): boolean {
    const wasTerminal = (TERMINAL_WAKE_STATUSES as readonly WakeStatus[]).includes(prev);
    const isTerminal = (TERMINAL_WAKE_STATUSES as readonly WakeStatus[]).includes(next);
    return !wasTerminal && isTerminal;
  }

  // ── Task ────────────────────────────────────────────────────────────

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = Date.now();
    const task: Task = {
      id: genId("task"),
      harnessId: input.harnessId,
      title: input.title,
      goal: input.goal,
      status: input.status ?? "draft",
      priority: input.priority,
      ownerLeadId: input.ownerLeadId,
      sourceRefs: input.sourceRefs ?? [],
      acceptanceCriteria: input.acceptanceCriteria,
      createdAt: now,
      updatedAt: now,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    return this.tasks.get(id) ?? null;
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    const current = this.tasks.get(id);
    if (!current) throw new Error(`Task not found: ${id}`);
    const updated: Task = {
      ...current,
      ...patch,
      id: current.id,
      harnessId: current.harnessId,
      createdAt: current.createdAt,
      updatedAt: Date.now(),
    };
    this.tasks.set(id, updated);
    return updated;
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    let out = Array.from(this.tasks.values());
    if (filter?.status) {
      const allowed = new Set(filter.status);
      out = out.filter((t) => allowed.has(t.status));
    }
    if (filter?.ownerLeadId) {
      out = out.filter((t) => t.ownerLeadId === filter.ownerLeadId);
    }
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }

  // ── Wake ────────────────────────────────────────────────────────────

  async createWake(input: CreateWakeInput): Promise<Wake> {
    if (!this.tasks.has(input.taskId)) {
      throw new Error(`createWake: task not found: ${input.taskId}`);
    }
    const wake: Wake = {
      id: genId("wake"),
      taskId: input.taskId,
      agentName: input.agentName,
      role: input.role,
      status: input.status ?? "running",
      startedAt: Date.now(),
      inputHandoffId: input.inputHandoffId,
      runtimeType: input.runtimeType,
      sessionId: input.sessionId,
      cwd: input.cwd,
      pid: input.pid,
    };
    this.wakes.set(wake.id, wake);
    return wake;
  }

  async getWake(id: string): Promise<Wake | null> {
    return this.wakes.get(id) ?? null;
  }

  async updateWake(id: string, patch: WakePatch): Promise<Wake> {
    const current = this.wakes.get(id);
    if (!current) throw new Error(`Wake not found: ${id}`);
    const updated: Wake = {
      ...current,
      ...patch,
      id: current.id,
      taskId: current.taskId,
      startedAt: current.startedAt,
    };
    this.wakes.set(id, updated);

    if (
      patch.status !== undefined &&
      this.isTerminalTransition(current.status, updated.status)
    ) {
      await this.emitWakeTerminal(updated);
    }
    return updated;
  }

  async listWakes(taskId: string): Promise<Wake[]> {
    return Array.from(this.wakes.values())
      .filter((w) => w.taskId === taskId)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  async findActiveWake(agentName: string): Promise<Wake | null> {
    let best: Wake | null = null;
    for (const wake of this.wakes.values()) {
      if (wake.agentName !== agentName) continue;
      if (wake.status !== "running") continue;
      if (!best || wake.startedAt < best.startedAt) best = wake;
    }
    return best;
  }

  async listAllWakes(): Promise<Wake[]> {
    return Array.from(this.wakes.values()).sort((a, b) => a.startedAt - b.startedAt);
  }

  // ── Handoff ─────────────────────────────────────────────────────────

  async createHandoff(input: CreateHandoffInput): Promise<Handoff> {
    if (!this.tasks.has(input.taskId)) {
      throw new Error(`createHandoff: task not found: ${input.taskId}`);
    }
    if (!this.wakes.has(input.closingWakeId)) {
      throw new Error(`createHandoff: closingWake not found: ${input.closingWakeId}`);
    }
    const handoff: Handoff = {
      id: genId("hnd"),
      taskId: input.taskId,
      closingWakeId: input.closingWakeId,
      createdAt: Date.now(),
      createdBy: input.createdBy,
      kind: input.kind,
      summary: input.summary,
      completed: input.completed ?? [],
      pending: input.pending ?? [],
      blockers: input.blockers ?? [],
      decisions: input.decisions ?? [],
      resources: input.resources ?? [],
      workLogPointer: input.workLogPointer,
      extensions: input.extensions ?? {},
      harnessTypeId: input.harnessTypeId,
    };
    this.handoffs.set(handoff.id, handoff);
    return handoff;
  }

  async getHandoff(id: string): Promise<Handoff | null> {
    return this.handoffs.get(id) ?? null;
  }

  async listHandoffs(taskId: string): Promise<Handoff[]> {
    return Array.from(this.handoffs.values())
      .filter((h) => h.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
}
