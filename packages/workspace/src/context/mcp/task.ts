import type { WorkspaceStateStore, Task, TaskStatus, SourceRef } from "../../state/index.ts";

/**
 * Lead-side task management tools. These expose the workspace kernel state
 * store to agents as first-class MCP tools so the lead can intake, open,
 * update, and close tasks without owning the persistence layer directly.
 *
 * Phase 2b intentionally keeps this minimal: no role-gated access, no
 * auto-accept / auto-open heuristics. All transitions are driven explicitly
 * by the agent calling these tools.
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

function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && ALLOWED_STATUS.has(value as TaskStatus);
}

function formatTask(task: Task): string {
  const lines: string[] = [];
  lines.push(`- [${task.id}] ${task.title} [${task.status}]`);
  if (task.ownerLeadId) lines.push(`  owner: ${task.ownerLeadId}`);
  if (task.priority != null) lines.push(`  priority: ${task.priority}`);
  if (task.activeAttemptId) lines.push(`  active attempt: ${task.activeAttemptId}`);
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

export function createTaskTools(
  agentName: string,
  workspaceName: string,
  store: WorkspaceStateStore,
): TaskTools {
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
      return `Task ${updated.id} updated [${updated.status}]: ${updated.title}`;
    },
  };
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
} as const;
