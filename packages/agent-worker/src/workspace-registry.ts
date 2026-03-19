import { join } from "node:path";
import { mkdirSync, appendFileSync, symlinkSync, existsSync } from "node:fs";
import {
  createWorkspace,
  createAgentTools,
  loadWorkspaceDef,
  toWorkspaceConfig,
  resolveConnections,
  WORKSPACE_TOOL_DEFS,
} from "@agent-worker/workspace";
import type { Workspace, ResolvedAgent, WorkspaceToolSet } from "@agent-worker/workspace";
import type { AgentLoop } from "@agent-worker/agent";
import { WorkspaceOrchestrator, createOrchestrator } from "./orchestrator.ts";
import { resolveRuntime, discoverCliRuntime, detectAiSdkModel } from "./resolve-runtime.ts";
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
  private _daemonUrl?: string;
  private _daemonToken?: string;
  private _mcpHubUrl?: string;

  constructor(dataDir: string) {
    this._dataDir = dataDir;
  }

  /** Set daemon connection info for CLI agent MCP proxying. */
  setDaemonInfo(url: string, token: string, mcpHubUrl?: string): void {
    this._daemonUrl = url;
    this._daemonToken = token;
    this._mcpHubUrl = mcpHubUrl;
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
      resolved = await loadWorkspaceDef(configPath, { resolveRuntime });
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
    // Lazy callbacks — workspace/loops don't exist yet, so we capture them in closures
    let workspaceRef: Workspace | null = null;
    let loopsRef: WorkspaceOrchestrator[] = [];
    const getAgents = async () => {
      if (!workspaceRef) return [];
      const members = await workspaceRef.contextProvider.status.getAll();
      return members.map((m) => ({ name: m.name, status: m.status, task: m.currentTask }));
    };
    const findLoop = (name: string) => {
      const loop = loopsRef.find((l) => l.name === name);
      if (!loop) throw new Error(`Agent "${name}" not found`);
      return loop;
    };
    const connections = await resolveConnections(resolved.def.connections, {
      getAgents,
      pauseAll: async () => { for (const l of loopsRef) await l.pause(); },
      resumeAll: async () => { for (const l of loopsRef) await l.resume(); },
      pauseAgent: async (name) => { await findLoop(name).pause(); },
      resumeAgent: async (name) => { await findLoop(name).resume(); },
    });
    const config = toWorkspaceConfig(resolved, {
      storageDir: globalDir,
      connections,
    });
    const workspace = await createWorkspace(config);
    workspaceRef = workspace;

    // Create workspace loops for each agent (mirrors create() logic)
    const loops: WorkspaceOrchestrator[] = loopsRef;
    for (const agent of resolved.agents) {
      if (!agent.runtime) continue;
      const { tools, promptSections, dirs } = createAgentTools(agent.name, workspace);
      if (dirs.workspaceSandboxDir) mkdirSync(dirs.workspaceSandboxDir, { recursive: true });
      if (dirs.sandboxDir) mkdirSync(dirs.sandboxDir, { recursive: true });
      // Create symlinks for agent mounts
      if (agent.mounts && dirs.sandboxDir) {
        for (const mount of agent.mounts) {
          const linkPath = join(dirs.sandboxDir, mount.target!);
          if (!existsSync(linkPath)) {
            symlinkSync(mount.source, linkPath);
          }
        }
      }
      const agentCwd = dirs.sandboxDir ?? dirs.workspaceSandboxDir;
      const runner = await this.createRunner(agent, workspace, resolved, "global", tools, {
        cwd: agentCwd,
        storageDir: globalDir,
      });
      const orch = createOrchestrator({
        name: agent.name,
        instructions: agent.instructions,
        provider: workspace.contextProvider,
        queue: workspace.instructionQueue,
        eventLog: workspace.eventLog,
        promptSections,
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
            prompt,
            level: "debug",
          });
          try {
            await runner(prompt, instruction, runId);
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
      loops.push(orch);
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
      resolveRuntime,
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
    let workspaceRef: Workspace | null = null;
    let loopsRef: WorkspaceOrchestrator[] = [];
    const getAgents = async () => {
      if (!workspaceRef) return [];
      const members = await workspaceRef.contextProvider.status.getAll();
      return members.map((m) => ({ name: m.name, status: m.status, task: m.currentTask }));
    };
    const findLoop = (name: string) => {
      const loop = loopsRef.find((l) => l.name === name);
      if (!loop) throw new Error(`Agent "${name}" not found`);
      return loop;
    };
    const connections = await resolveConnections(resolved.def.connections, {
      getAgents,
      pauseAll: async () => { for (const l of loopsRef) await l.pause(); },
      resumeAll: async () => { for (const l of loopsRef) await l.resume(); },
      pauseAgent: async (name) => { await findLoop(name).pause(); },
      resumeAgent: async (name) => { await findLoop(name).resume(); },
    });
    const config = toWorkspaceConfig(resolved, { tag: input.tag, storageDir, connections });
    const workspace = await createWorkspace(config);
    workspaceRef = workspace;

    // Ensure sandbox directories exist and create loops for each agent
    const loops: WorkspaceOrchestrator[] = loopsRef;
    for (const agent of resolved.agents) {
      const { tools, promptSections, dirs } = createAgentTools(agent.name, workspace);
      if (dirs.workspaceSandboxDir) mkdirSync(dirs.workspaceSandboxDir, { recursive: true });
      if (dirs.sandboxDir) mkdirSync(dirs.sandboxDir, { recursive: true });
      // Create symlinks for agent mounts
      if (agent.mounts && dirs.sandboxDir) {
        for (const mount of agent.mounts) {
          const linkPath = join(dirs.sandboxDir, mount.target!);
          if (!existsSync(linkPath)) {
            symlinkSync(mount.source, linkPath);
          }
        }
      }
      const agentCwd = dirs.sandboxDir ?? dirs.workspaceSandboxDir;
      const actualStorageDir = storageDir ?? this.workspaceDir(key);
      const runner = await this.createRunner(agent, workspace, resolved, key, tools, {
        cwd: agentCwd,
        storageDir: actualStorageDir,
      });
      const orch = createOrchestrator({
        name: agent.name,
        instructions: agent.instructions,
        provider: workspace.contextProvider,
        queue: workspace.instructionQueue,
        eventLog: workspace.eventLog,
        promptSections,
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
          this.emitEvent("workspace.agent_prompt", {
            workspace: key,
            agent: agent.name,
            runId,
            prompt,
            level: "debug",
          });
          try {
            await runner(prompt, instruction, runId);
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
      loops.push(orch);
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
    opts?: { cwd?: string; storageDir?: string },
  ): Promise<
    (
      prompt: string,
      instruction: import("@agent-worker/workspace").Instruction,
      runId: string,
    ) => Promise<void>
  > {
    // Per-agent runs directory for detailed logs
    const runsDir = opts?.storageDir
      ? join(opts.storageDir, "agents", agent.name, "runs")
      : undefined;

    // MCP config for CLI agents — generated lazily so _mcpHubUrl is available
    const isCliRuntime =
      agent.runtime === "claude-code" || agent.runtime === "codex" || agent.runtime === "cursor";
    let mcpConfigPath: string | undefined;

    return async (prompt, instruction, runId) => {
      // Generate MCP config on first run (deferred so hub URL is set)
      if (isCliRuntime && !mcpConfigPath && this._daemonUrl && this._daemonToken) {
        const { createWorkspaceMcpConfig } = await import("@agent-worker/workspace");
        const httpUrl =
          agent.runtime !== "claude-code" && this._mcpHubUrl
            ? `${this._mcpHubUrl}/mcp/${agent.name}`
            : undefined;
        const mcpConfig = await createWorkspaceMcpConfig(agent.name, agent.runtime!, {
          httpUrl,
          daemonUrl: this._daemonUrl,
          daemonToken: this._daemonToken,
          workspaceKey,
        });
        mcpConfigPath = mcpConfig.configPath;
      }
      if (!agent.runtime || agent.runtime === "mock") {
        const channel = instruction.channel || (resolved.def.default_channel ?? "general");
        await workspace.contextProvider.send({
          channel,
          from: agent.name,
          content: `[mock] Processed: ${instruction.content.slice(0, 100)}`,
        });
        return;
      }

      // For AI SDK runtimes, create a loop and run
      const loop = await this.createAgentLoop(agent, opts?.cwd);
      if (!loop) {
        throw new Error(`No loop available for runtime: ${agent.runtime}`);
      }

      const toolNames = Object.keys(tools);

      if (loop.setTools) {
        // AI SDK agents: inject tools directly
        const aiSdkTools = wrapWorkspaceToolsForAiSdk(tools);
        loop.setTools(aiSdkTools);
      }
      if (loop.setMcpConfig && mcpConfigPath) {
        // CLI agents: point to the pre-started workspace MCP server
        loop.setMcpConfig(mcpConfigPath);
      }

      this.emitEvent("workspace.agent_tools", {
        workspace: workspaceKey,
        agent: agent.name,
        runtime: agent.runtime,
        model: agent.model?.full,
        tools: toolNames,
        level: "debug",
      });

      // Create per-run log file
      const log = runsDir ? createRunLog(runsDir, runId) : undefined;
      log?.write({
        type: "run_start",
        instruction: instruction.content,
        prompt,
        runtime: agent.runtime,
        model: agent.model?.full,
      });

      try {
        const run = loop.run(prompt);
        for await (const event of run) {
          // Global bus: only text (truncated) for overview
          if (event.type === "text") {
            this.emitEvent("workspace.agent_text", {
              workspace: workspaceKey,
              agent: agent.name,
              text: event.text.slice(0, 500),
            });
          }
          // Agent log: full detail per event
          log?.write(serializeLoopEvent(event));

          // Timeline: log text output and tool calls for debug visibility
          if (event.type === "text" && event.text.trim()) {
            await workspace.eventLog.log(agent.name, "output", event.text);
          } else if (event.type === "tool_call_start") {
            await workspace.eventLog.log(agent.name, "tool_call", event.name, {
              toolCall: { name: event.name, args: event.args },
            });
          }
        }
        const result = await run.result;
        log?.write({
          type: "run_end",
          status: "ok",
          durationMs: result.durationMs,
          usage: result.usage,
        });
      } catch (err) {
        log?.write({ type: "run_end", status: "error", error: String(err) });
        throw err;
      }
    };
  }

  private async createAgentLoop(agent: ResolvedAgent, cwd?: string): Promise<AgentLoop | null> {
    if (!agent.runtime || agent.runtime === "mock") return null;
    if (!agent.model && agent.runtime === "ai-sdk") return null;

    const { createLoopFromConfig } = await import("./loop-factory.ts");
    // Don't pass instructions here — WorkspaceOrchestrator already includes them
    // in the assembled prompt via soulSection. Passing them here would cause
    // the model to see instructions twice (system prompt + user message).
    return createLoopFromConfig({
      type: agent.runtime as import("./types.ts").RuntimeType,
      model: agent.model?.full,
      env: agent.env,
      cwd,
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
  const defs = WORKSPACE_TOOL_DEFS as unknown as Record<
    string,
    {
      description: string;
      parameters: Record<string, { type: string; description?: string }>;
      required: readonly string[];
    }
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

// ── Per-agent run logging ──────────────────────────────────────────────────

interface RunLog {
  write(entry: Record<string, unknown>): void;
}

function createRunLog(runsDir: string, runId: string): RunLog {
  mkdirSync(runsDir, { recursive: true });
  const filePath = join(runsDir, `${runId}.jsonl`);
  return {
    write(entry) {
      const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
      appendFileSync(filePath, line);
    },
  };
}

import type { LoopEvent } from "@agent-worker/loop";

function serializeLoopEvent(event: LoopEvent): Record<string, unknown> {
  switch (event.type) {
    case "text":
      return { type: "text", text: event.text };
    case "thinking":
      return { type: "thinking", text: event.text };
    case "tool_call_start":
      return {
        type: "tool_call_start",
        name: event.name,
        callId: event.callId,
        args: event.args,
      };
    case "tool_call_end":
      return {
        type: "tool_call_end",
        name: event.name,
        callId: event.callId,
        result: typeof event.result === "string" ? event.result.slice(0, 2000) : event.result,
        durationMs: event.durationMs,
        error: event.error,
      };
    case "error":
      return { type: "error", error: String(event.error) };
    default:
      return { type: "unknown", data: (event as any).data };
  }
}
