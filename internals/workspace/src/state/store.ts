// ── Workspace state store interface ───────────────────────────────────────
//
// Defines the minimal contract for reading and writing kernel state
// objects (Task / Attempt / Handoff / Artifact). In-memory and file-backed
// implementations live under ./stores/.
//
// This module has no orchestration wiring — it is the persistence seam that
// Phase 2 lead intake and Phase 3 worker attempt lifecycle will consume.

import type {
  Artifact,
  Attempt,
  AttemptPatch,
  AttemptStatus,
  CreateArtifactInput,
  CreateAttemptInput,
  CreateHandoffInput,
  CreateTaskInput,
  Handoff,
  Task,
  TaskPatch,
  TaskStatus,
} from "./types.ts";
import { TERMINAL_ATTEMPT_STATUSES } from "./types.ts";

export interface TaskFilter {
  status?: TaskStatus[];
  ownerLeadId?: string;
}

/** Callback for attempt lifecycle events — see `WorkspaceStateStore.on`. */
export type AttemptTerminalListener = (attempt: Attempt) => void | Promise<void>;

export interface WorkspaceStateStore {
  // ── Task ────────────────────────────────────────────────────────────
  createTask(input: CreateTaskInput): Promise<Task>;
  getTask(id: string): Promise<Task | null>;
  updateTask(id: string, patch: TaskPatch): Promise<Task>;
  listTasks(filter?: TaskFilter): Promise<Task[]>;

  // ── Attempt ─────────────────────────────────────────────────────────
  createAttempt(input: CreateAttemptInput): Promise<Attempt>;
  getAttempt(id: string): Promise<Attempt | null>;
  updateAttempt(id: string, patch: AttemptPatch): Promise<Attempt>;
  listAttempts(taskId: string): Promise<Attempt[]>;
  /**
   * Find the agent's current running Attempt, if any. Used by the
   * per-run tool injector to closure attempt-scoped tools over the
   * active attempt id. Returns the oldest running attempt when
   * there are multiple (there should be at most one by
   * invariant).
   */
  findActiveAttempt(agentName: string): Promise<Attempt | null>;
  /**
   * All attempts across all tasks. Used by workspace init to
   * collect the unique set of worktree repo paths for crash
   * recovery `pruneWorktrees` scans.
   */
  listAllAttempts(): Promise<Attempt[]>;

  // ── Handoff ─────────────────────────────────────────────────────────
  createHandoff(input: CreateHandoffInput): Promise<Handoff>;
  getHandoff(id: string): Promise<Handoff | null>;
  listHandoffs(taskId: string): Promise<Handoff[]>;

  // ── Artifact ────────────────────────────────────────────────────────
  createArtifact(input: CreateArtifactInput): Promise<Artifact>;
  getArtifact(id: string): Promise<Artifact | null>;
  listArtifacts(taskId: string): Promise<Artifact[]>;

  // ── Lifecycle events ────────────────────────────────────────────────
  /**
   * Subscribe to attempt lifecycle events. `attempt.terminal`
   * fires when `updateAttempt` flips a running attempt to any
   * terminal status (`completed` / `failed` / `cancelled` /
   * `handed_off`). Listeners are called sequentially with the
   * post-update attempt snapshot; exceptions are logged and
   * swallowed so one bad listener doesn't break the update.
   *
   * Returns an unsubscribe function.
   */
  on(event: "attempt.terminal", listener: AttemptTerminalListener): () => void;
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
 * Not safe for multi-process use. A file-backed store arrives in a later PR.
 */
export class InMemoryWorkspaceStateStore implements WorkspaceStateStore {
  private tasks = new Map<string, Task>();
  private attempts = new Map<string, Attempt>();
  private handoffs = new Map<string, Handoff>();
  private artifacts = new Map<string, Artifact>();
  /** `attempt.terminal` listeners. */
  protected attemptTerminalListeners = new Set<AttemptTerminalListener>();

  on(event: "attempt.terminal", listener: AttemptTerminalListener): () => void {
    if (event !== "attempt.terminal") {
      throw new Error(`Unknown WorkspaceStateStore event: ${event}`);
    }
    this.attemptTerminalListeners.add(listener);
    return () => {
      this.attemptTerminalListeners.delete(listener);
    };
  }

  /**
   * Fire `attempt.terminal` listeners sequentially. Errors are
   * caught and logged; listener faults must not break the
   * triggering update path.
   */
  protected async emitAttemptTerminal(attempt: Attempt): Promise<void> {
    for (const listener of this.attemptTerminalListeners) {
      try {
        await listener(attempt);
      } catch (err) {
        console.error(
          `[state-store] attempt.terminal listener failed for ${attempt.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  /**
   * Internal helper: detect a non-terminal → terminal status
   * transition between two snapshots of the same attempt.
   */
  protected isTerminalTransition(prev: AttemptStatus, next: AttemptStatus): boolean {
    const wasTerminal = (TERMINAL_ATTEMPT_STATUSES as readonly AttemptStatus[]).includes(prev);
    const isTerminal = (TERMINAL_ATTEMPT_STATUSES as readonly AttemptStatus[]).includes(next);
    return !wasTerminal && isTerminal;
  }

  // ── Task ────────────────────────────────────────────────────────────

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = Date.now();
    const task: Task = {
      id: genId("task"),
      workspaceId: input.workspaceId,
      title: input.title,
      goal: input.goal,
      status: input.status ?? "draft",
      priority: input.priority,
      ownerLeadId: input.ownerLeadId,
      sourceRefs: input.sourceRefs ?? [],
      acceptanceCriteria: input.acceptanceCriteria,
      artifactRefs: [],
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
      workspaceId: current.workspaceId,
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
    // Stable order: creation time ascending.
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }

  // ── Attempt ─────────────────────────────────────────────────────────

  async createAttempt(input: CreateAttemptInput): Promise<Attempt> {
    if (!this.tasks.has(input.taskId)) {
      throw new Error(`createAttempt: task not found: ${input.taskId}`);
    }
    const attempt: Attempt = {
      id: genId("att"),
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
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  async getAttempt(id: string): Promise<Attempt | null> {
    return this.attempts.get(id) ?? null;
  }

  async updateAttempt(id: string, patch: AttemptPatch): Promise<Attempt> {
    const current = this.attempts.get(id);
    if (!current) throw new Error(`Attempt not found: ${id}`);
    const updated: Attempt = {
      ...current,
      ...patch,
      id: current.id,
      taskId: current.taskId,
      startedAt: current.startedAt,
    };
    this.attempts.set(id, updated);

    // Phase-1 v3: fire attempt.terminal on running → terminal
    // status transition so cleanup hooks (worktree teardown,
    // chronicle entry, etc.) can react without polling.
    if (
      patch.status !== undefined &&
      this.isTerminalTransition(current.status, updated.status)
    ) {
      await this.emitAttemptTerminal(updated);
    }
    return updated;
  }

  async listAttempts(taskId: string): Promise<Attempt[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  async findActiveAttempt(agentName: string): Promise<Attempt | null> {
    let best: Attempt | null = null;
    for (const attempt of this.attempts.values()) {
      if (attempt.agentName !== agentName) continue;
      if (attempt.status !== "running") continue;
      if (!best || attempt.startedAt < best.startedAt) best = attempt;
    }
    return best;
  }

  async listAllAttempts(): Promise<Attempt[]> {
    return Array.from(this.attempts.values()).sort((a, b) => a.startedAt - b.startedAt);
  }

  // ── Handoff ─────────────────────────────────────────────────────────

  async createHandoff(input: CreateHandoffInput): Promise<Handoff> {
    if (!this.tasks.has(input.taskId)) {
      throw new Error(`createHandoff: task not found: ${input.taskId}`);
    }
    if (!this.attempts.has(input.fromAttemptId)) {
      throw new Error(`createHandoff: fromAttempt not found: ${input.fromAttemptId}`);
    }
    const handoff: Handoff = {
      id: genId("hnd"),
      taskId: input.taskId,
      fromAttemptId: input.fromAttemptId,
      toAttemptId: input.toAttemptId,
      createdAt: Date.now(),
      createdBy: input.createdBy,
      kind: input.kind,
      summary: input.summary,
      completed: input.completed ?? [],
      pending: input.pending ?? [],
      blockers: input.blockers ?? [],
      decisions: input.decisions ?? [],
      nextSteps: input.nextSteps ?? [],
      artifactRefs: input.artifactRefs ?? [],
      touchedPaths: input.touchedPaths,
      runtimeRefs: input.runtimeRefs,
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

  // ── Artifact ────────────────────────────────────────────────────────

  async createArtifact(input: CreateArtifactInput): Promise<Artifact> {
    const task = this.tasks.get(input.taskId);
    if (!task) throw new Error(`createArtifact: task not found: ${input.taskId}`);

    const artifact: Artifact = {
      id: genId("art"),
      taskId: input.taskId,
      kind: input.kind,
      title: input.title,
      ref: input.ref,
      createdByAttemptId: input.createdByAttemptId,
      createdAt: Date.now(),
      checksum: input.checksum,
      version: input.version,
    };
    this.artifacts.set(artifact.id, artifact);

    // Mirror the artifact id into the task's artifactRefs for quick lookup.
    task.artifactRefs = [...task.artifactRefs, artifact.id];
    task.updatedAt = artifact.createdAt;
    this.tasks.set(task.id, task);

    return artifact;
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    return this.artifacts.get(id) ?? null;
  }

  async listArtifacts(taskId: string): Promise<Artifact[]> {
    return Array.from(this.artifacts.values())
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
}
