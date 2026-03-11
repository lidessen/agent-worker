import type { Workspace } from "@agent-worker/workspace";
import type { WorkspaceAgentLoop } from "@agent-worker/workspace";
import type { ResolvedWorkspace } from "@agent-worker/workspace";
import type { ManagedWorkspaceInfo, DaemonEvent } from "./types.ts";

/**
 * ManagedWorkspace wraps a Workspace + its agent loops with lifecycle management.
 */
export class ManagedWorkspace {
  readonly name: string;
  readonly tag?: string;
  readonly createdAt: number;

  readonly workspace: Workspace;
  readonly resolved: ResolvedWorkspace;
  readonly loops: WorkspaceAgentLoop[];

  private _onEvent?: (event: DaemonEvent) => void;

  constructor(opts: {
    workspace: Workspace;
    resolved: ResolvedWorkspace;
    loops: WorkspaceAgentLoop[];
    tag?: string;
    onEvent?: (event: DaemonEvent) => void;
  }) {
    this.name = opts.resolved.def.name;
    this.tag = opts.tag;
    this.createdAt = Date.now();
    this.workspace = opts.workspace;
    this.resolved = opts.resolved;
    this.loops = opts.loops;
    this._onEvent = opts.onEvent;
  }

  /** Unique key: "name" or "name:tag". */
  get key(): string {
    return this.tag ? `${this.name}:${this.tag}` : this.name;
  }

  get info(): ManagedWorkspaceInfo {
    const channels = this.workspace.contextProvider.channels.listChannels();
    return {
      name: this.name,
      tag: this.tag,
      agents: this.resolved.agents.map((a) => a.name),
      channels,
      createdAt: this.createdAt,
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
    this._onEvent?.({
      ts: Date.now(),
      type: "workspace_kickoff",
      workspace: this.key,
      channel,
      content: this.resolved.kickoff.slice(0, 200),
    });
  }

  /** Send a message to a channel. */
  async send(channel: string, from: string, content: string): Promise<void> {
    await this.workspace.contextProvider.smartSend(channel, from, content);
  }

  /** Stop this workspace and all its loops. */
  async stop(): Promise<void> {
    for (const loop of this.loops) {
      if (loop.isRunning) {
        await loop.stop();
      }
    }
    await this.workspace.shutdown();
    this._onEvent?.({
      ts: Date.now(),
      type: "workspace_stopped",
      workspace: this.key,
    });
  }
}
