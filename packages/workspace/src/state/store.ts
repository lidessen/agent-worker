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
  CreateArtifactInput,
  CreateAttemptInput,
  CreateHandoffInput,
  CreateTaskInput,
  Handoff,
  Task,
  TaskPatch,
  TaskStatus,
} from "./types.ts";

export interface TaskFilter {
  status?: TaskStatus[];
  ownerLeadId?: string;
}

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

  // ── Handoff ─────────────────────────────────────────────────────────
  createHandoff(input: CreateHandoffInput): Promise<Handoff>;
  getHandoff(id: string): Promise<Handoff | null>;
  listHandoffs(taskId: string): Promise<Handoff[]>;

  // ── Artifact ────────────────────────────────────────────────────────
  createArtifact(input: CreateArtifactInput): Promise<Artifact>;
  getArtifact(id: string): Promise<Artifact | null>;
  listArtifacts(taskId: string): Promise<Artifact[]>;
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
      worktreePath: input.worktreePath,
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
    return updated;
  }

  async listAttempts(taskId: string): Promise<Attempt[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => a.startedAt - b.startedAt);
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
