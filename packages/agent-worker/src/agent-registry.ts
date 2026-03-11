import type { AgentConfig } from "@agent-worker/agent";
import type { CreateAgentInput, AgentHandleInfo, DaemonEvent } from "./types.ts";
import { AgentHandle } from "./agent-handle.ts";

/**
 * AgentRegistry manages agent lifecycle within the daemon.
 * Agents can be config-loaded or ephemeral (created via API).
 */
export class AgentRegistry {
  private agents = new Map<string, AgentHandle>();
  private _onEvent?: (event: DaemonEvent) => void;

  /** Set the event sink for all agents in this registry. */
  setEventSink(onEvent: (event: DaemonEvent) => void): void {
    this._onEvent = onEvent;
  }

  /** Create and register a new agent. */
  async create(input: CreateAgentInput): Promise<AgentHandle> {
    if (this.agents.has(input.name)) {
      throw new Error(`Agent "${input.name}" already exists`);
    }

    const config: AgentConfig = input.config ?? {
      name: input.name,
      instructions: input.instructions,
      loop: input.loop!,
    };

    const handle = new AgentHandle({
      name: input.name,
      kind: input.kind ?? "ephemeral",
      config,
    });

    if (this._onEvent) {
      handle.wireEvents(this._onEvent);
    }

    await handle.init();
    this.agents.set(input.name, handle);

    this._onEvent?.({
      ts: Date.now(),
      type: "agent_created",
      agent: input.name,
      kind: handle.kind,
    });

    return handle;
  }

  /** Get an agent by name. */
  get(name: string): AgentHandle | undefined {
    return this.agents.get(name);
  }

  /** Check if an agent exists. */
  has(name: string): boolean {
    return this.agents.has(name);
  }

  /** List all agents. */
  list(): AgentHandleInfo[] {
    return Array.from(this.agents.values()).map((h) => h.info);
  }

  /** Remove an agent. Only ephemeral agents can be removed via API. */
  async remove(name: string, force = false): Promise<void> {
    const handle = this.agents.get(name);
    if (!handle) {
      throw new Error(`Agent "${name}" not found`);
    }
    if (handle.kind === "config" && !force) {
      throw new Error(`Agent "${name}" is config-loaded; use force to remove`);
    }

    await handle.stop();
    this.agents.delete(name);

    this._onEvent?.({
      ts: Date.now(),
      type: "agent_removed",
      agent: name,
    });
  }

  /** Stop all agents. */
  async stopAll(): Promise<void> {
    const handles = Array.from(this.agents.values());
    await Promise.all(handles.map((h) => h.stop()));
  }

  get size(): number {
    return this.agents.size;
  }
}
