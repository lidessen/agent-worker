import type { AgentConfig } from "@agent-worker/agent";
import type { EventBus } from "@agent-worker/shared";
import type { CreateAgentInput, ManagedAgentInfo } from "./types.ts";
import { ManagedAgent } from "./managed-agent.ts";

/**
 * AgentRegistry manages agent lifecycle within the daemon.
 * Agents can be config-loaded or ephemeral (created via API).
 *
 * Agents emit structured events to the shared EventBus.
 */
export class AgentRegistry {
  private agents = new Map<string, ManagedAgent>();
  private _bus?: EventBus;
  private _dataDir?: string;

  /** Set the shared event bus. Agents created after this call will use it. */
  setBus(bus: EventBus): void {
    this._bus = bus;
  }

  /** Set the data directory for per-agent storage. */
  setDataDir(dataDir: string): void {
    this._dataDir = dataDir;
  }

  /** Create and register a new agent. */
  async create(input: CreateAgentInput): Promise<ManagedAgent> {
    if (this.agents.has(input.name)) {
      throw new Error(`Agent "${input.name}" already exists`);
    }

    const config: AgentConfig = input.config ?? {
      name: input.name,
      instructions: input.instructions,
      loop: input.loop!,
    };

    const handle = new ManagedAgent({
      name: input.name,
      kind: input.kind ?? "ephemeral",
      config,
      bus: this._bus,
      dataDir: this._dataDir,
    });

    await handle.init();
    this.agents.set(input.name, handle);

    this._bus?.emit({
      type: "agent.created",
      source: "daemon",
      agent: input.name,
      kind: handle.kind,
    });

    return handle;
  }

  /** Get an agent by name. */
  get(name: string): ManagedAgent | undefined {
    return this.agents.get(name);
  }

  /** Check if an agent exists. */
  has(name: string): boolean {
    return this.agents.has(name);
  }

  /** List all agents. */
  list(): ManagedAgentInfo[] {
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

    this._bus?.emit({
      type: "agent.removed",
      source: "daemon",
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
