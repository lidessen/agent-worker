import { join } from "node:path";
import {
  createWorkspace,
  createWiredLoop,
  createAgentTools,
  loadWorkspaceDef,
  toWorkspaceConfig,
  resolveConnections,
  discoverCliRuntime,
  detectAiSdkModel,
  WORKSPACE_TOOL_DEFS,
} from "@agent-worker/workspace";
import type { Workspace, WorkspaceAgentLoop, ResolvedAgent, WorkspaceToolSet } from "@agent-worker/workspace";
import type { AgentLoop } from "@agent-worker/agent";
import type { EventBus } from "@agent-worker/shared";
import type { CreateWorkspaceInput, ManagedWorkspaceInfo } from "./types.ts";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { ManagedWorkspace } from "./managed-workspace.ts";

/** Fallback config when no runtime can be discovered. */
const EMPTY_GLOBAL_CONFIG = `\
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

  /** Compute the data directory for a workspace key. */
  private workspaceDir(key: string): string {
    const dirName = key.replace(/:/g, "--");
    return join(this._dataDir, "workspace-data", dirName);
  }

  /** Get or create the default global workspace (for standalone agents). */
  async ensureDefault(): Promise<ManagedWorkspace> {
    if (this._defaultWorkspace) return this._defaultWorkspace;

    const configPath = join(this._dataDir, "workspaces", "_global.yml");
    const globalDir = this.workspaceDir("global");

    // Try _global.yml first, then auto-discover a runtime and build config dynamically.
    // Only fall back if the config file doesn't exist — surface parse/permission errors.
    let resolved;
    try {
      resolved = await loadWorkspaceDef(configPath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("not found")) {
        // Config file exists but failed to load — surface the error
        throw err;
      }
      // No config file — discover available runtime and build config
      const globalConfig = await this.buildGlobalConfig();
      resolved = await loadWorkspaceDef(globalConfig, {
        name: "global",
        skipSetup: true,
      });
    }
    const config = toWorkspaceConfig(resolved, {
      storageDir: globalDir,
    });
    const workspace = await createWorkspace(config);

    // Create workspace loops for each agent (mirrors create() logic)
    const loops: WorkspaceAgentLoop[] = [];
    for (const agent of resolved.agents) {
      if (!agent.runtime) continue;
      const { tools } = createAgentTools(agent.name, workspace);
      const runner = await this.createRunner(agent, workspace, resolved, "global", tools);
      const loop = createWiredLoop({
        name: agent.name,
        instructions: agent.instructions,
        runtime: workspace,
        pollInterval: 2000,
        onInstruction: async (prompt, instruction) => {
          const runId = crypto.randomUUID();
          this.emitEvent("workspace.agent_run_start", {
            workspace: "global",
            agent: agent.name,
            runId,
            runtime: agent.runtime,
            model: agent.model?.full,
            instruction: instruction.content.slice(0, 200),
          });
          this.emitEvent("workspace.agent_prompt", {
            workspace: "global",
            agent: agent.name,
            runId,
            prompt: prompt.slice(0, 2000),
            promptLength: prompt.length,
            level: "debug",
          });
          try {
            await runner(prompt, instruction);
            this.emitEvent("workspace.agent_run_end", {
              workspace: "global",
              agent: agent.name,
              runId,
              status: "ok",
            });
          } catch (err) {
            this.emitEvent("workspace.agent_error", {
              workspace: "global",
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

    this._defaultWorkspace = new ManagedWorkspace({
      workspace,
      resolved,
      loops,
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
      name: input.name,
    });
    // CLI sends YAML content (not file path), so configDir won't be set by
    // loadWorkspaceDef. Patch it from the input so relative data_dir resolves
    // against the original config file location.
    if (input.configDir && !resolved.configDir) {
      resolved.configDir = input.configDir;
    }

    const key = input.tag ? `${resolved.def.name}:${input.tag}` : resolved.def.name;
    if (this.workspaces.has(key)) {
      throw new Error(`Workspace "${key}" already exists`);
    }

    // Use daemon-managed data dir unless YAML explicitly specifies one
    const storageDir = resolved.def.data_dir ? undefined : this.workspaceDir(key);
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
            runtime: agent.runtime,
            model: agent.model?.full,
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

  /**
   * Build the global workspace YAML config dynamically by discovering
   * available runtimes. Agent names match the discovered runtime
   * (e.g. "claude-code", "ai-sdk") instead of a generic "default".
   */
  private async buildGlobalConfig(): Promise<string> {
    // Try CLI discovery first (preferred)
    const cli = await discoverCliRuntime();
    if (cli) {
      return `agents:\n  ${cli.runtime}:\n    runtime: ${cli.runtime}\nstorage: file\n`;
    }

    // Fall back to AI SDK with auto-detected model
    const model = detectAiSdkModel();
    if (model) {
      return `agents:\n  ai-sdk:\n    runtime: ai-sdk\n    model: ${model}\nstorage: file\n`;
    }

    // Nothing available — empty agents
    return EMPTY_GLOBAL_CONFIG;
  }

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

      const aiSdkTools = wrapWorkspaceToolsForAiSdk(tools);
      if (loop.setTools) {
        loop.setTools(aiSdkTools);
      }

      this.emitEvent("workspace.agent_tools", {
        workspace: workspaceKey,
        agent: agent.name,
        runtime: agent.runtime,
        model: agent.model?.full,
        tools: Object.keys(aiSdkTools),
        level: "debug",
      });

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

      await run.result;
    };
  }

  private async createAgentLoop(agent: ResolvedAgent): Promise<AgentLoop | null> {
    if (!agent.runtime || agent.runtime === "mock") return null;
    if (!agent.model && agent.runtime === "ai-sdk") return null;

    const { createLoopFromConfig } = await import("./loop-factory.ts");
    // Don't pass instructions here — WorkspaceAgentLoop already includes them
    // in the assembled prompt via soulSection. Passing them here would cause
    // the model to see instructions twice (system prompt + user message).
    return createLoopFromConfig({
      type: agent.runtime as import("./types.ts").RuntimeType,
      model: agent.model?.full,
      env: agent.env,
    });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** JSON-schema type → zod schema (only string/number/boolean — covers all workspace tool params). */
function jsonTypeToZod(param: { type: string; description?: string }): z.ZodTypeAny {
  switch (param.type) {
    case "number":
      return z.number().describe(param.description ?? "");
    case "boolean":
      return z.boolean().describe(param.description ?? "");
    default:
      return z.string().describe(param.description ?? "");
  }
}

/**
 * Wrap workspace tools (plain functions) + WORKSPACE_TOOL_DEFS (JSON-schema metadata)
 * into proper AI SDK tools with zod parameter schemas.
 */
function wrapWorkspaceToolsForAiSdk(wsTools: WorkspaceToolSet): ToolSet {
  const result: ToolSet = {};
  const defs = WORKSPACE_TOOL_DEFS as Record<
    string,
    { description: string; parameters: Record<string, { type: string; description?: string }>; required: string[] }
  >;

  for (const [name, fn] of Object.entries(wsTools)) {
    const def = defs[name];
    if (!def) continue;

    // Build zod object schema from JSON-schema params
    const shape: Record<string, z.ZodTypeAny> = {};
    const required = new Set(def.required);
    for (const [key, param] of Object.entries(def.parameters)) {
      const base = jsonTypeToZod(param);
      shape[key] = required.has(key) ? base : base.optional();
    }

    result[name] = tool({
      description: def.description,
      inputSchema: z.object(shape),
      execute: async (args) => fn(args as Record<string, unknown>),
    });
  }

  return result;
}
