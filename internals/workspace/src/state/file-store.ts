// ── File-backed workspace state store ─────────────────────────────────────
//
// Persists Task / Attempt / Handoff / Artifact snapshots as JSONL files in a
// dedicated directory. Reads on startup replay each file with
// last-write-wins semantics per id. Writes are append-only so a partial
// crash leaves the store in a replayable state.
//
// Not safe for multi-process use — the in-memory cache is owned by a single
// WorkspaceStateStore instance. Concurrent writes from the same process are
// serialised by the synchronous appendFileSync call.
//
// This implementation deliberately shares the happy path with the in-memory
// store: the mutations run against in-memory maps first (for invariants like
// FK checks and active-attempt mirroring), then append a full snapshot to
// disk. Reload re-executes the same mutations in order.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { appendJsonl, readFrom } from "@agent-worker/shared";
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
import type {
  AttemptTerminalListener,
  TaskFilter,
  WorkspaceStateStore,
} from "./store.ts";

const TASK_FILE = "tasks.jsonl";
const ATTEMPT_FILE = "attempts.jsonl";
const HANDOFF_FILE = "handoffs.jsonl";
const ARTIFACT_FILE = "artifacts.jsonl";

function genId(prefix: string): string {
  const rnd = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}_${rnd}`;
}

/**
 * File-backed implementation of WorkspaceStateStore.
 *
 * Each mutation writes a full snapshot to the appropriate JSONL file.
 * Replay reads all four files at construction time and rebuilds the
 * in-memory cache with last-write-wins semantics per id. Call
 * `await store.ready` before using the store if you care about seeing
 * the replay complete (Workspace can await this during init).
 */
export class FileWorkspaceStateStore implements WorkspaceStateStore {
  readonly dir: string;
  readonly ready: Promise<void>;

  private tasks = new Map<string, Task>();
  private attempts = new Map<string, Attempt>();
  private handoffs = new Map<string, Handoff>();
  private artifacts = new Map<string, Artifact>();
  private attemptTerminalListeners = new Set<AttemptTerminalListener>();

  private readonly taskPath: string;
  private readonly attemptPath: string;
  private readonly handoffPath: string;
  private readonly artifactPath: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.taskPath = join(dir, TASK_FILE);
    this.attemptPath = join(dir, ATTEMPT_FILE);
    this.handoffPath = join(dir, HANDOFF_FILE);
    this.artifactPath = join(dir, ARTIFACT_FILE);

    // Replay is async but the API is sync-friendly: anyone who needs to
    // guarantee it finished before reads can `await store.ready`.
    this.ready = this.replay();
  }

  private async replay(): Promise<void> {
    const [tasks, attempts, handoffs, artifacts] = await Promise.all([
      this.readSnapshots<Task>(this.taskPath),
      this.readSnapshots<Attempt>(this.attemptPath),
      this.readSnapshots<Handoff>(this.handoffPath),
      this.readSnapshots<Artifact>(this.artifactPath),
    ]);
    for (const t of tasks) this.tasks.set(t.id, t);
    for (const a of attempts) this.attempts.set(a.id, a);
    for (const h of handoffs) this.handoffs.set(h.id, h);
    for (const a of artifacts) this.artifacts.set(a.id, a);

    // Reconcile artifacts into their owning tasks' artifactRefs. Writing the
    // artifact row and the task row is two separate appendFileSync calls, so
    // a crash between them can leave artifacts.jsonl with an entry that
    // tasks.jsonl doesn't yet mirror. Patch the in-memory task so callers
    // see a consistent view; the artifact rows are authoritative.
    for (const artifact of this.artifacts.values()) {
      const task = this.tasks.get(artifact.taskId);
      if (!task) continue;
      if (!task.artifactRefs.includes(artifact.id)) {
        this.tasks.set(task.id, {
          ...task,
          artifactRefs: [...task.artifactRefs, artifact.id],
        });
      }
    }
  }

  private async readSnapshots<T extends { id: string }>(path: string): Promise<T[]> {
    const { data } = await readFrom(path, 0);
    if (!data) return [];
    // A crash during appendFileSync can leave the final line torn (partial
    // JSON or no trailing newline). Parse each line defensively so one bad
    // tail doesn't poison the whole replay and render the store unusable.
    const lines = data.split("\n").filter(Boolean);
    const latest = new Map<string, T>();
    for (const line of lines) {
      let entry: { ts?: number } & T;
      try {
        entry = JSON.parse(line) as { ts?: number } & T;
      } catch {
        // Swallow malformed lines. If this is the last line in the file, the
        // next successful append will extend past it with a clean newline.
        continue;
      }
      // Skip rows that don't look like snapshots (no id).
      if (!entry || typeof entry !== "object" || !("id" in entry) || typeof entry.id !== "string") {
        continue;
      }
      const { ts: _ts, ...rest } = entry;
      const snapshot = rest as unknown as T;
      latest.set(snapshot.id, snapshot);
    }
    return Array.from(latest.values());
  }

  private writeTask(task: Task): void {
    appendJsonl(this.taskPath, task as unknown as Record<string, unknown>);
  }
  private writeAttempt(attempt: Attempt): void {
    appendJsonl(this.attemptPath, attempt as unknown as Record<string, unknown>);
  }
  private writeHandoff(handoff: Handoff): void {
    appendJsonl(this.handoffPath, handoff as unknown as Record<string, unknown>);
  }
  private writeArtifact(artifact: Artifact): void {
    appendJsonl(this.artifactPath, artifact as unknown as Record<string, unknown>);
  }

  // ── Task ────────────────────────────────────────────────────────────

  async createTask(input: CreateTaskInput): Promise<Task> {
    await this.ready;
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
    this.writeTask(task);
    return task;
  }

  async getTask(id: string): Promise<Task | null> {
    await this.ready;
    return this.tasks.get(id) ?? null;
  }

  async updateTask(id: string, patch: TaskPatch): Promise<Task> {
    await this.ready;
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
    this.writeTask(updated);
    return updated;
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    await this.ready;
    let out = Array.from(this.tasks.values());
    if (filter?.status) {
      const allowed = new Set<TaskStatus>(filter.status);
      out = out.filter((t) => allowed.has(t.status));
    }
    if (filter?.ownerLeadId) {
      out = out.filter((t) => t.ownerLeadId === filter.ownerLeadId);
    }
    out.sort((a, b) => a.createdAt - b.createdAt);
    return out;
  }

  // ── Attempt ─────────────────────────────────────────────────────────

  async createAttempt(input: CreateAttemptInput): Promise<Attempt> {
    await this.ready;
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
    this.writeAttempt(attempt);
    return attempt;
  }

  async getAttempt(id: string): Promise<Attempt | null> {
    await this.ready;
    return this.attempts.get(id) ?? null;
  }

  async updateAttempt(id: string, patch: AttemptPatch): Promise<Attempt> {
    await this.ready;
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
    this.writeAttempt(updated);

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
    await this.ready;
    return Array.from(this.attempts.values())
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  async findActiveAttempt(agentName: string): Promise<Attempt | null> {
    await this.ready;
    let best: Attempt | null = null;
    for (const attempt of this.attempts.values()) {
      if (attempt.agentName !== agentName) continue;
      if (attempt.status !== "running") continue;
      if (!best || attempt.startedAt < best.startedAt) best = attempt;
    }
    return best;
  }

  async listAllAttempts(): Promise<Attempt[]> {
    await this.ready;
    return Array.from(this.attempts.values()).sort((a, b) => a.startedAt - b.startedAt);
  }

  // ── Lifecycle events ────────────────────────────────────────────────

  on(event: "attempt.terminal", listener: AttemptTerminalListener): () => void {
    if (event !== "attempt.terminal") {
      throw new Error(`Unknown WorkspaceStateStore event: ${event}`);
    }
    this.attemptTerminalListeners.add(listener);
    return () => {
      this.attemptTerminalListeners.delete(listener);
    };
  }

  private async emitAttemptTerminal(attempt: Attempt): Promise<void> {
    for (const listener of this.attemptTerminalListeners) {
      try {
        await listener(attempt);
      } catch (err) {
        console.error(
          `[file-state-store] attempt.terminal listener failed for ${attempt.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  private isTerminalTransition(prev: AttemptStatus, next: AttemptStatus): boolean {
    const wasTerminal = (TERMINAL_ATTEMPT_STATUSES as readonly AttemptStatus[]).includes(prev);
    const isTerminal = (TERMINAL_ATTEMPT_STATUSES as readonly AttemptStatus[]).includes(next);
    return !wasTerminal && isTerminal;
  }

  // ── Handoff ─────────────────────────────────────────────────────────

  async createHandoff(input: CreateHandoffInput): Promise<Handoff> {
    await this.ready;
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
    this.writeHandoff(handoff);
    return handoff;
  }

  async getHandoff(id: string): Promise<Handoff | null> {
    await this.ready;
    return this.handoffs.get(id) ?? null;
  }

  async listHandoffs(taskId: string): Promise<Handoff[]> {
    await this.ready;
    return Array.from(this.handoffs.values())
      .filter((h) => h.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // ── Artifact ────────────────────────────────────────────────────────

  async createArtifact(input: CreateArtifactInput): Promise<Artifact> {
    await this.ready;
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
    this.writeArtifact(artifact);

    // Mirror the artifact id into the task's artifactRefs + persist the
    // updated task snapshot so a replay sees the same cross-reference.
    const updatedTask: Task = {
      ...task,
      artifactRefs: [...task.artifactRefs, artifact.id],
      updatedAt: artifact.createdAt,
    };
    this.tasks.set(task.id, updatedTask);
    this.writeTask(updatedTask);

    return artifact;
  }

  async getArtifact(id: string): Promise<Artifact | null> {
    await this.ready;
    return this.artifacts.get(id) ?? null;
  }

  async listArtifacts(taskId: string): Promise<Artifact[]> {
    await this.ready;
    return Array.from(this.artifacts.values())
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }
}
