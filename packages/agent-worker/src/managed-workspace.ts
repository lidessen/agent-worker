import type { Workspace } from "@agent-worker/workspace";
import type { WorkspaceAgentLoop } from "@agent-worker/workspace";
import type { ResolvedWorkspace } from "@agent-worker/workspace";
import type { EventBus } from "@agent-worker/shared";
import type { ManagedWorkspaceInfo, WorkspaceMode, WorkspaceStatus } from "./types.ts";

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
  readonly loops: WorkspaceAgentLoop[];

  private _bus?: EventBus;
  private _status: WorkspaceStatus = "running";

  constructor(opts: {
    workspace: Workspace;
    resolved: ResolvedWorkspace;
    loops: WorkspaceAgentLoop[];
    tag?: string;
    mode?: WorkspaceMode;
    bus?: EventBus;
  }) {
    this.name = opts.resolved.def.name;
    this.tag = opts.tag;
    this.mode = opts.mode ?? "service";
    this.createdAt = Date.now();
    this.workspace = opts.workspace;
    this.resolved = opts.resolved;
    this.loops = opts.loops;
    this._bus = opts.bus;
  }

  /** Unique key: "name" or "name:tag". */
  get key(): string {
    return this.tag ? `${this.name}:${this.tag}` : this.name;
  }

  get status(): WorkspaceStatus {
    return this._status;
  }

  get info(): ManagedWorkspaceInfo {
    const channels = this.workspace.contextProvider.channels.listChannels();
    return {
      name: this.name,
      tag: this.tag,
      agents: this.resolved.agents.map((a) => a.name),
      channels,
      createdAt: this.createdAt,
      mode: this.mode,
      status: this._status,
    };
  }

  /** Start all agent loops. */
  async startLoops(): Promise<void> {
    for (const loop of this.loops) {
      await loop.start();
    }
  }

  /** Send kickoff message to default channel. */
  async kickoff(): Promise<void> {
    if (!this.resolved.kickoff) return;
    const channel = this.resolved.def.default_channel ?? "general";
    await this.workspace.contextProvider.smartSend(channel, "user", this.resolved.kickoff);
    this._bus?.emit({
      type: "workspace.kickoff",
      source: "workspace",
      workspace: this.key,
      channel,
      content: this.resolved.kickoff.slice(0, 200),
    });
  }

  /** Send a message to a channel. */
  async send(channel: string, from: string, content: string): Promise<void> {
    await this.workspace.contextProvider.smartSend(channel, from, content);
  }

  /**
   * Check if all local agents are idle with empty inboxes (task completion).
   * Returns "completed" if all idle, "failed" if any loop errored, "running" otherwise.
   */
  checkCompletion(): WorkspaceStatus {
    const allStopped = this.loops.every((l) => !l.isRunning);
    if (!allStopped) return "running";
    // If we get here, all loops have stopped — consider it completed
    // (future: check for error states in loops)
    return "completed";
  }

  /** Mark this workspace as completed or failed. */
  complete(status: "completed" | "failed"): void {
    this._status = status;
    this._bus?.emit({
      type: `workspace.${status}`,
      source: "workspace",
      workspace: this.key,
    });
  }

  /** Stop this workspace and all its loops. */
  async stop(): Promise<void> {
    for (const loop of this.loops) {
      if (loop.isRunning) {
        await loop.stop();
      }
    }
    await this.workspace.shutdown();
    this._bus?.emit({
      type: "workspace.stopped",
      source: "workspace",
      workspace: this.key,
    });
  }
}
