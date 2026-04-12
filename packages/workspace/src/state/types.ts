// ── Workspace kernel state objects ─────────────────────────────────────────
//
// These are the first-class state objects produced by the workspace-led
// hierarchical design (see docs/design/workspace-led-hierarchical-agent-system/
// state-and-context-model.md). `Task` is the canonical unit of work. `Attempt`
// is a single runtime execution bound to a (task, agent) pair. `Handoff`
// records a structured transfer/shift. `Artifact` is a reference to a
// concrete execution output.
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
  /** The currently active Attempt id, if any. Set when status transitions to in_progress. */
  activeAttemptId?: string;
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

// ── Attempt ────────────────────────────────────────────────────────────────

/**
 * One execution of a task by a specific agent. An Attempt is NOT the same as
 * a static agent definition (AgentSpec / AgentDef) — it's the task-scoped
 * runtime instance derived from that spec at assignment time.
 *
 * Multiple concurrent Attempts may exist for one AgentSpec. Lead is an
 * exception — lead is workspace-scoped, not task-scoped, and therefore
 * typically does not have Attempts of its own.
 */
export type AttemptStatus = "running" | "completed" | "failed" | "cancelled" | "handed_off";

export interface Attempt {
  id: string;
  taskId: string;
  agentName: string;
  role: AgentRole;
  status: AttemptStatus;
  startedAt: number;
  endedAt?: number;
  /** Handoff consumed at start — e.g. from a previous attempt. */
  inputHandoffId?: string;
  /** Handoff produced at end — progress / blocked / completed / aborted. */
  outputHandoffId?: string;
  resultSummary?: string;
  /** Runtime/session breadcrumbs for resume + audit. */
  runtimeType?: string;
  sessionId?: string;
  cwd?: string;
  worktreePath?: string;
  pid?: number;
  lastHeartbeatAt?: number;
}

export interface CreateAttemptInput {
  taskId: string;
  agentName: string;
  role: AgentRole;
  status?: AttemptStatus;
  inputHandoffId?: string;
  runtimeType?: string;
  sessionId?: string;
  cwd?: string;
  worktreePath?: string;
  pid?: number;
}

export type AttemptPatch = Partial<Omit<Attempt, "id" | "taskId" | "startedAt">>;

// ── Handoff ────────────────────────────────────────────────────────────────

/** Structured shift record between attempts (or between lead and worker). */
export type HandoffKind = "progress" | "blocked" | "completed" | "aborted";

export interface Handoff {
  id: string;
  taskId: string;
  fromAttemptId: string;
  /** Destination attempt, if the handoff is directed. */
  toAttemptId?: string;
  createdAt: number;
  /** Agent name or system identifier that authored the handoff. */
  createdBy: string;
  kind: HandoffKind;
  summary: string;
  completed: string[];
  pending: string[];
  blockers: string[];
  decisions: string[];
  nextSteps: string[];
  artifactRefs: string[];
  /** Files / paths touched during the attempt, for quick orientation. */
  touchedPaths?: string[];
  /** Free-form runtime breadcrumbs (session ids, branch names, etc.). */
  runtimeRefs?: Record<string, unknown>;
}

export interface CreateHandoffInput {
  taskId: string;
  fromAttemptId: string;
  toAttemptId?: string;
  createdBy: string;
  kind: HandoffKind;
  summary: string;
  completed?: string[];
  pending?: string[];
  blockers?: string[];
  decisions?: string[];
  nextSteps?: string[];
  artifactRefs?: string[];
  touchedPaths?: string[];
  runtimeRefs?: Record<string, unknown>;
}

// ── Artifact ───────────────────────────────────────────────────────────────

/**
 * A reference to a concrete output produced during an Attempt. The store
 * holds the reference, not the content. The `ref` field is a free-form URL
 * or scheme-prefixed identifier (e.g. "file:/path", "git:sha", "url:...").
 */
export interface Artifact {
  id: string;
  taskId: string;
  kind: string;
  title: string;
  ref: string;
  createdByAttemptId: string;
  createdAt: number;
  checksum?: string;
  version?: number;
}

export interface CreateArtifactInput {
  taskId: string;
  kind: string;
  title: string;
  ref: string;
  createdByAttemptId: string;
  checksum?: string;
  version?: number;
}
