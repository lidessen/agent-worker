import type { HarnessConfig } from "./types.ts";
import { Harness } from "./harness.ts";
import { createHarnessTools, type HarnessToolSet } from "./context/mcp/server.ts";
import { HARNESS_PROMPT_SECTIONS } from "./context/mcp/prompts.tsx";
import type { PromptSection } from "./loop/prompt.tsx";
import type { HarnessTypeRegistry } from "./type/index.ts";

// ── createHarness ────────────────────────────────────────────────────────

export async function createHarness(
  config: HarnessConfig,
  harnessTypeRegistry?: HarnessTypeRegistry,
): Promise<Harness> {
  const harness = new Harness(config, harnessTypeRegistry);

  await harness.init();

  // Register agents
  if (config.agents) {
    for (const agent of config.agents) {
      await harness.registerAgent(agent);
    }
  }

  // Start connections (platform adapters)
  if (config.connections) {
    for (const adapter of config.connections) {
      await harness.bridge.addAdapter(adapter);
    }
  }
  return harness;
}

// ── createAgentTools ───────────────────────────────────────────────────────

/** Directories exposed to a harness agent. */
export interface AgentDirs {
  /** Shared harness sandbox directory (collaborative files visible to all agents). */
  harnessSandboxDir: string | undefined;
  /** Agent's personal sandbox directory (bash cwd, file operations). */
  sandboxDir: string | undefined;
}

/** Create the full harness tool set, prompt sections, and directory info for a specific agent. */
export function createAgentTools(
  agentName: string,
  runtime: Harness,
): { tools: HarnessToolSet; promptSections: PromptSection[]; dirs: AgentDirs } {
  const channels = runtime.getAgentChannels(agentName);
  const tools = createHarnessTools(
    agentName,
    runtime.contextProvider,
    channels,
    (name) => (runtime.hasAgent(name) ? runtime.getAgentChannels(name) : undefined),
    {
      stateStore: runtime.stateStore,
      harnessName: runtime.name,
      instructionQueue: runtime.instructionQueue,
      harnessTypeRegistry: runtime.harnessTypeRegistry,
      harnessTypeId: runtime.harnessTypeId,
    },
  );
  const dirs: AgentDirs = {
    harnessSandboxDir: runtime.harnessSandboxDir,
    sandboxDir: runtime.agentSandboxDir(agentName),
  };
  return { tools, promptSections: HARNESS_PROMPT_SECTIONS, dirs };
}
