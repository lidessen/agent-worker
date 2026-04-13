// ── Lead lifecycle hooks ──────────────────────────────────────────────────
//
// Builds an AgentLifecycleHooks bundle for a workspace lead that uses
// onCheckpoint to inject task-ledger deltas between runs. The lead sees
// a fresh "what changed" view each time it wakes without having to call
// task_list manually.
//
// Shape: close over the state store + workspace id; snapshot the active
// task list at each run_start; at the next run_start, diff against the
// previous snapshot and inject the changes as a structured system note.
//
// Keeping this a pure function (buildLeadHooks) means it can be wired in
// from the orchestration layer at registerAgent time without the workspace
// package pulling in the agent package.

import type { Handoff, Task, TaskStatus, WorkspaceStateStore } from "../state/index.ts";

/** Subset of the Agent type we need — keep this file decoupled from @agent-worker/agent. */
interface MinimalAgentHooks {
  onCheckpoint?: (ctx: {
    reason: "run_start" | "run_end" | "event";
    runNumber: number;
  }) => Promise<LeadCheckpointAction | void> | LeadCheckpointAction | void;
}

type LeadCheckpointAction = { kind: "noop" } | { kind: "inject"; content: string };

/** The subset of Task fields we track for delta detection. */
interface TaskSnapshot {
  id: string;
  title: string;
  status: TaskStatus;
  activeAttemptId?: string;
  updatedAt: number;
}

const ACTIVE_STATUSES: TaskStatus[] = ["draft", "open", "in_progress", "blocked"];

function snapshotTask(task: Task): TaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    activeAttemptId: task.activeAttemptId,
    updatedAt: task.updatedAt,
  };
}

function diffSnapshots(
  prev: Map<string, TaskSnapshot>,
  next: Map<string, TaskSnapshot>,
): {
  added: TaskSnapshot[];
  removed: TaskSnapshot[];
  statusChanged: Array<{ from: TaskStatus; to: TaskStatus; snapshot: TaskSnapshot }>;
  activeAttemptChanged: TaskSnapshot[];
} {
  const added: TaskSnapshot[] = [];
  const removed: TaskSnapshot[] = [];
  const statusChanged: Array<{ from: TaskStatus; to: TaskStatus; snapshot: TaskSnapshot }> = [];
  const activeAttemptChanged: TaskSnapshot[] = [];

  for (const [id, curr] of next) {
    const before = prev.get(id);
    if (!before) {
      added.push(curr);
      continue;
    }
    if (before.status !== curr.status) {
      statusChanged.push({ from: before.status, to: curr.status, snapshot: curr });
    } else if (before.activeAttemptId !== curr.activeAttemptId) {
      activeAttemptChanged.push(curr);
    }
  }
  for (const [id, before] of prev) {
    if (!next.has(id)) removed.push(before);
  }

  return { added, removed, statusChanged, activeAttemptChanged };
}

function formatDelta(
  diff: ReturnType<typeof diffSnapshots>,
  newHandoffs: Handoff[],
): string | null {
  const lines: string[] = [];
  if (diff.added.length > 0) {
    lines.push("**New tasks:**");
    for (const t of diff.added) lines.push(`- [${t.id}] ${t.title} [${t.status}]`);
  }
  if (diff.statusChanged.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Status changes:**");
    for (const entry of diff.statusChanged) {
      lines.push(`- [${entry.snapshot.id}] ${entry.snapshot.title}: ${entry.from} → ${entry.to}`);
    }
  }
  if (diff.activeAttemptChanged.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Active attempt changes:**");
    for (const t of diff.activeAttemptChanged) {
      const attemptDesc = t.activeAttemptId ? `now ${t.activeAttemptId}` : "cleared";
      lines.push(`- [${t.id}] ${t.title}: ${attemptDesc}`);
    }
  }
  if (diff.removed.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Removed tasks:**");
    for (const t of diff.removed) lines.push(`- [${t.id}] ${t.title}`);
  }
  if (newHandoffs.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**New handoffs:**");
    for (const h of newHandoffs) {
      const header = `- [${h.id}] ${h.kind} from ${h.createdBy} on task ${h.taskId}`;
      lines.push(header);
      lines.push(`  summary: ${h.summary}`);
      if (h.blockers.length > 0) {
        lines.push(`  blockers: ${h.blockers.join("; ")}`);
      }
      if (h.nextSteps.length > 0) {
        lines.push(`  next: ${h.nextSteps.join("; ")}`);
      }
    }
  }
  if (lines.length === 0) return null;
  return [
    "[task-ledger delta since your last run]",
    ...lines,
    "",
    "Call `task_list` for the full current state if anything above needs deeper inspection.",
  ].join("\n");
}

export interface BuildLeadHooksOptions {
  /** Filter the tracked set to only these statuses. Defaults to all active statuses. */
  trackStatuses?: TaskStatus[];
}

/**
 * Build a lifecycle hooks bundle for a workspace lead. The resulting
 * onCheckpoint captures an active-task snapshot at each run_start and,
 * on the following run_start, injects a structured delta describing
 * new / changed / removed tasks since the last one.
 *
 * The first run of a lead emits no delta (there is nothing to compare
 * against). Subsequent runs emit "noop" when nothing changed.
 */
export function buildLeadHooks(
  store: WorkspaceStateStore,
  options: BuildLeadHooksOptions = {},
): MinimalAgentHooks {
  const trackStatuses = options.trackStatuses ?? ACTIVE_STATUSES;

  let previous: Map<string, TaskSnapshot> | null = null;
  // Track handoffs already surfaced so we only report brand-new ones.
  // Using a Set of ids (not a createdAt cursor) is robust against the
  // InMemory store's millisecond-resolution clock where baseline and new
  // handoffs can share a timestamp.
  const reportedHandoffIds = new Set<string>();

  async function captureCurrent(): Promise<Map<string, TaskSnapshot>> {
    const tasks = await store.listTasks({ status: trackStatuses });
    const map = new Map<string, TaskSnapshot>();
    for (const task of tasks) {
      map.set(task.id, snapshotTask(task));
    }
    return map;
  }

  async function collectNewHandoffs(taskIds: Iterable<string>): Promise<Handoff[]> {
    const out: Handoff[] = [];
    for (const taskId of taskIds) {
      const handoffs = await store.listHandoffs(taskId);
      for (const h of handoffs) {
        if (!reportedHandoffIds.has(h.id)) {
          out.push(h);
          reportedHandoffIds.add(h.id);
        }
      }
    }
    // Stable order: oldest first so the lead reads them in the order the
    // workers emitted them.
    return out.sort((a, b) => a.createdAt - b.createdAt);
  }

  async function seedReportedHandoffs(taskIds: Iterable<string>): Promise<void> {
    for (const taskId of taskIds) {
      const handoffs = await store.listHandoffs(taskId);
      for (const h of handoffs) reportedHandoffIds.add(h.id);
    }
  }

  return {
    async onCheckpoint(ctx): Promise<LeadCheckpointAction | void> {
      // Only act at run_start — a fresh run is the moment where injecting
      // context has the most value. run_end would only affect the next run
      // anyway, and injecting via the inbox there races with the next
      // run_start's own capture.
      if (ctx.reason !== "run_start") return { kind: "noop" };

      const current = await captureCurrent();

      // Union the tracked task ids from both snapshots so we catch
      // handoffs on tasks that just disappeared from the active set (e.g.
      // a worker reported `completed` and the task transitioned out).
      const relevantTaskIds = new Set<string>();
      for (const id of current.keys()) relevantTaskIds.add(id);
      if (previous) for (const id of previous.keys()) relevantTaskIds.add(id);

      if (previous === null) {
        // First run of this lead in this process. Seed the reported-set
        // so we don't dump the entire handoff backlog on the next run.
        previous = current;
        await seedReportedHandoffs(relevantTaskIds);
        return { kind: "noop" };
      }

      const diff = diffSnapshots(previous, current);
      const newHandoffs = await collectNewHandoffs(relevantTaskIds);
      previous = current;

      const content = formatDelta(diff, newHandoffs);
      if (!content) return { kind: "noop" };
      return { kind: "inject", content };
    },
  };
}
