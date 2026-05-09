// ── Workspace kernel state objects ─────────────────────────────────────────
//
// First-class state objects produced by the workspace harness. `Wake` is a
// single short-lived agent instance bound to a (task, agent) pair (renamed
// from `Attempt` per design/decisions/005). `Handoff` is the structured
// transfer between consecutive Wakes — a fixed generic core plus a typed
// `extensions` map populated by per-harness produceExtension /
// consumeExtension hooks (hooks themselves are not implemented in this
// slice).
//
// `Task` and `Artifact` remain in the kernel for now as migration source —
// per decision 005, `Task` will move to a harness-layer projection and
// `Artifact` will be merged into `Resource` in follow-on blueprints.
//
// This module is pure data — the store lives in ./store.ts and ./stores/.
// No orchestration wiring lives here.

import type { AgentRole } from "../config/types.ts";

// ── Shared ─────────────────────────────────────────────────────────────────

/** Where a task came from — a pointer back to the surface that created it. */
export interface SourceRef {
  /** Source surface: "user", "channel", "kickoff", "telegram", "api", etc. */
  kind: string;
  /** Arbitrary identifier scoped to `kind` — e.g. channel message id, user name. */
  ref?: string;
  /** Human-readable excerpt for ledger display. */
  excerpt?: string;
  /** When the source reference was captured. */
  ts: number;
}

// ── Task ───────────────────────────────────────────────────────────────────

/**
 * Task lifecycle state. `draft` captures the pre-confirmation stage — no
 * separate TaskDraft object is used. See the design doc's "TaskDraft 不作为
 * 独立对象" section for the rationale.
 */
export type TaskStatus =
  | "draft"
  | "open"
  | "in_progress"
  | "blocked"
  | "completed"
  | "aborted"
  | "failed";

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  goal: string;
  status: TaskStatus;
  priority?: number;
  /** The lead agent that currently owns this task's intake / scheduling. */
  ownerLeadId?: string;
  /** The currently active Wake id, if any. Set when status transitions to in_progress. */
  activeWakeId?: string;
  /** Where the task originated — message id, user, kickoff, etc. */
  sourceRefs: SourceRef[];
  /** Optional acceptance-criteria text (plain-text checklist or narrative). */
  acceptanceCriteria?: string;
  /** Ids of artifacts associated with this task. */
  artifactRefs: string[];
  createdAt: number;
  updatedAt: number;
}

/** Input shape for createTask — id / timestamps / default fields auto-filled. */
export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  goal: string;
  status?: TaskStatus;
  priority?: number;
  ownerLeadId?: string;
  sourceRefs?: SourceRef[];
  acceptanceCriteria?: string;
}

/** Partial patch accepted by updateTask. `id`/`createdAt` cannot be changed. */
export type TaskPatch = Partial<Omit<Task, "id" | "createdAt" | "workspaceId">>;

// ── Wake ───────────────────────────────────────────────────────────────────

/**
 * One short-lived agent instance — one runtime invocation against a task.
 * A Wake's life is bounded by task completion, context-window exhaustion,
 * or harness decision. Cross-Wake state lives in the harness's task
 * projection plus the Handoff chain; no Wake holds state for a future Wake.
 *
 * Renamed from `Attempt` per design/decisions/005-session-orchestration-model.md.
 *
 * Multiple concurrent Wakes may exist for one AgentSpec. Lead is an
 * exception — lead is workspace-scoped, not task-scoped, and therefore
 * typically does not have Wakes of its own.
 */
export type WakeStatus = "running" | "completed" | "failed" | "cancelled" | "handed_off";

/** Terminal statuses — used to gate `wake.terminal` event emission. */
export const TERMINAL_WAKE_STATUSES: readonly WakeStatus[] = [
  "completed",
  "failed",
  "cancelled",
  "handed_off",
];

/**
 * Git worktree provisioned by a Wake via the `worktree_create` MCP tool.
 * Wake-scoped: lifecycle follows the Wake, the workspace itself never
 * holds git state directly.
 */
export interface Worktree {
  /** Wake-scoped unique identifier. Caller-provided. */
  name: string;
  /** Canonical absolute path to the source git repository. */
  repoPath: string;
  /** Branch name, caller-provided — runtime does not generate. */
  branch: string;
  /** Base branch the new branch was forked from. */
  baseBranch: string;
  /** Absolute path to the provisioned working directory. */
  path: string;
  /** Epoch ms of provisioning. */
  createdAt: number;
}

export interface Wake {
  id: string;
  taskId: string;
  agentName: string;
  role: AgentRole;
  status: WakeStatus;
  startedAt: number;
  endedAt?: number;
  /** Handoff consumed at start — e.g. from a previous Wake. */
  inputHandoffId?: string;
  /** Handoff produced at end — progress / blocked / completed / aborted. */
  outputHandoffId?: string;
  resultSummary?: string;
  /** Runtime/session breadcrumbs for resume + audit. */
  runtimeType?: string;
  sessionId?: string;
  cwd?: string;
  /**
   * Worktrees provisioned by this Wake through the `worktree_create` MCP
   * tool. Each entry is torn down when the Wake transitions to any terminal
   * status. Branches are preserved so completed work survives cleanup.
   */
  worktrees?: readonly Worktree[];
  pid?: number;
  lastHeartbeatAt?: number;
}

export interface CreateWakeInput {
  taskId: string;
  agentName: string;
  role: AgentRole;
  status?: WakeStatus;
  inputHandoffId?: string;
  runtimeType?: string;
  sessionId?: string;
  cwd?: string;
  pid?: number;
}

export type WakePatch = Partial<Omit<Wake, "id" | "taskId" | "startedAt">>;

// ── Handoff ────────────────────────────────────────────────────────────────

/** Structured shift record between Wakes (or between lead and worker). */
export type HandoffKind = "progress" | "blocked" | "completed" | "aborted";

/**
 * Opaque per-harness extension payload. Each harness type owns the schema
 * keyed under `harnessTypeId` in `Handoff.extensions`. The kernel does not
 * inspect the payload — produce / consume hooks are run by the orchestrator
 * at Wake close / start (hook protocol lands in a later blueprint).
 */
export type HandoffExtensionPayload = unknown;

/**
 * Cross-Wake transfer with a fixed generic core every Handoff carries plus
 * an optional per-harness extension map keyed by `harnessTypeId`.
 *
 * Generic core (per design/decisions/005):
 * - closingWakeId, taskId, kind, summary, pending, decisions, blockers
 * - resources: refs to durable outputs (Resource ids)
 * - workLogPointer?: anchor into the work log (populated when the work-log
 *   aggregator lands; kept as an optional placeholder for now)
 *
 * Per-harness extension:
 * - extensions: keyed by harnessTypeId, opaque payload populated by the
 *   harness's produceExtension hook.
 *
 * Migration / transitional fields kept this slice (will be cleaned up as
 * follow-on blueprints land):
 * - artifactRefs: deprecated; will be removed when Artifact merges into Resource
 * - touchedPaths, runtimeRefs: free-form runtime breadcrumbs; may move into
 *   a per-runtime extension later
 */
export interface Handoff {
  id: string;
  taskId: string;
  /** Wake that produced this Handoff (renamed from fromAttemptId). */
  closingWakeId: string;
  createdAt: number;
  /** Agent name or system identifier that authored the handoff. */
  createdBy: string;
  kind: HandoffKind;
  summary: string;
  completed: string[];
  pending: string[];
  blockers: string[];
  decisions: string[];
  /** Refs to durable outputs (Resource ids). Replaces the implicit artifact links. */
  resources: string[];
  /** Anchor into the work log. Placeholder — populated when the work-log aggregator lands. */
  workLogPointer?: string;
  /** Opaque per-harness extension payloads keyed by harnessTypeId. */
  extensions: Record<string, HandoffExtensionPayload>;

  // --- Transitional fields (will be cleaned up by follow-on blueprints) ---
  /** Deprecated — will be removed when Artifact merges into Resource. */
  artifactRefs: string[];
  /** Files / paths touched during the Wake, for quick orientation. */
  touchedPaths?: string[];
  /** Free-form runtime breadcrumbs (session ids, branch names, etc.). */
  runtimeRefs?: Record<string, unknown>;
}

export interface CreateHandoffInput {
  taskId: string;
  /** Wake that produced this Handoff (renamed from fromAttemptId). */
  closingWakeId: string;
  createdBy: string;
  kind: HandoffKind;
  summary: string;
  completed?: string[];
  pending?: string[];
  blockers?: string[];
  decisions?: string[];
  resources?: string[];
  workLogPointer?: string;
  extensions?: Record<string, HandoffExtensionPayload>;
  artifactRefs?: string[];
  touchedPaths?: string[];
  runtimeRefs?: Record<string, unknown>;
}

// ── Artifact ───────────────────────────────────────────────────────────────

/**
 * A reference to a concrete output produced during a Wake. The store holds
 * the reference, not the content. The `ref` field is a free-form URL or
 * scheme-prefixed identifier (e.g. "file:/path", "git:sha", "url:...").
 *
 * Per decision 005 this type is being merged into `Resource`. Kept here as
 * migration source until the merge blueprint lands.
 */
export interface Artifact {
  id: string;
  taskId: string;
  kind: string;
  title: string;
  ref: string;
  /** Wake that produced this artifact (renamed from createdByAttemptId). */
  createdByWakeId: string;
  createdAt: number;
  checksum?: string;
  version?: number;
}

export interface CreateArtifactInput {
  taskId: string;
  kind: string;
  title: string;
  ref: string;
  createdByWakeId: string;
  checksum?: string;
  version?: number;
}
