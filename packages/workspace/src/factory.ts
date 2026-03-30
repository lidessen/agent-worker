import type { WorkspaceConfig } from "./types.ts";
import { Workspace } from "./workspace.ts";
import { createWorkspaceTools, type WorkspaceToolSet } from "./context/mcp/server.ts";
import { WORKSPACE_PROMPT_SECTIONS } from "./context/mcp/prompts.ts";
import type { PromptSection } from "./loop/prompt.ts";

// ── createWorkspace ────────────────────────────────────────────────────────

export async function createWorkspace(config: WorkspaceConfig): Promise<Workspace> {
  const workspace = new Workspace(config);

  // Register agents (with per-agent channel overrides when available)
  if (config.agents) {
    for (const agent of config.agents) {
      const channels = config.agentChannelMap?.[agent];
      await workspace.registerAgent(agent, channels);
    }
  }

  // Ensure on_demand agents are registered even if omitted from config.agents.
  // This guarantees lookupAgentChannels always returns a Set (never undefined)
  // for known on_demand agents, so the @mention guard fires correctly.
  if (config.onDemandAgents) {
    for (const agent of config.onDemandAgents) {
      if (!workspace.hasAgent(agent)) {
        const channels = config.agentChannelMap?.[agent];
        await workspace.registerAgent(agent, channels);
      }
    }
  }

  // Start connections (platform adapters)
  if (config.connections) {
    for (const adapter of config.connections) {
      await workspace.bridge.addAdapter(adapter);
    }
  }

  await workspace.init();
  return workspace;
}

// ── createAgentTools ───────────────────────────────────────────────────────

/** Directories exposed to a workspace agent. */
export interface AgentDirs {
  /** Shared workspace sandbox directory (collaborative files visible to all agents). */
  workspaceSandboxDir: string | undefined;
  /** Agent's personal sandbox directory (bash cwd, file operations). */
  sandboxDir: string | undefined;
}

/** Create the full workspace tool set, prompt sections, and directory info for a specific agent. */
export function createAgentTools(
  agentName: string,
  runtime: Workspace,
): { tools: WorkspaceToolSet; promptSections: PromptSection[]; dirs: AgentDirs } {
  const channels = runtime.getAgentChannels(agentName);
  const tools = createWorkspaceTools(agentName, runtime.contextProvider, channels,
    (name) => runtime.hasAgent(name) ? runtime.getAgentChannels(name) : undefined);
  const dirs: AgentDirs = {
    workspaceSandboxDir: runtime.workspaceSandboxDir,
    sandboxDir: runtime.agentSandboxDir(agentName),
  };
  return { tools, promptSections: WORKSPACE_PROMPT_SECTIONS, dirs };
}
