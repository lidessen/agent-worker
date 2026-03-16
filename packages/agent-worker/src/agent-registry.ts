import { join } from "node:path";
import type { AgentConfig } from "@agent-worker/agent";
import type { EventBus } from "@agent-worker/shared";
import type { CreateAgentInput, ManagedAgentInfo } from "./types.ts";
import { ManagedAgent } from "./managed-agent.ts";
import { GlobalAgentStub } from "./global-agent-stub.ts";

/** Common handle type returned by the registry. */
export type AgentHandle = ManagedAgent | GlobalAgentStub;

/**
 * AgentRegistry manages agent lifecycle within the daemon.
 * Agents can be config-loaded or ephemeral (created via API).
 *
 * Storage is scoped by workspace:
 * - Global agents  → `<dataDir>/agents/<name>/`
 * - Workspace agents → `<dataDir>/workspaces/<wsKey>/agents/<name>/`
 *
 * Agents emit structured events to the shared EventBus.
 */
export class AgentRegistry {
  private agents = new Map<string, AgentHandle>();
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

  /** Validate a path segment to prevent directory traversal. */
  private static validateSegment(value: string, label: string): void {
    if (!value || value.includes("..") || value.includes("/") || value.includes("\\")) {
      throw new Error(`Invalid ${label}: "${value}" contains path traversal characters`);
    }
  }

  /** Compute the storage directory for an agent based on its workspace scope. */
  private agentDir(name: string, workspace?: string): string | undefined {
    if (!this._dataDir) return undefined;
    AgentRegistry.validateSegment(name, "agent name");
    if (workspace) {
      // Workspace-scoped: workspace-data/<key>/agents/<name>
      const wsDir = workspace.replace(/:/g, "--");
      AgentRegistry.validateSegment(wsDir, "workspace key");
      return join(this._dataDir, "workspace-data", wsDir, "agents", name);
    }
    // Global: agents/<name>
    return join(this._dataDir, "agents", name);
  }

  /** Create and register a new agent with a full Agent/Loop. */
  async create(input: CreateAgentInput): Promise<ManagedAgent> {
    if (this.agents.has(input.name)) {
      throw new Error(`Agent "${input.name}" already exists`);
    }

    if (!input.config && !input.loop) {
      throw new Error(`Agent "${input.name}": either config or loop is required`);
    }

    const config: AgentConfig = input.config ?? {
      name: input.name,
      instructions: input.instructions,
      loop: input.loop!,
    };

    const handle = new ManagedAgent({
      name: input.name,
      kind: input.kind ?? "ephemeral",
      runtime: input.runtime,
      config,
      workspace: input.workspace,
      bus: this._bus,
      agentDir: this.agentDir(input.name, input.workspace),
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

  /**
   * Register a lightweight stub for a global workspace agent.
   * No Agent/Loop is created — the workspace handles execution.
   */
  registerGlobal(name: string, opts?: { runtime?: string; getState?: () => import("@agent-worker/agent").AgentState }): GlobalAgentStub {
    if (this.agents.has(name)) {
      throw new Error(`Agent "${name}" already exists`);
    }

    const stub = new GlobalAgentStub({ name, runtime: opts?.runtime, getState: opts?.getState });
    this.agents.set(name, stub);

    this._bus?.emit({
      type: "agent.created",
      source: "daemon",
      agent: name,
      kind: "config",
    });

    return stub;
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
