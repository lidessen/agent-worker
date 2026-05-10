// ── File-backed harness state store ─────────────────────────────────────
//
// Persists Task, Wake, and Handoff snapshots as JSONL files in a dedicated
// directory. Reads on startup replay each file with last-write-wins
// semantics per id. Writes are append-only so a partial crash leaves the
// store in a replayable state.
//
// Not safe for multi-process use — the in-memory cache is owned by a single
// HarnessStateStore instance. Concurrent writes from the same process are
// serialised by the synchronous appendFileSync call.

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { appendJsonl, readFrom } from "@agent-worker/shared";
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
import type {
  TaskFilter,
  WakeTerminalListener,
  HarnessStateStore,
} from "./store.ts";

const TASK_FILE = "tasks.jsonl";
const WAKE_FILE = "wakes.jsonl";
const HANDOFF_FILE = "handoffs.jsonl";

function genId(prefix: string): string {
  const rnd = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}_${rnd}`;
}

/**
 * File-backed implementation of HarnessStateStore.
 *
 * Each mutation writes a full snapshot to the appropriate JSONL file.
 * Replay reads all three files at construction time and rebuilds the
 * in-memory cache with last-write-wins semantics per id. Call
 * `await store.ready` before using the store if you care about seeing the
 * replay complete (Harness can await this during init).
 */
export class FileHarnessStateStore implements HarnessStateStore {
  readonly dir: string;
  readonly ready: Promise<void>;

  private tasks = new Map<string, Task>();
  private wakes = new Map<string, Wake>();
  private handoffs = new Map<string, Handoff>();
  private wakeTerminalListeners = new Set<WakeTerminalListener>();

  private readonly taskPath: string;
  private readonly wakePath: string;
  private readonly handoffPath: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.taskPath = join(dir, TASK_FILE);
    this.wakePath = join(dir, WAKE_FILE);
    this.handoffPath = join(dir, HANDOFF_FILE);
    this.ready = this.replay();
  }

  private async replay(): Promise<void> {
    const [tasks, wakes, handoffs] = await Promise.all([
      this.readSnapshots<Task>(this.taskPath),
      this.readSnapshots<Wake>(this.wakePath),
      this.readSnapshots<Handoff>(this.handoffPath),
    ]);
    for (const t of tasks) this.tasks.set(t.id, t);
    for (const w of wakes) this.wakes.set(w.id, w);
    for (const h of handoffs) this.handoffs.set(h.id, h);
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
        continue;
      }
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
  private writeWake(wake: Wake): void {
    appendJsonl(this.wakePath, wake as unknown as Record<string, unknown>);
  }
  private writeHandoff(handoff: Handoff): void {
    appendJsonl(this.handoffPath, handoff as unknown as Record<string, unknown>);
  }

  // ── Task ────────────────────────────────────────────────────────────

  async createTask(input: CreateTaskInput): Promise<Task> {
    await this.ready;
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
      harnessId: current.harnessId,
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

  // ── Wake ────────────────────────────────────────────────────────────

  async createWake(input: CreateWakeInput): Promise<Wake> {
    await this.ready;
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
    this.writeWake(wake);
    return wake;
  }

  async getWake(id: string): Promise<Wake | null> {
    await this.ready;
    return this.wakes.get(id) ?? null;
  }

  async updateWake(id: string, patch: WakePatch): Promise<Wake> {
    await this.ready;
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
    this.writeWake(updated);

    if (
      patch.status !== undefined &&
      this.isTerminalTransition(current.status, updated.status)
    ) {
      await this.emitWakeTerminal(updated);
    }
    return updated;
  }

  async listWakes(taskId: string): Promise<Wake[]> {
    await this.ready;
    return Array.from(this.wakes.values())
      .filter((w) => w.taskId === taskId)
      .sort((a, b) => a.startedAt - b.startedAt);
  }

  async findActiveWake(agentName: string): Promise<Wake | null> {
    await this.ready;
    let best: Wake | null = null;
    for (const wake of this.wakes.values()) {
      if (wake.agentName !== agentName) continue;
      if (wake.status !== "running") continue;
      if (!best || wake.startedAt < best.startedAt) best = wake;
    }
    return best;
  }

  async listAllWakes(): Promise<Wake[]> {
    await this.ready;
    return Array.from(this.wakes.values()).sort((a, b) => a.startedAt - b.startedAt);
  }

  // ── Lifecycle events ────────────────────────────────────────────────

  on(event: "wake.terminal", listener: WakeTerminalListener): () => void {
    if (event !== "wake.terminal") {
      throw new Error(`Unknown HarnessStateStore event: ${event}`);
    }
    this.wakeTerminalListeners.add(listener);
    return () => {
      this.wakeTerminalListeners.delete(listener);
    };
  }

  private async emitWakeTerminal(wake: Wake): Promise<void> {
    for (const listener of this.wakeTerminalListeners) {
      try {
        await listener(wake);
      } catch (err) {
        console.error(
          `[file-state-store] wake.terminal listener failed for ${wake.id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  private isTerminalTransition(prev: WakeStatus, next: WakeStatus): boolean {
    const wasTerminal = (TERMINAL_WAKE_STATUSES as readonly WakeStatus[]).includes(prev);
    const isTerminal = (TERMINAL_WAKE_STATUSES as readonly WakeStatus[]).includes(next);
    return !wasTerminal && isTerminal;
  }

  // ── Handoff ─────────────────────────────────────────────────────────

  async createHandoff(input: CreateHandoffInput): Promise<Handoff> {
    await this.ready;
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
}
