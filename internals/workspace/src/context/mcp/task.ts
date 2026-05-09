import type {
  Artifact,
  Wake,
  WakeStatus,
  Handoff,
  HandoffKind,
  SourceRef,
  Task,
  TaskStatus,
  WorkspaceStateStore,
} from "../../state/index.ts";
import type { AgentRole } from "../../config/types.ts";
import type { InstructionQueueInterface, Priority } from "../../types.ts";
import { nanoid } from "../../utils.ts";

/**
 * Lead-side task management tools. These expose the workspace kernel state
 * store to agents as first-class MCP tools so the lead can intake, open,
 * update, and close tasks without owning the persistence layer directly.
 *
 * Phase 2b intentionally keeps this minimal: no role-gated access, no
 * auto-accept / auto-open heuristics. All transitions are driven explicitly
 * by the agent calling these tools.
 *
 * Wake (renamed from Attempt) is the bounded-life unit per
 * design/decisions/005-session-orchestration-model.md. Task and Artifact
 * remain in the kernel as migration source.
 */

export interface TaskTools {
  task_create(args: {
    title: string;
    goal: string;
    status?: TaskStatus;
    priority?: number;
    ownerLeadId?: string;
    acceptanceCriteria?: string;
    source?: { kind: string; ref?: string; excerpt?: string };
  }): Promise<string>;
  task_list(args: { status?: string; ownerLeadId?: string }): Promise<string>;
  task_get(args: { id: string }): Promise<string>;
  task_update(args: {
    id: string;
    title?: string;
    goal?: string;
    status?: TaskStatus;
    priority?: number;
    ownerLeadId?: string;
    acceptanceCriteria?: string;
  }): Promise<string>;

  wake_create(args: {
    taskId: string;
    agentName?: string;
    role?: AgentRole;
    inputHandoffId?: string;
    runtimeType?: string;
    sessionId?: string;
    cwd?: string;
    worktreePath?: string;
  }): Promise<string>;
  wake_list(args: { taskId: string }): Promise<string>;
  wake_get(args: { id: string }): Promise<string>;
  wake_update(args: {
    id: string;
    status?: WakeStatus;
    resultSummary?: string;
    outputHandoffId?: string;
    sessionId?: string;
    lastHeartbeatAt?: number;
  }): Promise<string>;

  handoff_create(args: {
    taskId: string;
    closingWakeId: string;
    kind: HandoffKind;
    summary: string;
    completed?: string[];
    pending?: string[];
    blockers?: string[];
    decisions?: string[];
    resources?: string[];
    artifactRefs?: string[];
    touchedPaths?: string[];
  }): Promise<string>;
  handoff_list(args: { taskId: string }): Promise<string>;

  artifact_create(args: {
    taskId: string;
    createdByWakeId: string;
    kind: string;
    title: string;
    ref: string;
    checksum?: string;
    version?: number;
  }): Promise<string>;
  artifact_list(args: { taskId: string }): Promise<string>;

  task_dispatch(args: { taskId: string; worker: string; priority?: Priority }): Promise<string>;
}

const ALLOWED_STATUS = new Set<TaskStatus>([
  "draft",
  "open",
  "in_progress",
  "blocked",
  "completed",
  "aborted",
  "failed",
]);

const ALLOWED_WAKE_STATUS = new Set<WakeStatus>([
  "running",
  "completed",
  "failed",
  "cancelled",
  "handed_off",
]);

const ALLOWED_HANDOFF_KINDS = new Set<HandoffKind>(["progress", "blocked", "completed", "aborted"]);

const ALLOWED_ROLES = new Set<AgentRole>(["lead", "worker", "observer"]);

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && ALLOWED_STATUS.has(value as TaskStatus);
}

function isWakeStatus(value: unknown): value is WakeStatus {
  return typeof value === "string" && ALLOWED_WAKE_STATUS.has(value as WakeStatus);
}

function isHandoffKind(value: unknown): value is HandoffKind {
  return typeof value === "string" && ALLOWED_HANDOFF_KINDS.has(value as HandoffKind);
}

function isAgentRole(value: unknown): value is AgentRole {
  return typeof value === "string" && ALLOWED_ROLES.has(value as AgentRole);
}

function formatWake(wake: Wake): string {
  const lines: string[] = [];
  lines.push(`- [${wake.id}] ${wake.agentName} (${wake.role}) [${wake.status}]`);
  lines.push(`  task: ${wake.taskId}`);
  if (wake.runtimeType) lines.push(`  runtime: ${wake.runtimeType}`);
  if (wake.sessionId) lines.push(`  session: ${wake.sessionId}`);
  if (wake.worktrees && wake.worktrees.length > 0) {
    for (const wt of wake.worktrees) {
      lines.push(`  worktree[${wt.name}]: ${wt.path} (${wt.branch})`);
    }
  }
  if (wake.inputHandoffId) lines.push(`  inputHandoff: ${wake.inputHandoffId}`);
  if (wake.outputHandoffId) lines.push(`  outputHandoff: ${wake.outputHandoffId}`);
  if (wake.resultSummary) lines.push(`  summary: ${wake.resultSummary}`);
  return lines.join("\n");
}

function formatHandoff(handoff: Handoff): string {
  const lines: string[] = [];
  lines.push(`- [${handoff.id}] ${handoff.kind} by ${handoff.createdBy}`);
  lines.push(`  task: ${handoff.taskId}`);
  lines.push(`  closingWake: ${handoff.closingWakeId}`);
  lines.push(`  summary: ${handoff.summary}`);
  if (handoff.completed.length > 0) lines.push(`  completed: ${handoff.completed.join("; ")}`);
  if (handoff.pending.length > 0) lines.push(`  pending: ${handoff.pending.join("; ")}`);
  if (handoff.blockers.length > 0) lines.push(`  blockers: ${handoff.blockers.join("; ")}`);
  if (handoff.resources.length > 0) lines.push(`  resources: ${handoff.resources.join("; ")}`);
  return lines.join("\n");
}

function formatArtifact(artifact: Artifact): string {
  const lines: string[] = [];
  lines.push(`- [${artifact.id}] ${artifact.kind}: ${artifact.title}`);
  lines.push(`  task: ${artifact.taskId}`);
  lines.push(`  ref: ${artifact.ref}`);
  lines.push(`  createdBy: ${artifact.createdByWakeId}`);
  if (artifact.version != null) lines.push(`  version: ${artifact.version}`);
  if (artifact.checksum) lines.push(`  checksum: ${artifact.checksum}`);
  return lines.join("\n");
}

function formatTask(task: Task): string {
  const lines: string[] = [];
  lines.push(`- [${task.id}] ${task.title} [${task.status}]`);
  if (task.ownerLeadId) lines.push(`  owner: ${task.ownerLeadId}`);
  if (task.priority != null) lines.push(`  priority: ${task.priority}`);
  if (task.activeWakeId) lines.push(`  active wake: ${task.activeWakeId}`);
  lines.push(`  goal: ${task.goal}`);
  if (task.acceptanceCriteria) lines.push(`  accept: ${task.acceptanceCriteria}`);
  if (task.sourceRefs.length > 0) {
    const summary = task.sourceRefs.map((s) => (s.ref ? `${s.kind}:${s.ref}` : s.kind)).join(", ");
    lines.push(`  sources: ${summary}`);
  }
  if (task.artifactRefs.length > 0) {
    lines.push(`  artifacts: ${task.artifactRefs.length}`);
  }
  return lines.join("\n");
}

export interface TaskToolsDeps {
  /** Optional instruction queue — required only to enable task_dispatch. */
  instructionQueue?: InstructionQueueInterface;
  /**
   * Optional chronicle writer. When provided, every task mutation that
   * flows through these tools also records a human-readable entry on
   * the workspace chronicle under the "task" category, so external
   * observers (CLI, web UI, other agents) see the audit trail without
   * having to subscribe to bus events. Failures are swallowed — the
   * mutation always takes priority.
   */
  chronicle?: {
    append: (entry: { author: string; category: string; content: string }) => Promise<unknown>;
  };
}

export function createTaskTools(
  agentName: string,
  workspaceName: string,
  store: WorkspaceStateStore,
  deps: TaskToolsDeps = {},
): TaskTools {
  async function chronicle(content: string): Promise<void> {
    if (!deps.chronicle) return;
    try {
      await deps.chronicle.append({ author: agentName, category: "task", content });
    } catch {
      // Chronicle is observational; a failure here is non-fatal.
    }
  }
  // Serialise mutations that read a task's active-Wake state and then write
  // to it. The check-then-act sequence happens across async `await`
  // boundaries, so two concurrent dispatches on the same task can both pass
  // the "no active Wake" guard and then both install their own Wakes. A
  // per-task lock prevents that interleave within a single process.
  const inFlightTasks = new Set<string>();
  async function withTaskLock<T>(taskId: string, fn: () => Promise<T>): Promise<T | string> {
    if (inFlightTasks.has(taskId)) {
      return `Error: task ${taskId} has another active-Wake mutation in flight — retry in a moment.`;
    }
    inFlightTasks.add(taskId);
    try {
      return await fn();
    } finally {
      inFlightTasks.delete(taskId);
    }
  }
  return {
    async task_create(args): Promise<string> {
      const title = (args.title ?? "").trim();
      const goal = (args.goal ?? "").trim();
      if (!title) return "Error: 'title' is required.";
      if (!goal) return "Error: 'goal' is required.";

      const status: TaskStatus = args.status ?? "draft";
      if (!isTaskStatus(status)) return `Error: invalid status "${args.status}".`;

      const sourceRefs: SourceRef[] = args.source
        ? [
            {
              kind: args.source.kind,
              ref: args.source.ref,
              excerpt: args.source.excerpt,
              ts: Date.now(),
            },
          ]
        : [
            {
              kind: "agent",
              ref: agentName,
              ts: Date.now(),
            },
          ];

      const task = await store.createTask({
        workspaceId: workspaceName,
        title,
        goal,
        status,
        priority: args.priority,
        ownerLeadId: args.ownerLeadId,
        acceptanceCriteria: args.acceptanceCriteria,
        sourceRefs,
      });

      await chronicle(`task_create [${task.id}] [${task.status}]: ${task.title}`);
      return `Task ${task.id} created [${task.status}]: ${task.title}`;
    },

    async task_list(args): Promise<string> {
      const filter: { status?: TaskStatus[]; ownerLeadId?: string } = {};
      if (args.status) {
        const wanted = args.status
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const invalid = wanted.filter((s) => !isTaskStatus(s));
        if (invalid.length > 0) {
          return `Error: invalid status values: ${invalid.join(", ")}`;
        }
        filter.status = wanted as TaskStatus[];
      }
      if (args.ownerLeadId) filter.ownerLeadId = args.ownerLeadId;

      const tasks = await store.listTasks(filter);
      if (tasks.length === 0) return "No tasks.";
      return `Tasks (${tasks.length}):\n${tasks.map(formatTask).join("\n")}`;
    },

    async task_get(args): Promise<string> {
      if (!args.id) return "Error: 'id' is required.";
      const task = await store.getTask(args.id);
      if (!task) return `Task ${args.id} not found.`;
      return formatTask(task);
    },

    async task_update(args): Promise<string> {
      if (!args.id) return "Error: 'id' is required.";
      const current = await store.getTask(args.id);
      if (!current) return `Task ${args.id} not found.`;

      if (args.status != null && !isTaskStatus(args.status)) {
        return `Error: invalid status "${args.status}".`;
      }

      const patch: Parameters<WorkspaceStateStore["updateTask"]>[1] = {};
      if (args.title !== undefined) patch.title = args.title.trim();
      if (args.goal !== undefined) patch.goal = args.goal.trim();
      if (args.status !== undefined) patch.status = args.status;
      if (args.priority !== undefined) patch.priority = args.priority;
      if (args.ownerLeadId !== undefined) patch.ownerLeadId = args.ownerLeadId;
      if (args.acceptanceCriteria !== undefined) patch.acceptanceCriteria = args.acceptanceCriteria;

      const updated = await store.updateTask(args.id, patch);
      if (args.status !== undefined && args.status !== current.status) {
        await chronicle(
          `task_update [${updated.id}] ${current.status} → ${updated.status}: ${updated.title}`,
        );
      }
      return `Task ${updated.id} updated [${updated.status}]: ${updated.title}`;
    },

    // ── Wake tools ─────────────────────────────────────────────────────

    async wake_create(args): Promise<string> {
      if (!args.taskId) return "Error: 'taskId' is required.";
      const role: AgentRole = args.role ?? "worker";
      if (!isAgentRole(role)) return `Error: invalid role "${args.role}".`;

      const result = await withTaskLock(args.taskId, async () => {
        try {
          const wake = await store.createWake({
            taskId: args.taskId,
            agentName: args.agentName ?? agentName,
            role,
            inputHandoffId: args.inputHandoffId,
            runtimeType: args.runtimeType,
            sessionId: args.sessionId,
            cwd: args.cwd,
          });

          // Wire as active only when the task has no active Wake.
          const task = await store.getTask(args.taskId);
          if (task && !task.activeWakeId) {
            await store.updateTask(args.taskId, {
              activeWakeId: wake.id,
              status:
                task.status === "open" || task.status === "draft" ? "in_progress" : task.status,
            });
          }

          return `Wake ${wake.id} started on task ${wake.taskId} [${wake.status}]`;
        } catch (err) {
          return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
      });
      return typeof result === "string" ? result : String(result);
    },

    async wake_list(args): Promise<string> {
      if (!args.taskId) return "Error: 'taskId' is required.";
      const wakes = await store.listWakes(args.taskId);
      if (wakes.length === 0) return `No wakes for task ${args.taskId}.`;
      return `Wakes (${wakes.length}):\n${wakes.map(formatWake).join("\n")}`;
    },

    async wake_get(args): Promise<string> {
      if (!args.id) return "Error: 'id' is required.";
      const wake = await store.getWake(args.id);
      if (!wake) return `Wake ${args.id} not found.`;
      return formatWake(wake);
    },

    async wake_update(args): Promise<string> {
      if (!args.id) return "Error: 'id' is required.";
      if (args.status != null && !isWakeStatus(args.status)) {
        return `Error: invalid wake status "${args.status}".`;
      }
      const current = await store.getWake(args.id);
      if (!current) return `Wake ${args.id} not found.`;

      const patch: Parameters<WorkspaceStateStore["updateWake"]>[1] = {};
      if (args.status !== undefined) patch.status = args.status;
      if (args.resultSummary !== undefined) patch.resultSummary = args.resultSummary;
      if (args.outputHandoffId !== undefined) patch.outputHandoffId = args.outputHandoffId;
      if (args.sessionId !== undefined) patch.sessionId = args.sessionId;
      if (args.lastHeartbeatAt !== undefined) patch.lastHeartbeatAt = args.lastHeartbeatAt;
      // All four of these are logically terminal for the current Wake —
      // `handed_off` means the Wake relinquished control, even though the
      // task continues. Stamp endedAt and clear activeWakeId for all of
      // them so a follow-up dispatch isn't blocked by a stale reference.
      if (
        args.status === "completed" ||
        args.status === "failed" ||
        args.status === "cancelled" ||
        args.status === "handed_off"
      ) {
        patch.endedAt = Date.now();
      }

      const updated = await store.updateWake(args.id, patch);

      // If the Wake is terminal, clear the task's activeWakeId.
      if (patch.endedAt) {
        const task = await store.getTask(updated.taskId);
        if (task && task.activeWakeId === updated.id) {
          await store.updateTask(updated.taskId, { activeWakeId: undefined });
        }
      }

      if (args.status !== undefined) {
        await chronicle(
          `wake_update [${updated.id}] on task ${updated.taskId} → ${updated.status}`,
        );
      }
      return `Wake ${updated.id} updated [${updated.status}]`;
    },

    // ── Handoff tools ──────────────────────────────────────────────────

    async handoff_create(args): Promise<string> {
      if (!args.taskId || !args.closingWakeId || !args.summary) {
        return "Error: 'taskId', 'closingWakeId', and 'summary' are required.";
      }
      if (!isHandoffKind(args.kind)) {
        return `Error: invalid handoff kind "${args.kind}".`;
      }
      try {
        const handoff = await store.createHandoff({
          taskId: args.taskId,
          closingWakeId: args.closingWakeId,
          createdBy: agentName,
          kind: args.kind,
          summary: args.summary,
          completed: args.completed,
          pending: args.pending,
          blockers: args.blockers,
          decisions: args.decisions,
          resources: args.resources,
          artifactRefs: args.artifactRefs,
          touchedPaths: args.touchedPaths,
        });
        return `Handoff ${handoff.id} recorded on task ${handoff.taskId} (${handoff.kind})`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },

    async handoff_list(args): Promise<string> {
      if (!args.taskId) return "Error: 'taskId' is required.";
      const handoffs = await store.listHandoffs(args.taskId);
      if (handoffs.length === 0) return `No handoffs for task ${args.taskId}.`;
      return `Handoffs (${handoffs.length}):\n${handoffs.map(formatHandoff).join("\n")}`;
    },

    // ── Artifact tools ─────────────────────────────────────────────────

    async artifact_create(args): Promise<string> {
      if (!args.taskId || !args.createdByWakeId || !args.kind || !args.title || !args.ref) {
        return "Error: 'taskId', 'createdByWakeId', 'kind', 'title', and 'ref' are required.";
      }
      try {
        const artifact = await store.createArtifact({
          taskId: args.taskId,
          createdByWakeId: args.createdByWakeId,
          kind: args.kind,
          title: args.title,
          ref: args.ref,
          checksum: args.checksum,
          version: args.version,
        });
        return `Artifact ${artifact.id} registered on task ${artifact.taskId}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },

    async artifact_list(args): Promise<string> {
      if (!args.taskId) return "Error: 'taskId' is required.";
      const artifacts = await store.listArtifacts(args.taskId);
      if (artifacts.length === 0) return `No artifacts for task ${args.taskId}.`;
      return `Artifacts (${artifacts.length}):\n${artifacts.map(formatArtifact).join("\n")}`;
    },

    // ── Dispatch: lead hands a task to a worker ────────────────────────

    async task_dispatch(args): Promise<string> {
      if (!deps.instructionQueue) {
        return "Error: task_dispatch unavailable — this workspace has no instruction queue.";
      }
      if (!args.taskId || !args.worker) {
        return "Error: 'taskId' and 'worker' are required.";
      }

      // Normalize the worker handle up front. The orchestrator polls the
      // instruction queue by bare agent name, so "@implementer" vs
      // "implementer" is a silent bug: the enqueue goes through fine but
      // the worker's queue never has an entry with a matching agentName
      // and the dispatch is effectively a no-op from the queue side.
      // Strip leading @ so both forms route the same way.
      const workerName = args.worker.replace(/^@+/, "");
      if (!workerName) {
        return "Error: 'worker' must name a real agent (got just '@').";
      }

      const result = await withTaskLock(args.taskId, async () => {
        const task = await store.getTask(args.taskId);
        if (!task) return `Error: task ${args.taskId} not found.`;
        if (task.status === "completed" || task.status === "aborted" || task.status === "failed") {
          return `Error: task ${task.id} is already ${task.status}.`;
        }
        if (task.activeWakeId) {
          return `Error: task ${task.id} already has an active Wake (${task.activeWakeId}). Cancel or complete it before dispatching again.`;
        }

        let wake: Wake;
        try {
          // Worktrees are created on-demand by the worker via the
          // Wake-scoped `worktree_create` tool during its run; the
          // resulting entries land on `wake.worktrees` and are cleaned up
          // on terminal status via the `wake.terminal` event listener
          // wired in workspace-registry.
          wake = await store.createWake({
            taskId: task.id,
            agentName: workerName,
            role: "worker",
          });
        } catch (err) {
          return `Error creating Wake: ${err instanceof Error ? err.message : String(err)}`;
        }

        await store.updateTask(task.id, {
          activeWakeId: wake.id,
          status: task.status === "draft" || task.status === "open" ? "in_progress" : task.status,
        });

        const priority: Priority = args.priority ?? "normal";
        const instruction = {
          id: nanoid(),
          agentName: workerName,
          messageId: `dispatch:${wake.id}`,
          channel: "dispatch",
          content: formatDispatchInstruction(task, wake, agentName),
          priority,
          enqueuedAt: new Date().toISOString(),
        };
        deps.instructionQueue!.enqueue(instruction);

        await chronicle(
          `task_dispatch [${task.id}] → @${workerName} as ${wake.id}: ${task.title}`,
        );
        return `Dispatched task ${task.id} to @${workerName} as wake ${wake.id}`;
      });
      return typeof result === "string" ? result : String(result);
    },
  };
}

function formatDispatchInstruction(task: Task, wake: Wake, from: string): string {
  const lines = [
    `You have been assigned task [${task.id}] by @${from}.`,
    "",
    `**Title:** ${task.title}`,
    `**Goal:** ${task.goal}`,
  ];
  if (task.acceptanceCriteria) {
    lines.push(`**Acceptance criteria:** ${task.acceptanceCriteria}`);
  }
  lines.push(
    "",
    `Wake id: ${wake.id}. When finished, call wake_update with the terminal status ` +
      `and handoff_create with a structured summary. Register concrete outputs via artifact_create.`,
  );
  return lines.join("\n");
}

export const TASK_TOOL_DEFS = {
  task_create: {
    description:
      "Create a new task in the workspace ledger. Defaults to status 'draft' — " +
      "the lead confirms the draft by calling task_update with status 'open'.",
    parameters: {
      title: { type: "string", description: "Short task title" },
      goal: { type: "string", description: "What success looks like" },
      status: {
        type: "string",
        description: "Initial status (default: draft)",
      },
      priority: { type: "number", description: "Numeric priority (optional)" },
      ownerLeadId: { type: "string", description: "Lead agent taking ownership" },
      acceptanceCriteria: { type: "string", description: "Checklist or narrative" },
      source: {
        type: "object",
        description: "Where this task came from (kind, ref, excerpt)",
      },
    },
    required: ["title", "goal"],
  },
  task_list: {
    description: "List tasks in the workspace ledger, optionally filtered by status or owner.",
    parameters: {
      status: {
        type: "string",
        description: "Comma-separated status filter (e.g. 'draft,open,in_progress')",
      },
      ownerLeadId: { type: "string", description: "Filter to tasks owned by this lead" },
    },
    required: [],
  },
  task_get: {
    description: "Fetch a task by id.",
    parameters: {
      id: { type: "string", description: "Task id" },
    },
    required: ["id"],
  },
  task_update: {
    description: "Patch a task. Any omitted field is left unchanged.",
    parameters: {
      id: { type: "string", description: "Task id" },
      title: { type: "string", description: "New title" },
      goal: { type: "string", description: "New goal" },
      status: {
        type: "string",
        description:
          "New status (draft | open | in_progress | blocked | completed | aborted | failed)",
      },
      priority: { type: "number", description: "New priority" },
      ownerLeadId: { type: "string", description: "New owner lead" },
      acceptanceCriteria: { type: "string", description: "New acceptance criteria" },
    },
    required: ["id"],
  },
  wake_create: {
    description:
      "Start a Wake (one bounded agent runtime instance) on a task. Defaults role to 'worker' and " +
      "agentName to the caller. If the task has no active Wake yet, wires this Wake as active and " +
      "advances task status to 'in_progress'.",
    parameters: {
      taskId: { type: "string", description: "Task id" },
      agentName: { type: "string", description: "Agent name (default: caller)" },
      role: { type: "string", description: "lead | worker | observer" },
      inputHandoffId: { type: "string", description: "Handoff consumed as input" },
      runtimeType: { type: "string", description: "Runtime (codex, claude-code, …)" },
      sessionId: { type: "string", description: "Runtime session/thread id" },
      cwd: { type: "string", description: "Working directory" },
      worktreePath: { type: "string", description: "Git worktree path" },
    },
    required: ["taskId"],
  },
  wake_list: {
    description: "List Wakes for a task in started-order.",
    parameters: {
      taskId: { type: "string", description: "Task id" },
    },
    required: ["taskId"],
  },
  wake_get: {
    description: "Fetch a Wake by id.",
    parameters: {
      id: { type: "string", description: "Wake id" },
    },
    required: ["id"],
  },
  wake_update: {
    description:
      "Update a Wake. Terminal statuses (completed | failed | cancelled | handed_off) stamp endedAt " +
      "and clear the task's activeWakeId.",
    parameters: {
      id: { type: "string", description: "Wake id" },
      status: {
        type: "string",
        description: "running | completed | failed | cancelled | handed_off",
      },
      resultSummary: { type: "string", description: "Short result summary" },
      outputHandoffId: { type: "string", description: "Handoff produced at end" },
      sessionId: { type: "string", description: "Updated runtime session id" },
      lastHeartbeatAt: { type: "number", description: "Most recent liveness ts (ms)" },
    },
    required: ["id"],
  },
  handoff_create: {
    description:
      "Record a structured handoff on a task. `kind` is 'progress' | 'blocked' | 'completed' | " +
      "'aborted'. `closingWakeId` is the Wake that produced this handoff.",
    parameters: {
      taskId: { type: "string", description: "Task id" },
      closingWakeId: { type: "string", description: "Wake that produced this handoff" },
      kind: { type: "string", description: "progress | blocked | completed | aborted" },
      summary: { type: "string", description: "One-paragraph summary" },
      completed: { type: "array", description: "What got done" },
      pending: { type: "array", description: "What still needs to happen" },
      blockers: { type: "array", description: "Blockers encountered" },
      decisions: { type: "array", description: "Key decisions made" },
      resources: { type: "array", description: "Refs to durable outputs (Resource ids)" },
      artifactRefs: { type: "array", description: "Deprecated: artifact ids; use resources" },
      touchedPaths: { type: "array", description: "Files / paths touched" },
    },
    required: ["taskId", "closingWakeId", "kind", "summary"],
  },
  handoff_list: {
    description: "List handoffs for a task in time-order.",
    parameters: {
      taskId: { type: "string", description: "Task id" },
    },
    required: ["taskId"],
  },
  artifact_create: {
    description:
      "Register a concrete execution output as an Artifact. `ref` is a scheme-prefixed " +
      "identifier (file:/path, git:sha, url:…). Note: Artifact is being merged into Resource " +
      "in a follow-on blueprint.",
    parameters: {
      taskId: { type: "string", description: "Task id" },
      createdByWakeId: { type: "string", description: "Wake that produced it" },
      kind: { type: "string", description: "e.g. 'file', 'commit', 'url', 'patch'" },
      title: { type: "string", description: "Short human-readable title" },
      ref: { type: "string", description: "Scheme-prefixed reference" },
      checksum: { type: "string", description: "Optional integrity hash" },
      version: { type: "number", description: "Optional version number" },
    },
    required: ["taskId", "createdByWakeId", "kind", "title", "ref"],
  },
  artifact_list: {
    description: "List artifacts for a task in created-order.",
    parameters: {
      taskId: { type: "string", description: "Task id" },
    },
    required: ["taskId"],
  },
  task_dispatch: {
    description:
      "Hand a task to a worker: creates a Wake, advances the task to in_progress, and " +
      "enqueues an instruction on the worker's queue. Only available when the workspace has " +
      "an instruction queue (i.e. on live Workspace runtimes, not bare test harnesses).",
    parameters: {
      taskId: { type: "string", description: "Task id to dispatch" },
      worker: { type: "string", description: "Agent name to assign" },
      priority: {
        type: "string",
        description: "Instruction priority: immediate | normal | background (default: normal)",
      },
    },
    required: ["taskId", "worker"],
  },
} as const;
