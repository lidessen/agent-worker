import { join, dirname, basename } from "node:path";
import { mkdirSync, appendFileSync, symlinkSync, existsSync } from "node:fs";
import { readFile as readFileAsync, writeFile as writeFileAsync } from "node:fs/promises";
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
/** Manifest entry — persisted to workspaces.json for restart recovery. */
interface ManifestEntry {
  /** Workspace key (name or name:tag) — used for dedup and removal. */
  key: string;
  /** Absolute path to workspace YAML file. */
  sourcePath: string;
  tag?: string;
}

export class WorkspaceRegistry {
  private workspaces = new Map<string, ManagedWorkspace>();
  private _bus?: EventBus;
  private _defaultWorkspace: ManagedWorkspace | null = null;
  private _dataDir: string;
  private _daemonUrl?: string;
  private _daemonToken?: string;
  private _mcpHubUrl?: string;
  /** Serialize manifest read-modify-write to prevent concurrent corruption. */
  private _manifestLock: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this._dataDir = dataDir;
  }

  /** Path to the workspace manifest file. */
  private get manifestPath(): string {
    return join(this._dataDir, "workspaces.json");
  }

  /** Serialize access to the manifest file. */
  private withManifestLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this._manifestLock.then(fn);
    this._manifestLock = next.then(() => {}, () => {});
    return next;
  }

  /** Read manifest entries. */
  private async readManifest(): Promise<ManifestEntry[]> {
    try {
      const raw = await readFileAsync(this.manifestPath, "utf-8");
      try {
        return JSON.parse(raw);
      } catch (parseErr) {
        console.error(`[workspace-registry] manifest corrupted, starting empty: ${parseErr}`);
        return [];
      }
    } catch (fsErr: any) {
      if (fsErr.code === "ENOENT") return [];
      throw fsErr;
    }
  }

  /** Write manifest entries. */
  private async writeManifest(entries: ManifestEntry[]): Promise<void> {
    await writeFileAsync(this.manifestPath, JSON.stringify(entries, null, 2), "utf-8");
  }

  /** Add workspace to manifest (for restart recovery). */
  private async registerInManifest(key: string, input: CreateWorkspaceInput): Promise<void> {
    if (!input.sourcePath) return;
    await this.withManifestLock(async () => {
      const entries = await this.readManifest();
      if (entries.some((e) => e.key === key)) return;
      entries.push({ key, sourcePath: input.sourcePath!, tag: input.tag });
      await this.writeManifest(entries);
    });
  }

  /** Remove workspace from manifest by key. */
  private async unregisterFromManifest(key: string): Promise<void> {
    await this.withManifestLock(async () => {
      const entries = await this.readManifest();
      const filtered = entries.filter((e) => e.key !== key);
      if (filtered.length !== entries.length) {
        await this.writeManifest(filtered);
      }
    });
  }

  /**
   * Restore all workspaces from manifest. Called on daemon start after
   * global workspace and MCP hub are ready.
   * Skips setup steps (sandbox already populated) and kickoff (not a fresh create).
   */
  async restoreFromManifest(): Promise<void> {
    const entries = await this.readManifest();
    for (const entry of entries) {
      if (this.workspaces.has(entry.key)) continue;
      try {
        const handle = await this.create({
          source: entry.sourcePath,
          sourcePath: entry.sourcePath,
          configDir: dirname(entry.sourcePath),
          tag: entry.tag,
          _restore: true, // skip setup + kickoff
        });
        await handle.startLoops();
        console.error(`[workspace-registry] restored: ${entry.key}`);
      } catch (err) {
        console.error(`[workspace-registry] failed to restore ${entry.key}: ${err}`);
      }
    }
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
      // When agent has a personal sandbox, the shared workspace sandbox is an additional path
      const allowedPaths: string[] = [];
      if (dirs.sandboxDir && dirs.workspaceSandboxDir) {
        allowedPaths.push(dirs.workspaceSandboxDir);
      }
      const runner = await this.createRunner(agent, workspace, resolved, "global", tools, {
        cwd: agentCwd,
        storageDir: globalDir,
        allowedPaths: allowedPaths.length > 0 ? allowedPaths : undefined,
      });
      let orch: WorkspaceOrchestrator;
      orch = createOrchestrator({
        name: agent.name,
        instructions: agent.instructions,
        provider: workspace.contextProvider,
        queue: workspace.instructionQueue,
        eventLog: workspace.eventLog,
        promptSections,
        pollInterval: 2000,
        sandboxDir: dirs.sandboxDir,
        workspaceSandboxDir: dirs.workspaceSandboxDir,
        onDemand: agent.on_demand ?? false,
        // Arrow function defers orch access until invocation (after assignment)
        onInstruction: (prompt, instruction) =>
          this.createInstructionHandler("global", agent, workspace, runner, orch)(prompt, instruction),
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
    // Skip setup during load — we'll run it after sandbox dirs exist
    const resolved = await loadWorkspaceDef(input.source, {
      tag: input.tag,
      vars: input.vars,
      name: input.name,
      resolveRuntime,
      skipSetup: true,
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

    // Use daemon-managed data dir unless YAML explicitly specifies one.
    // When data_dir is set (e.g. pointing to a repo for knowledge persistence),
    // sandboxes still go in the daemon-managed dir — not inside the repo.
    const daemonDir = this.workspaceDir(key);
    const storageDir = resolved.def.data_dir ? undefined : daemonDir;
    const sandboxBaseDir = resolved.def.data_dir ? daemonDir : undefined;
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
    const config = toWorkspaceConfig(resolved, { tag: input.tag, storageDir, connections, sandboxBaseDir });
    const workspace = await createWorkspace(config);
    workspaceRef = workspace;

    // Run deferred setup steps in the shared workspace sandbox
    const loops: WorkspaceOrchestrator[] = loopsRef;
    const sandboxDir = workspace.workspaceSandboxDir;
    const templateVars: Record<string, string> = {
      ...input.vars,
      "workspace.name": resolved.def.name,
    };
    if (sandboxDir) templateVars["sandbox"] = sandboxDir;
    if (input.tag) templateVars["workspace.tag"] = input.tag;

    if (resolved.def.setup?.length && sandboxDir && !input._restore) {
      mkdirSync(sandboxDir, { recursive: true });
      const { runSetupSteps } = await import("@agent-worker/workspace");
      const setupVars = await runSetupSteps(resolved.def.setup, templateVars, {
        cwd: sandboxDir,
      });
      Object.assign(templateVars, setupVars);
    } else if (sandboxDir) {
      mkdirSync(sandboxDir, { recursive: true });
    }

    // Re-interpolate kickoff with sandbox path + setup vars
    if (resolved.def.kickoff) {
      const { interpolate } = await import("@agent-worker/workspace");
      resolved.kickoff = interpolate(resolved.def.kickoff, templateVars);
    }

    // Create agent loops
    for (const agent of resolved.agents) {
      const { tools, promptSections, dirs } = createAgentTools(agent.name, workspace);
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
      const allowedPaths: string[] = [];
      if (dirs.sandboxDir && dirs.workspaceSandboxDir) {
        allowedPaths.push(dirs.workspaceSandboxDir);
      }
      const actualStorageDir = storageDir ?? this.workspaceDir(key);
      const runner = await this.createRunner(agent, workspace, resolved, key, tools, {
        cwd: agentCwd,
        storageDir: actualStorageDir,
        allowedPaths: allowedPaths.length > 0 ? allowedPaths : undefined,
      });
      let orch: WorkspaceOrchestrator;
      orch = createOrchestrator({
        name: agent.name,
        instructions: agent.instructions,
        provider: workspace.contextProvider,
        queue: workspace.instructionQueue,
        eventLog: workspace.eventLog,
        promptSections,
        pollInterval: 2000,
        sandboxDir: dirs.sandboxDir,
        workspaceSandboxDir: dirs.workspaceSandboxDir,
        onDemand: agent.on_demand ?? false,
        onInstruction: (prompt, instruction) =>
          this.createInstructionHandler(key, agent, workspace, runner, orch)(prompt, instruction),
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

    // Persist to manifest for restart recovery (service mode only, not on restore)
    if (input.mode !== "task" && !input._restore) {
      await this.registerInManifest(key, input);
    }

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

  /** Stop and remove a workspace. Also removes from manifest. */
  async remove(key: string): Promise<void> {
    const handle = this.workspaces.get(key);
    if (!handle) throw new Error(`Workspace "${key}" not found`);
    await handle.stop();
    this.workspaces.delete(key);
    await this.unregisterFromManifest(key);
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
   * Create the onInstruction handler shared by ensureDefault and create.
   * Handles: run lifecycle events, error classification, auto-pause, lead notification.
   */
  private createInstructionHandler(
    workspaceKey: string,
    agent: ResolvedAgent,
    workspace: Workspace,
    runner: (prompt: string, instruction: import("@agent-worker/workspace").Instruction, runId: string) => Promise<void>,
    orch: WorkspaceOrchestrator,
  ): (prompt: string, instruction: import("@agent-worker/workspace").Instruction) => Promise<void> {
    return async (prompt, instruction) => {
      const runId = crypto.randomUUID();
      this.emitEvent("workspace.agent_run_start", {
        workspace: workspaceKey,
        agent: agent.name,
        runId,
        runtime: agent.runtime,
        model: agent.model?.full,
        instruction: instruction.content.slice(0, 200),
      });
      this.emitEvent("workspace.agent_prompt", {
        workspace: workspaceKey,
        agent: agent.name,
        runId,
        prompt,
        level: "debug",
      });
      try {
        await runner(prompt, instruction, runId);
        this.emitEvent("workspace.agent_run_end", {
          workspace: workspaceKey,
          agent: agent.name,
          runId,
          status: "ok",
        });
      } catch (err) {
        const errStr = String(err);
        this.emitEvent("workspace.agent_error", {
          workspace: workspaceKey,
          agent: agent.name,
          runId,
          error: errStr,
          level: "error",
        });

        // Classify error → decide recovery strategy
        const strategy = classifyError(errStr) ?? await classifyErrorWithLLM(errStr);
        if (strategy?.fatal) {
          // Non-recoverable: stop the loop permanently and notify lead.
          await orch.fail(strategy.reason);
          if (workspace.lead && workspace.lead !== agent.name) {
            try {
              await workspace.contextProvider.send({
                channel: workspace.defaultChannel,
                from: "system",
                content: `@${workspace.lead} Agent @${agent.name} stopped (fatal: ${strategy.reason}). ` +
                  `Fix the configuration and restart the workspace.\n` +
                  `Error: ${errStr.slice(0, 200)}`,
              });
            } catch { /* don't fail on notification */ }
          }
        } else if (strategy?.pause) {
          if (strategy.autoResume) {
            await orch.pauseUntil(strategy.retryAfterMs);
          } else {
            await orch.pause();
          }
          await workspace.eventLog.log(
            agent.name, "system",
            `Auto-paused (${strategy.category}): ${strategy.reason}. ` +
              (strategy.autoResume ? "Will auto-resume after cooldown." : "Manual resume required."),
          );
          if (workspace.lead && workspace.lead !== agent.name) {
            try {
              await workspace.contextProvider.send({
                channel: workspace.defaultChannel,
                from: "system",
                content: `@${workspace.lead} Agent @${agent.name} paused (${strategy.reason}). ` +
                  `Task: ${instruction.content.slice(0, 100)}` +
                  (strategy.autoResume ? "" : ". Needs manual resume or config fix."),
              });
            } catch { /* don't fail on notification */ }
          }
        }
      }
    };
  }

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
    opts?: { cwd?: string; storageDir?: string; allowedPaths?: string[] },
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
      const loop = await this.createAgentLoop(agent, opts?.cwd, opts?.allowedPaths);
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

  private async createAgentLoop(
    agent: ResolvedAgent,
    cwd?: string,
    allowedPaths?: string[],
  ): Promise<AgentLoop | null> {
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
      allowedPaths,
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

// ── Error classification ─────────────────────────────────────────────────

type ErrorCategory = "rate_limit" | "quota_exhausted" | "auth" | "server_error" | "transient" | "fatal";

interface ErrorStrategy {
  category: ErrorCategory;
  /** Whether the agent should be auto-paused. */
  pause: boolean;
  /** Whether the agent should auto-resume after a cooldown. */
  autoResume: boolean;
  /**
   * Whether this is a non-recoverable error that should stop the loop entirely.
   * The loop will be marked as failed (isFailed=true) and checkCompletion will
   * return "failed" for the workspace.
   */
  fatal?: boolean;
  /** Suggested wait time in ms (extracted from error or LLM). Undefined = use default backoff. */
  retryAfterMs?: number;
  /** Human-readable reason for the pause. */
  reason: string;
}

/** Patterns → strategy, checked in order (first match wins). */
const ERROR_RULES: Array<{ patterns: RegExp[]; strategy: Omit<ErrorStrategy, "retryAfterMs"> }> = [
  {
    patterns: [/rate limit/i, /too many requests/i, /429/, /throttl/i],
    strategy: { category: "rate_limit", pause: true, autoResume: true, reason: "rate limited" },
  },
  {
    patterns: [/usage limit/i, /quota exceeded/i],
    strategy: { category: "quota_exhausted", pause: true, autoResume: true, reason: "quota exhausted" },
  },
  {
    // Billing/credits — account-level, won't self-resolve
    patterns: [/billing/i, /insufficient.*credits/i, /payment/i, /subscription/i],
    strategy: { category: "quota_exhausted", pause: true, autoResume: false, reason: "billing/credits issue" },
  },
  {
    patterns: [/authentication required/i, /unauthorized/i, /api.key/i, /invalid.*token/i, /401/],
    strategy: { category: "auth", pause: true, autoResume: false, reason: "authentication failed" },
  },
  {
    patterns: [/500/, /502/, /503/, /504/, /service unavailable/i, /internal server error/i],
    strategy: { category: "server_error", pause: true, autoResume: true, reason: "server error" },
  },
  {
    // Environment/config errors that will never self-resolve — stop the loop immediately.
    patterns: [
      /no cursor ide installation found/i,
      /cursor.*not installed/i,
      /unknown provider:/i,
      /provider.*is registered but has no adapter/i,
      /command not found/i,
      /ENOENT.*which/i,
    ],
    strategy: { category: "fatal", pause: false, autoResume: false, fatal: true, reason: "environment/config error" },
  },
];

/**
 * Extract retry-after duration from error text.
 * Handles: "retry after 60s", "try again in 5 minutes", "reset in 3600 seconds",
 * "Retry-After: 120", "wait 30s", "cooldown: 1h", etc.
 */
function parseRetryAfter(err: string): number | undefined {
  // "retry after 60" / "try again in 60 seconds" / "wait 30s" / "reset in 5 minutes"
  const m = err.match(/(?:retry.?after|retry in|try again in|wait|reset in|cooldown:?)\s*(\d+)\s*(s|sec|seconds?|m|min|minutes?|h|hours?|ms)?/i);
  if (!m) {
    // Retry-After HTTP header value (plain seconds)
    const h = err.match(/retry-after:\s*(\d+)/i);
    if (h) return parseInt(h[1]!, 10) * 1000;
    return undefined;
  }
  const n = parseInt(m[1]!, 10);
  const unit = (m[2] ?? "s").toLowerCase();
  if (unit.startsWith("ms")) return n;
  if (unit.startsWith("h")) return n * 3_600_000;
  if (unit.startsWith("m")) return n * 60_000;
  return n * 1000; // default seconds
}

function classifyError(err: string): ErrorStrategy | null {
  for (const rule of ERROR_RULES) {
    if (rule.patterns.some((p) => p.test(err))) {
      return { ...rule.strategy, retryAfterMs: parseRetryAfter(err) };
    }
  }
  return null;
}

// ── LLM error classifier ────────────────────────────────────────────────

/**
 * Configurable model for LLM error classification.
 * Format: "provider:model" (e.g. "deepseek:deepseek-chat").
 * Set to "auto" to auto-discover cheapest available, or "off" to disable.
 */
let errorClassifierModel: string = "auto";

/** Set the model used for LLM error classification. */
export function setErrorClassifierModel(model: string): void {
  errorClassifierModel = model;
}

/** Auto-discover order: cheapest providers first. Uses registry defaults. */
const AUTO_DISCOVER_PROVIDERS = ["deepseek", "google", "openai", "anthropic"];

/**
 * LLM fallback for unrecognized errors. Classifies the error and extracts
 * retry-after timing if present.
 */
async function classifyErrorWithLLM(err: string): Promise<ErrorStrategy | null> {
  if (errorClassifierModel === "off") return null;

  try {
    const { resolveProvider, hasProviderKey, getDefaultModel } = await import("@agent-worker/loop");
    const { generateText, Output } = await import("ai");
    const { z } = await import("zod");

    let model;
    if (errorClassifierModel === "auto") {
      // Try providers in cheapest-first order, use registry default model
      for (const provider of AUTO_DISCOVER_PROVIDERS) {
        if (!hasProviderKey(provider)) continue;
        const modelId = getDefaultModel(provider);
        if (!modelId) continue;
        try {
          model = await resolveProvider(provider, modelId);
          break;
        } catch { continue; }
      }
      if (!model) return null;
    } else {
      // Explicit "provider:model" config
      const colonIdx = errorClassifierModel.indexOf(":");
      if (colonIdx <= 0) return null;
      const provider = errorClassifierModel.slice(0, colonIdx);
      const modelId = errorClassifierModel.slice(colonIdx + 1);
      model = await resolveProvider(provider, modelId);
    }

    const abort = AbortSignal.timeout(10_000);
    const result = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          category: z.enum(["rate_limit", "quota_exhausted", "auth", "server_error", "transient"]),
          autoResume: z.boolean().describe("true if temporary and will resolve on its own"),
          retryAfterMs: z.number().optional().describe("suggested wait time in milliseconds, extracted from error if available"),
          reason: z.string().describe("short human-readable reason, max 10 words"),
        }),
      }),
      prompt: `Classify this API/runtime error. If the error contains a retry-after time, extract it.\n\nError: ${err.slice(0, 500)}`,
      maxTokens: 100,
      abortSignal: abort,
    });

    if (!result.output) return null;
    return {
      category: result.output.category,
      pause: true,
      autoResume: result.output.autoResume,
      retryAfterMs: result.output.retryAfterMs,
      reason: result.output.reason,
    };
  } catch {
    return null;
  }
}

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
