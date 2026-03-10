import type {
  WorkspaceConfig,
  ContextProvider,
  EventLog,
  InstructionQueueInterface,
} from "./types.ts";
import { Workspace } from "./workspace.ts";
import { WorkspaceAgentLoop, type AgentLoopConfig } from "./loop/loop.ts";
import { createWorkspaceTools, type WorkspaceToolSet } from "./context/mcp/server.ts";
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

  // Start adapters
  if (config.adapters) {
    for (const adapter of config.adapters) {
      await (workspace.bridge as any).addAdapter?.(adapter);
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
    onInstruction: config.onInstruction,
  });
}

// ── createAgentTools ───────────────────────────────────────────────────────

/** Create the full workspace tool set for a specific agent. */
export function createAgentTools(agentName: string, runtime: Workspace): WorkspaceToolSet {
  const channels = runtime.getAgentChannels(agentName);
  return createWorkspaceTools(agentName, runtime.contextProvider, channels);
}
