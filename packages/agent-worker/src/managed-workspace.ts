import { writeFileSync } from "node:fs";
import type { Workspace } from "@agent-worker/workspace";
import type { ResolvedWorkspace } from "@agent-worker/workspace";
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
  private _mentionListener: ((msg: import("@agent-worker/workspace").Message) => void) | null = null;

  constructor(opts: {
    workspace: Workspace;
    resolved: ResolvedWorkspace;
    loops: WorkspaceOrchestrator[];
    tag?: string;
    mode?: WorkspaceMode;
    bus?: EventBus;
    /** Path to status.json for persistence. */
    statusPath?: string;
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
    this._persistStatus();
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
              loop.start().catch(() => {/* best effort */});
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
    await this.workspace.contextProvider.send({
      channel,
      from: "user",
      content: this.resolved.kickoff,
    });
    this.emitOverviewEvent("workspace.kickoff", {
      workspace: this.key,
      channel,
      content: this.resolved.kickoff.slice(0, 200),
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

    const queued = this.workspace.instructionQueue.listAll()
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
    await this.workspace.shutdown();
    this.emitOverviewEvent("workspace.stopped", { workspace: this.key });
  }

  private emitOverviewEvent(
    type: WorkspaceOverviewEventType,
    data: Record<string, unknown>,
  ): void {
    this._bus?.emit({ type, source: "workspace", ...data });
  }
}
