import { join } from "node:path";
import {
  createWorkspace,
  createWiredLoop,
  createAgentTools,
  loadWorkspaceDef,
  toWorkspaceConfig,
  resolveConnections,
} from "@agent-worker/workspace";
import type { Workspace, WorkspaceAgentLoop, ResolvedAgent } from "@agent-worker/workspace";
import type { AgentLoop } from "@agent-worker/agent";
import type { EventBus } from "@agent-worker/shared";
import type { CreateWorkspaceInput, ManagedWorkspaceInfo } from "./types.ts";
import { ManagedWorkspace } from "./managed-workspace.ts";

const DEFAULT_GLOBAL_CONFIG = `\
agents:
  default: {}
storage: file
`;

/** Fallback config when runtime auto-discovery fails (no CLI / no API key). */
const FALLBACK_GLOBAL_CONFIG = `\
agents: {}
storage: file
`;

/**
 * WorkspaceRegistry manages workspace lifecycle within the daemon.
 * Includes a lazy-created default "global" workspace.
 *
 * Emits structured events to the shared EventBus.
 */
export class WorkspaceRegistry {
  private workspaces = new Map<string, ManagedWorkspace>();
  private _bus?: EventBus;
  private _defaultWorkspace: ManagedWorkspace | null = null;
  private _dataDir: string;

  constructor(dataDir: string) {
    this._dataDir = dataDir;
  }

  /** Set the shared event bus. */
  setBus(bus: EventBus): void {
    this._bus = bus;
  }

  /** Emit a workspace-scoped event to the bus. */
  private emitEvent(type: string, data: Record<string, unknown>): void {
    this._bus?.emit({ type, source: "workspace", ...data });
  }

  /** Compute the storage directory for a workspace key. */
  private workspaceDir(key: string): string {
    const dirName = key.replace(/:/g, "--");
    return join(this._dataDir, "workspaces", dirName);
  }

  /** Get or create the default global workspace (for standalone agents). */
  async ensureDefault(): Promise<ManagedWorkspace> {
    if (this._defaultWorkspace) return this._defaultWorkspace;

    const globalDir = join(this._dataDir, "workspaces", "_global");
    const configPath = join(globalDir, "config.yml");

    // Try config.yml first, then inline YAML default.
    // Name is inferred from directory "_global" → "global".
    let resolved;
    try {
      resolved = await loadWorkspaceDef(configPath);
    } catch {
      // No config.yml or runtime discovery failed — use fallback
      try {
        resolved = await loadWorkspaceDef(DEFAULT_GLOBAL_CONFIG, { name: "global" });
      } catch {
        resolved = await loadWorkspaceDef(FALLBACK_GLOBAL_CONFIG, {
          name: "global",
          skipSetup: true,
        });
      }
    }
    const config = toWorkspaceConfig(resolved, {
      storageDir: globalDir,
    });
    const workspace = await createWorkspace(config);

    this._defaultWorkspace = new ManagedWorkspace({
      workspace,
      resolved,
      loops: [],
      bus: this._bus,
      statusPath: join(globalDir, "status.json"),
    });

    return this._defaultWorkspace;
  }

  /** Create a workspace from YAML source. */
  async create(input: CreateWorkspaceInput): Promise<ManagedWorkspace> {
    const resolved = await loadWorkspaceDef(input.source, {
      tag: input.tag,
      vars: input.vars,
    });

    const key = input.tag ? `${resolved.def.name}:${input.tag}` : resolved.def.name;
    if (this.workspaces.has(key)) {
      throw new Error(`Workspace "${key}" already exists`);
    }

    // Use daemon-managed storage dir unless YAML explicitly specifies one
    const storageDir = resolved.def.storage_dir ? undefined : this.workspaceDir(key);
    const connections = await resolveConnections(resolved.def.connections);
    const config = toWorkspaceConfig(resolved, { tag: input.tag, storageDir, connections });
    const workspace = await createWorkspace(config);

    // Ensure sandbox directories exist and create loops for each agent
    const loops: WorkspaceAgentLoop[] = [];
    const { mkdirSync } = await import("node:fs");
    for (const agent of resolved.agents) {
      const { tools, dirs } = createAgentTools(agent.name, workspace);
      if (dirs.workspaceSandboxDir) mkdirSync(dirs.workspaceSandboxDir, { recursive: true });
      if (dirs.sandboxDir) mkdirSync(dirs.sandboxDir, { recursive: true });

      const runner = await this.createRunner(agent, workspace, resolved, key, tools);
      const loop = createWiredLoop({
        name: agent.name,
        instructions: agent.instructions,
        runtime: workspace,
        pollInterval: 2000,
        onInstruction: async (prompt, instruction) => {
          const runId = crypto.randomUUID();
          this.emitEvent("workspace.agent_run_start", {
            workspace: key,
            agent: agent.name,
            runId,
            instruction: instruction.content.slice(0, 200),
          });
          try {
            await runner(prompt, instruction);
            this.emitEvent("workspace.agent_run_end", {
              workspace: key,
              agent: agent.name,
              runId,
              status: "ok",
            });
          } catch (err) {
            this.emitEvent("workspace.agent_error", {
              workspace: key,
              agent: agent.name,
              runId,
              error: String(err),
              level: "error",
            });
          }
        },
      });
      loops.push(loop);
    }

    const actualStorageDir = storageDir ?? this.workspaceDir(key);
    const handle = new ManagedWorkspace({
      workspace,
      resolved,
      loops,
      tag: input.tag,
      mode: input.mode,
      bus: this._bus,
      statusPath: join(actualStorageDir, "status.json"),
    });

    this.workspaces.set(key, handle);

    this.emitEvent("workspace.created", {
      workspace: key,
      agents: resolved.agents.map((a) => a.name),
    });

    return handle;
  }

  /** Get a workspace by key ("name" or "name:tag"). */
  get(key: string): ManagedWorkspace | undefined {
    if (key === "global" && this._defaultWorkspace) return this._defaultWorkspace;
    return this.workspaces.get(key);
  }

  /** List all workspaces (including global). */
  list(): ManagedWorkspaceInfo[] {
    const result: ManagedWorkspaceInfo[] = [];
    if (this._defaultWorkspace) result.push(this._defaultWorkspace.info);
    for (const h of this.workspaces.values()) result.push(h.info);
    return result;
  }

  /** Stop and remove a workspace. */
  async remove(key: string): Promise<void> {
    const handle = this.workspaces.get(key);
    if (!handle) throw new Error(`Workspace "${key}" not found`);
    await handle.stop();
    this.workspaces.delete(key);
  }

  /** Stop all workspaces (including default). */
  async stopAll(): Promise<void> {
    const handles = Array.from(this.workspaces.values());
    await Promise.all(handles.map((h) => h.stop()));
    if (this._defaultWorkspace) {
      await this._defaultWorkspace.stop();
      this._defaultWorkspace = null;
    }
  }

  get size(): number {
    return this.workspaces.size + (this._defaultWorkspace ? 1 : 0);
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async createRunner(
    agent: ResolvedAgent,
    workspace: Workspace,
    resolved: import("@agent-worker/workspace").ResolvedWorkspace,
    workspaceKey: string,
    tools: import("@agent-worker/workspace").WorkspaceToolSet,
  ): Promise<
    (prompt: string, instruction: import("@agent-worker/workspace").Instruction) => Promise<void>
  > {
    return async (prompt, instruction) => {
      if (!agent.runtime || agent.runtime === "mock") {
        const channel = instruction.channel || (resolved.def.default_channel ?? "general");
        await workspace.contextProvider.smartSend(
          channel,
          agent.name,
          `[mock] Processed: ${instruction.content.slice(0, 100)}`,
        );
        return;
      }

      // For AI SDK runtimes, create a loop and run
      const loop = await this.createAgentLoop(agent);
      if (!loop) {
        throw new Error(`No loop available for runtime: ${agent.runtime}`);
      }

      if (loop.setTools) {
        // WorkspaceToolSet → ToolSet: workspace tools are plain functions
        // that get wrapped by the loop implementation.
        loop.setTools(tools as import("ai").ToolSet);
      }

      const run = loop.run(prompt);
      for await (const event of run) {
        if (event.type === "text") {
          this.emitEvent("workspace.agent_text", {
            workspace: workspaceKey,
            agent: agent.name,
            text: event.text.slice(0, 500),
          });
        }
      }

      const result = await run.result;
      // Post final response to channel if not handled by tools
      const textEvents =
        result.events?.filter((e): e is { type: "text"; text: string } => e.type === "text") ?? [];
      if (textEvents.length > 0) {
        const text = textEvents.map((e) => e.text).join("");
        if (text.length > 0) {
          const channel = instruction.channel || (resolved.def.default_channel ?? "general");
          await workspace.contextProvider.smartSend(channel, agent.name, text);
        }
      }
    };
  }

  private async createAgentLoop(agent: ResolvedAgent): Promise<AgentLoop | null> {
    if (!agent.runtime || agent.runtime === "mock") return null;
    if (!agent.model && agent.runtime === "ai-sdk") return null;

    const { createLoopFromConfig } = await import("./loop-factory.ts");
    return createLoopFromConfig({
      type: agent.runtime as import("./types.ts").RuntimeType,
      model: agent.model?.full,
      instructions: agent.instructions,
      env: agent.env,
    });
  }
}
