import type { AgentState } from "@agent-worker/agent";
import type { AgentKind, ManagedAgentInfo } from "./types.ts";

/**
 * Lightweight stub for global harness agents.
 *
 * Global agents are backed by HarnessAgentLoop — they don't need a real
 * Agent/AgentLoop. This stub provides just enough for the daemon's
 * AgentRegistry to list them and for route detection (instanceof check).
 */
export class GlobalAgentStub {
  readonly name: string;
  readonly kind: AgentKind;
  readonly runtime?: string;
  readonly createdAt: number;
  private _getState?: () => AgentState;

  constructor(opts: { name: string; runtime?: string; getState?: () => AgentState }) {
    this.name = opts.name;
    this.kind = "config";
    this.runtime = opts.runtime;
    this.createdAt = Date.now();
    this._getState = opts.getState;
  }

  get state(): AgentState {
    return this._getState?.() ?? "idle";
  }

  get info(): ManagedAgentInfo {
    return {
      name: this.name,
      kind: this.kind,
      state: this.state,
      runtime: this.runtime,
      createdAt: this.createdAt,
      harness: "global",
    };
  }

  async stop(): Promise<void> {
    // No-op — lifecycle is managed by the harness.
  }
}
