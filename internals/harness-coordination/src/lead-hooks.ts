// ── Lead lifecycle hooks ──────────────────────────────────────────────────
//
// Builds an AgentLifecycleHooks bundle for a harness lead that uses
// onCheckpoint to inject task-ledger deltas between runs. The lead sees
// a fresh "what changed" view each time it wakes without having to call
// task_list manually.

import type { Handoff, Task, TaskStatus, HarnessStateStore } from "@agent-worker/harness";

/** Subset of the Agent type we need — keep this file decoupled from @agent-worker/agent. */
interface MinimalAgentHooks {
  onCheckpoint?: (ctx: {
    reason: "run_start" | "run_end" | "event";
    runNumber: number;
  }) => Promise<LeadCheckpointAction | void> | LeadCheckpointAction | void;
}

type LeadCheckpointAction = { kind: "noop" } | { kind: "inject"; content: string };

interface TaskSnapshot {
  id: string;
  title: string;
  status: TaskStatus;
  activeWakeId?: string;
  updatedAt: number;
}

const ACTIVE_STATUSES: TaskStatus[] = ["draft", "open", "in_progress", "blocked"];

function snapshotTask(task: Task): TaskSnapshot {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    activeWakeId: task.activeWakeId,
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
  activeWakeChanged: TaskSnapshot[];
} {
  const added: TaskSnapshot[] = [];
  const removed: TaskSnapshot[] = [];
  const statusChanged: Array<{ from: TaskStatus; to: TaskStatus; snapshot: TaskSnapshot }> = [];
  const activeWakeChanged: TaskSnapshot[] = [];

  for (const [id, curr] of next) {
    const before = prev.get(id);
    if (!before) {
      added.push(curr);
      continue;
    }
    if (before.status !== curr.status) {
      statusChanged.push({ from: before.status, to: curr.status, snapshot: curr });
    } else if (before.activeWakeId !== curr.activeWakeId) {
      activeWakeChanged.push(curr);
    }
  }
  for (const [id, before] of prev) {
    if (!next.has(id)) removed.push(before);
  }

  return { added, removed, statusChanged, activeWakeChanged };
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
  if (diff.activeWakeChanged.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("**Active wake changes:**");
    for (const t of diff.activeWakeChanged) {
      const wakeDesc = t.activeWakeId ? `now ${t.activeWakeId}` : "cleared";
      lines.push(`- [${t.id}] ${t.title}: ${wakeDesc}`);
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
      if (h.pending.length > 0) {
        lines.push(`  pending: ${h.pending.join("; ")}`);
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
 * Build a lifecycle hooks bundle for a harness lead. The resulting
 * onCheckpoint captures an active-task snapshot at each run_start and,
 * on the following run_start, injects a structured delta describing
 * new / changed / removed tasks since the last one.
 */
export function buildLeadHooks(
  store: HarnessStateStore,
  options: BuildLeadHooksOptions = {},
): MinimalAgentHooks {
  const trackStatuses = options.trackStatuses ?? ACTIVE_STATUSES;

  let previous: Map<string, TaskSnapshot> | null = null;
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
      if (ctx.reason !== "run_start") return { kind: "noop" };

      const current = await captureCurrent();

      const relevantTaskIds = new Set<string>();
      for (const id of current.keys()) relevantTaskIds.add(id);
      if (previous) for (const id of previous.keys()) relevantTaskIds.add(id);

      if (previous === null) {
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
