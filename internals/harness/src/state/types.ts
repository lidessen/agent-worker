// ── Harness kernel state objects ─────────────────────────────────────────
//
// `Wake` is one short-lived agent instance bound to a (task, agent) pair.
// `Handoff` is the structured cross-Wake transfer carrying a generic core
// plus a typed `extensions` map keyed by harness type id (per
// design/decisions/005-session-orchestration-model.md). The hooks that
// populate the extension are not implemented in this slice — the field is
// reserved as opaque storage so harness-specific schemas can land later
// without further migration.
//
// `Task` remains in the kernel for now. Decision 005 moves it into a
// harness-layer projection over the HarnessEvent stream; that move is a
// separate blueprint. `Artifact` has been dropped — concrete outputs are
// referenced as `Resource` ids in the Handoff core.
//
// This module is pure data. The store interface is in ./store.ts and
// implementations under ./file-store.ts.

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
 * separate TaskDraft object is used.
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
  harnessId: string;
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
  createdAt: number;
  updatedAt: number;
}

/** Input shape for createTask — id / timestamps / default fields auto-filled. */
export interface CreateTaskInput {
  harnessId: string;
  title: string;
  goal: string;
  status?: TaskStatus;
  priority?: number;
  ownerLeadId?: string;
  sourceRefs?: SourceRef[];
  acceptanceCriteria?: string;
}

/** Partial patch accepted by updateTask. `id`/`createdAt` cannot be changed. */
export type TaskPatch = Partial<Omit<Task, "id" | "createdAt" | "harnessId">>;

// ── Wake ───────────────────────────────────────────────────────────────────

/**
 * One short-lived agent instance — one runtime invocation against a task.
 * A Wake's life is bounded by task completion, context-window exhaustion,
 * or harness decision. Cross-Wake state lives in the harness's task
 * projection plus the Handoff chain; no Wake holds state for a future Wake.
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
 * Wake-scoped: lifecycle follows the Wake, the harness itself never
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

/** Structured shift record between Wakes. */
export type HandoffKind = "progress" | "blocked" | "completed" | "aborted";

/**
 * Opaque per-harness extension payload. Each harness type owns the schema
 * keyed under `harnessTypeId` in `Handoff.extensions`. The kernel does not
 * inspect the payload — produce / consume hooks are run by the orchestrator
 * at Wake close / start (hook protocol lands in a later blueprint).
 */
export type HandoffExtensionPayload = unknown;

/**
 * Cross-Wake transfer: a fixed generic core every Handoff carries, plus an
 * optional per-type extension map keyed by `harnessTypeId`. The
 * `harnessTypeId` field on the record itself names which `HarnessType`
 * was authoritative — its hooks produced the extension and should consume
 * it. Optional for older records and orphan-recovery handoffs (defaults
 * to the registry's default type id).
 */
export interface Handoff {
  id: string;
  taskId: string;
  /** Wake that produced this Handoff. */
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
  /** Refs to durable outputs (Resource ids). */
  resources: string[];
  /** Anchor into the work log. Populated when the work-log aggregator lands. */
  workLogPointer?: string;
  /** Opaque per-type extension payloads keyed by harnessTypeId. */
  extensions: Record<string, HandoffExtensionPayload>;
  /** HarnessType id whose hooks produced/should consume this Handoff's extension. */
  harnessTypeId?: string;
}

export interface CreateHandoffInput {
  taskId: string;
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
  harnessTypeId?: string;
}
