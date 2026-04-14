import { writeFileSync } from "node:fs";
import type { Workspace } from "@agent-worker/workspace";
import type { ResolvedWorkspace } from "@agent-worker/workspace";
import { removeWorktree } from "@agent-worker/workspace";
import type { Attempt } from "@agent-worker/workspace";
import type { WorkspaceOrchestrator } from "./orchestrator.ts";
import type { EventBus } from "@agent-worker/shared";
import type {
  ManagedWorkspaceInfo,
  WorkspaceMode,
  WorkspaceStatus,
  WorkspaceOverviewEventType,
} from "./types.ts";

/**
 * ManagedWorkspace wraps a Workspace + its agent loops with lifecycle management.
 */
export class ManagedWorkspace {
  readonly name: string;
  readonly tag?: string;
  readonly createdAt: number;
  readonly mode: WorkspaceMode;

  readonly workspace: Workspace;
  readonly resolved: ResolvedWorkspace;
  readonly loops: WorkspaceOrchestrator[];

  private _bus?: EventBus;
  private _status: WorkspaceStatus = "running";
  private _statusPath?: string;
  private _onDemandAgents: Set<string>;
  private _mentionListener: ((msg: import("@agent-worker/workspace").Message) => void) | null =
    null;
  /**
   * Per-agent baseline runner scope: the sandbox cwd and the
   * static `allowedPaths` set captured at workspace-create
   * time. Phase-1 v3 worktrees override `cwd` per-run inside
   * the runner closure based on the agent's active attempt;
   * this snapshot is the "no active attempt" state and remains
   * useful for debug + tests. `worktreePath` is always
   * undefined here — runtime worktrees never appear in the
   * static snapshot.
   */
  private readonly _agentScopes: ReadonlyMap<
    string,
    { cwd: string | undefined; allowedPaths: readonly string[]; worktreePath?: string }
  >;
  /**
   * Disposers to run on `stop()` — currently the
   * `attempt.terminal` event subscription installed by
   * workspace-registry. Kept generic so future per-workspace
   * subscriptions can register here too.
   */
  private readonly _onDispose: Array<() => void>;

  constructor(opts: {
    workspace: Workspace;
    resolved: ResolvedWorkspace;
    loops: WorkspaceOrchestrator[];
    tag?: string;
    mode?: WorkspaceMode;
    bus?: EventBus;
    /** Path to status.json for persistence. */
    statusPath?: string;
    /** Per-agent runner scope for inspection by debug + tests. */
    agentScopes?: Record<
      string,
      { cwd: string | undefined; allowedPaths: readonly string[]; worktreePath?: string }
    >;
    /**
     * Optional disposer(s) to run on `stop()`. Used by
     * workspace-registry to unsubscribe its
     * `attempt.terminal` listener so the closure doesn't leak
     * across restart cycles.
     */
    onDispose?: (() => void) | Array<() => void>;
  }) {
    this.name = opts.resolved.def.name;
    this.tag = opts.tag;
    this.mode = opts.mode ?? "service";
    this.createdAt = Date.now();
    this.workspace = opts.workspace;
    this.resolved = opts.resolved;
    this.loops = opts.loops;
    this._bus = opts.bus;
    this._statusPath = opts.statusPath;
    this._onDemandAgents = new Set(
      opts.resolved.agents.filter((a) => a.on_demand).map((a) => a.name),
    );
    this._agentScopes = new Map(Object.entries(opts.agentScopes ?? {}));
    this._onDispose = Array.isArray(opts.onDispose)
      ? [...opts.onDispose]
      : opts.onDispose
        ? [opts.onDispose]
        : [];
    this._persistStatus();
  }

  /**
   * Return the baseline runner scope (sandbox cwd +
   * `allowedPaths`) captured for an agent at workspace-create
   * time. Phase-1 v3 worktrees attach to attempts at runtime
   * and are NOT reflected here — query the state store for
   * the agent's active attempt to see runtime worktrees.
   * Undefined when the agent name is unknown.
   */
  agentRunnerScope(
    agentName: string,
  ):
    | { cwd: string | undefined; allowedPaths: readonly string[]; worktreePath?: string }
    | undefined {
    return this._agentScopes.get(agentName);
  }

  /** Unique key: "name" or "name:tag". */
  get key(): string {
    return this.tag ? `${this.name}:${this.tag}` : this.name;
  }

  get status(): WorkspaceStatus {
    return this._status;
  }

  get defaultChannel(): string {
    return this.resolved.def.default_channel ?? "general";
  }

  get info(): ManagedWorkspaceInfo {
    const channels = this.workspace.contextProvider.channels.listChannels();
    return {
      name: this.name,
      label: this.resolved.def.label,
      tag: this.tag,
      agents: this.resolved.agents.map((a) => a.name),
      channels,
      default_channel: this.defaultChannel,
      createdAt: this.createdAt,
      mode: this.mode,
      status: this._status,
    };
  }

  /** Start all agent loops (skips on_demand agents). */
  async startLoops(): Promise<void> {
    for (const loop of this.loops) {
      if (this._onDemandAgents.has(loop.name)) continue;
      await loop.start();
    }

    if (this._onDemandAgents.size > 0) {
      this._mentionListener = (msg) => {
        for (const mention of msg.mentions) {
          if (this._onDemandAgents.has(mention)) {
            const loop = this.loops.find((l) => l.name === mention);
            if (loop && !loop.isRunning) {
              loop.start().catch(() => {
                /* best effort */
              });
            }
          }
        }
      };
      this.workspace.contextProvider.channels.on("message", this._mentionListener);
    }
  }

  /** Send kickoff message to default channel. */
  async kickoff(): Promise<void> {
    if (!this.resolved.kickoff) return;
    const channel = this.resolved.def.default_channel ?? "general";
    const content = this.resolved.kickoff;

    // Phase 2c: materialise the kickoff as a draft Task so the lead can
    // pick it up from the task ledger rather than re-parsing the channel
    // message. The channel send still runs so the existing intake flow
    // keeps working during the migration.
    const lead = this.resolved.agents.find((a) => a.role === "lead")?.name;
    try {
      const task = await this.workspace.stateStore.createTask({
        workspaceId: this.workspace.name,
        title: content.split("\n")[0]?.slice(0, 120) ?? "Kickoff",
        goal: content,
        status: "draft",
        ownerLeadId: lead,
        sourceRefs: [
          {
            kind: "kickoff",
            ref: channel,
            excerpt: content.slice(0, 200),
            ts: Date.now(),
          },
        ],
      });
      // Chronicle the auto-draft so the workspace timeline shows the
      // intake step the same way it shows subsequent task transitions.
      // Best-effort — a chronicle failure never blocks kickoff.
      try {
        await this.workspace.contextProvider.chronicle.append({
          author: "system",
          category: "task",
          content: `task_create [${task.id}] [draft]: ${task.title} (auto from kickoff on #${channel})`,
        });
      } catch {
        /* chronicle is observational */
      }
    } catch (err) {
      // Kickoff must not fail because of state store plumbing. Swallow and
      // emit a diagnostic event — the channel send below still carries the
      // work forward.
      this.emitOverviewEvent("workspace.kickoff_task_failed", {
        workspace: this.key,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await this.workspace.contextProvider.send({
      channel,
      from: "user",
      content,
    });
    this.emitOverviewEvent("workspace.kickoff", {
      workspace: this.key,
      channel,
      content: content.slice(0, 200),
    });
  }

  /** Send a message to a channel. */
  async send(channel: string, from: string, content: string): Promise<void> {
    await this.workspace.contextProvider.send({ channel, from, content });
  }

  /**
   * Check if all local agents are idle with no queued or inbox work.
   * Returns "completed" if drained, "failed" if any loop failed fatally, "running" otherwise.
   */
  async checkCompletion(): Promise<WorkspaceStatus> {
    if (this.loops.some((l) => l.isFailed)) return "failed";

    const agentNames = new Set(this.resolved.agents.map((a) => a.name));
    const statuses = await this.workspace.contextProvider.status.getAll();
    const allIdle = statuses
      .filter((entry) => agentNames.has(entry.name))
      .every((entry) => entry.status === "idle");
    if (!allIdle) return "running";

    const queued = this.workspace.instructionQueue
      .listAll()
      .some((instruction) => agentNames.has(instruction.agentName));
    if (queued) return "running";

    for (const agentName of agentNames) {
      const inboxEntries = await this.workspace.contextProvider.inbox.inspect(agentName);
      if (inboxEntries.length > 0) return "running";
    }

    return "completed";
  }

  /** Persist current status to status.json. */
  private _persistStatus(): void {
    if (!this._statusPath) return;
    const data = {
      workspace: this.key,
      status: this._status,
      agents: this.resolved.agents.map((a) => ({
        name: a.name,
        runtime: a.runtime ?? "mock",
      })),
      updatedAt: Date.now(),
    };
    try {
      writeFileSync(this._statusPath, JSON.stringify(data, null, 2) + "\n");
    } catch {
      /* best effort */
    }
  }

  /** Mark this workspace as completed or failed. */
  complete(status: "completed" | "failed"): void {
    this._status = status;
    this._persistStatus();
    this.emitOverviewEvent(`workspace.${status}`, { workspace: this.key });
  }

  /** Stop this workspace and all its loops. */
  async stop(): Promise<void> {
    if (this._mentionListener) {
      this.workspace.contextProvider.channels.off("message", this._mentionListener);
      this._mentionListener = null;
    }
    for (const loop of this.loops) {
      if (loop.isRunning) {
        await loop.stop();
      }
    }

    // Phase-1 v3 worktree cleanup: walk every non-terminal
    // attempt (the `attempt.terminal` listener has already
    // cleaned the rest) and remove each worktree manually
    // before `workspace.shutdown()`. This catches workspaces
    // stopped while attempts were still running — e.g.
    // `aw rm @ws` mid-task.
    try {
      const attempts = await this.workspace.stateStore.listAllAttempts();
      const nonTerminal: Attempt[] = attempts.filter(
        (a) => a.status === "running" && a.worktrees && a.worktrees.length > 0,
      );
      for (const attempt of nonTerminal) {
        for (const wt of attempt.worktrees ?? []) {
          try {
            await removeWorktree(wt.repoPath, wt.path);
          } catch (err) {
            console.error(
              `[workspace ${this.key}] failed to remove worktree ${wt.path}:`,
              err instanceof Error ? err.message : err,
            );
          }
        }
      }
    } catch (err) {
      console.error(
        `[workspace ${this.key}] worktree sweep on stop failed:`,
        err instanceof Error ? err.message : err,
      );
    }

    // Run any registered disposers (e.g. unsubscribe from the
    // state store's attempt.terminal listener so the closure
    // doesn't leak across restart cycles).
    for (const dispose of this._onDispose) {
      try {
        dispose();
      } catch (err) {
        console.error(
          `[workspace ${this.key}] dispose hook failed:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    await this.workspace.shutdown();
    this.emitOverviewEvent("workspace.stopped", { workspace: this.key });
  }

  private emitOverviewEvent(type: WorkspaceOverviewEventType, data: Record<string, unknown>): void {
    this._bus?.emit({ type, source: "workspace", ...data });
  }
}
