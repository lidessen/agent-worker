import { Agent } from "@agent-worker/agent";
import type { AgentConfig, AgentState } from "@agent-worker/agent";
import type { LoopEvent, LoopResult } from "@agent-worker/loop";
import type { EventBus } from "@agent-worker/shared";
import type { AgentKind, ManagedAgentInfo } from "./types.ts";

/**
 * ManagedAgent wraps an Agent instance with lifecycle metadata
 * and event forwarding for the daemon layer.
 *
 * The Agent emits structured events directly to the shared EventBus.
 */
export class ManagedAgent {
  readonly name: string;
  readonly kind: AgentKind;
  readonly createdAt: number;
  readonly agent: Agent;

  private _workspace?: string;

  constructor(opts: {
    name: string;
    kind: AgentKind;
    config: AgentConfig;
    workspace?: string;
    bus?: EventBus;
  }) {
    this.name = opts.name;
    this.kind = opts.kind;
    this.createdAt = Date.now();
    this._workspace = opts.workspace;

    // Inject bus into Agent config so it emits structured events directly
    const config: AgentConfig = {
      ...opts.config,
      name: opts.name,
      bus: opts.bus ?? opts.config.bus,
    };
    this.agent = new Agent(config);
  }

  async init(): Promise<void> {
    await this.agent.init();
  }

  async stop(): Promise<void> {
    if (this.agent.state !== "stopped") {
      await this.agent.stop();
    }
  }

  get state(): AgentState {
    return this.agent.state;
  }

  get info(): ManagedAgentInfo {
    return {
      name: this.name,
      kind: this.kind,
      state: this.state,
      createdAt: this.createdAt,
      workspace: this._workspace,
    };
  }

  /** Send a message to this agent's inbox. */
  push(message: { content: string; from?: string }): void {
    this.agent.push(message);
  }

  /**
   * Send a message and collect the text response.
   * Resolves when the agent finishes processing.
   */
  async run(message: string, from?: string): Promise<{ text: string; events: LoopEvent[] }> {
    const events: LoopEvent[] = [];
    const textParts: string[] = [];

    const handler = (event: LoopEvent) => {
      events.push(event);
      if (event.type === "text") {
        textParts.push(event.text);
      }
    };

    this.agent.on("event", handler);

    // Push message and wait for processing to complete
    this.agent.push({ content: message, from });

    // Wait for agent to finish processing
    await this.waitForIdle();

    this.agent.off("event", handler);

    return { text: textParts.join(""), events };
  }

  /** Wait until the agent returns to idle or waiting state. */
  private waitForIdle(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        const s = this.agent.state;
        if (s === "idle" || s === "waiting" || s === "stopped" || s === "error") {
          resolve();
          return;
        }
        // Poll state at short intervals
        setTimeout(check, 50);
      };
      // Give the agent a tick to start processing
      setTimeout(check, 50);
    });
  }
}
