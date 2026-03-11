import {
  createWorkspace,
  createWiredLoop,
  createAgentTools,
  loadWorkspaceDef,
  toWorkspaceConfig,
} from "@agent-worker/workspace";
import type { Workspace, WorkspaceAgentLoop, ResolvedAgent } from "@agent-worker/workspace";
import type { AiSdkLoop } from "@agent-worker/loop";
import type { CreateWorkspaceInput, WorkspaceHandleInfo, DaemonEvent } from "./types.ts";
import { WorkspaceHandle } from "./workspace-handle.ts";

/**
 * WorkspaceRegistry manages workspace lifecycle within the daemon.
 * Includes a lazy-created default "global" workspace.
 */
export class WorkspaceRegistry {
  private workspaces = new Map<string, WorkspaceHandle>();
  private _onEvent?: (event: DaemonEvent) => void;
  private _defaultWorkspace: WorkspaceHandle | null = null;
  private _dataDir: string;

  constructor(dataDir: string) {
    this._dataDir = dataDir;
  }

  setEventSink(onEvent: (event: DaemonEvent) => void): void {
    this._onEvent = onEvent;
  }

  /** Get or create the default global workspace (for standalone agents). */
  async ensureDefault(): Promise<WorkspaceHandle> {
    if (this._defaultWorkspace) return this._defaultWorkspace;

    const globalYaml = `
name: global
agents: {}
storage: file
storage_dir: ${this._dataDir}
`;

    const resolved = await loadWorkspaceDef(globalYaml);
    const config = toWorkspaceConfig(resolved);
    const workspace = await createWorkspace(config);

    this._defaultWorkspace = new WorkspaceHandle({
      workspace,
      resolved,
      loops: [],
      onEvent: this._onEvent,
    });

    return this._defaultWorkspace;
  }

  /** Create a workspace from YAML source. */
  async create(input: CreateWorkspaceInput): Promise<WorkspaceHandle> {
    const resolved = await loadWorkspaceDef(input.source, {
      tag: input.tag,
      vars: input.vars,
    });

    const key = input.tag ? `${resolved.def.name}:${input.tag}` : resolved.def.name;
    if (this.workspaces.has(key)) {
      throw new Error(`Workspace "${key}" already exists`);
    }

    const config = toWorkspaceConfig(resolved, { tag: input.tag });
    const workspace = await createWorkspace(config);

    // Create loops for each agent
    const loops: WorkspaceAgentLoop[] = [];
    for (const agent of resolved.agents) {
      const runner = await this.createRunner(agent, workspace, resolved);
      const loop = createWiredLoop({
        name: agent.name,
        instructions: agent.instructions,
        runtime: workspace,
        pollInterval: 2000,
        onInstruction: async (prompt, instruction) => {
          this._onEvent?.({
            ts: Date.now(),
            type: "agent_run_start",
            workspace: key,
            agent: agent.name,
            instruction: instruction.content.slice(0, 200),
          });
          try {
            await runner(prompt, instruction);
            this._onEvent?.({
              ts: Date.now(),
              type: "agent_run_end",
              workspace: key,
              agent: agent.name,
              status: "ok",
            });
          } catch (err) {
            this._onEvent?.({
              ts: Date.now(),
              type: "agent_error",
              workspace: key,
              agent: agent.name,
              error: String(err),
            });
          }
        },
      });
      loops.push(loop);
    }

    const handle = new WorkspaceHandle({
      workspace,
      resolved,
      loops,
      tag: input.tag,
      onEvent: this._onEvent,
    });

    this.workspaces.set(key, handle);

    this._onEvent?.({
      ts: Date.now(),
      type: "workspace_created",
      workspace: key,
      agents: resolved.agents.map((a) => a.name),
    });

    return handle;
  }

  /** Get a workspace by key ("name" or "name:tag"). */
  get(key: string): WorkspaceHandle | undefined {
    return this.workspaces.get(key);
  }

  /** List all workspaces (excluding default). */
  list(): WorkspaceHandleInfo[] {
    return Array.from(this.workspaces.values()).map((h) => h.info);
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
    return this.workspaces.size;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async createRunner(
    agent: ResolvedAgent,
    workspace: Workspace,
    resolved: import("@agent-worker/workspace").ResolvedWorkspace,
  ): Promise<(prompt: string, instruction: import("@agent-worker/workspace").Instruction) => Promise<void>> {
    return async (prompt, instruction) => {
      if (!agent.runtime || agent.runtime === "mock") {
        const channel =
          instruction.channel || (resolved.def.default_channel ?? "general");
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

      const tools = createAgentTools(agent.name, workspace);
      if (loop.setTools) {
        loop.setTools(tools as any);
      }

      const run = loop.run(prompt);
      for await (const event of run) {
        if (event.type === "text") {
          this._onEvent?.({
            ts: Date.now(),
            type: "agent_text",
            agent: agent.name,
            text: event.text.slice(0, 500),
          });
        }
      }

      const result = await run.result;
      // Post final response to channel if not handled by tools
      const textEvents = result.events?.filter((e) => e.type === "text") ?? [];
      if (textEvents.length > 0) {
        const text = textEvents.map((e) => (e as any).text).join("");
        if (text.length > 0) {
          const channel =
            instruction.channel || (resolved.def.default_channel ?? "general");
          await workspace.contextProvider.smartSend(channel, agent.name, text);
        }
      }
    };
  }

  private async createAgentLoop(agent: ResolvedAgent): Promise<AiSdkLoop | null> {
    if (agent.runtime === "ai-sdk" && agent.model) {
      const { AiSdkLoop } = await import("@agent-worker/loop");
      const provider = agent.model.provider ?? "anthropic";
      const modelId = agent.model.id;

      let languageModel;
      switch (provider) {
        case "anthropic": {
          const { anthropic } = await import("@ai-sdk/anthropic");
          languageModel = anthropic(modelId);
          break;
        }
        case "openai": {
          const { openai } = await import("@ai-sdk/openai");
          languageModel = openai(modelId);
          break;
        }
        case "deepseek": {
          const { deepseek } = await import("@ai-sdk/deepseek");
          languageModel = deepseek(modelId);
          break;
        }
        default:
          return null;
      }

      return new AiSdkLoop({
        model: languageModel,
        instructions: agent.instructions,
        includeBashTools: false,
      });
    }

    return null;
  }
}
