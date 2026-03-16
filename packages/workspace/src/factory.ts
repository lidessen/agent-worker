import type { WorkspaceConfig } from "./types.ts";
import { Workspace } from "./workspace.ts";
import { WorkspaceAgentLoop } from "./loop/loop.ts";
import type { PromptSection } from "./loop/prompt.ts";
import { createWorkspaceTools, type WorkspaceToolSet } from "./context/mcp/server.ts";
import { WORKSPACE_PROMPT_SECTIONS } from "./context/mcp/prompts.ts";
import type { Instruction } from "./types.ts";

// ── createWorkspace ────────────────────────────────────────────────────────

export async function createWorkspace(config: WorkspaceConfig): Promise<Workspace> {
  const workspace = new Workspace(config);

  // Register agents
  if (config.agents) {
    for (const agent of config.agents) {
      await workspace.registerAgent(agent);
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

// ── createWiredLoop ────────────────────────────────────────────────────────

export interface WiredLoopConfig {
  name: string;
  instructions?: string;
  runtime: Workspace;
  /** Extra prompt sections injected by capabilities (e.g. workspace tools). */
  promptSections?: PromptSection[];
  /** Handler called with assembled prompt + instruction. */
  onInstruction: (prompt: string, instruction: Instruction) => Promise<void>;
  /** Polling interval in ms. Default: 5000 */
  pollInterval?: number;
}

export function createWiredLoop(config: WiredLoopConfig): WorkspaceAgentLoop {
  return new WorkspaceAgentLoop({
    name: config.name,
    instructions: config.instructions,
    provider: config.runtime.contextProvider,
    queue: config.runtime.instructionQueue,
    eventLog: config.runtime.eventLog,
    pollInterval: config.pollInterval,
    sections: config.promptSections,
    onInstruction: config.onInstruction,
  });
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
  const tools = createWorkspaceTools(agentName, runtime.contextProvider, channels);
  const dirs: AgentDirs = {
    workspaceSandboxDir: runtime.workspaceSandboxDir,
    sandboxDir: runtime.agentSandboxDir(agentName),
  };
  return { tools, promptSections: WORKSPACE_PROMPT_SECTIONS, dirs };
}
