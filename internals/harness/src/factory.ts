import type { HarnessConfig } from "./types.ts";
import { Harness } from "./harness.ts";
import { createHarnessTools, type HarnessToolSet } from "./context/mcp/server.ts";
import { HARNESS_PROMPT_SECTIONS } from "./context/mcp/prompts.tsx";
import type { PromptSection } from "./loop/prompt.tsx";
import { createHarnessTypeRegistry, type HarnessTypeRegistry } from "./type/index.ts";
import {
  COORDINATION_HARNESS_TYPE_ID,
  multiAgentCoordinationHarnessType,
} from "@agent-worker/harness-coordination";

// ── createHarness ────────────────────────────────────────────────────────

/**
 * Construct and initialize a multi-agent coordination Harness.
 *
 * `createHarness` is the coord-flavored entry point: it auto-registers
 * `multiAgentCoordinationHarnessType` in the registry and defaults
 * `harnessTypeId` to it. Coord `onInit` (fired from `harness.init`)
 * registers `config.agents` and attaches `config.connections` adapters
 * to the bridge. Callers that want the substrate no-op type should
 * construct via `new Harness(...)` directly.
 */
export async function createHarness(
  config: HarnessConfig,
  harnessTypeRegistry?: HarnessTypeRegistry,
): Promise<Harness> {
  const registry = harnessTypeRegistry ?? createHarnessTypeRegistry();
  if (!registry.get(multiAgentCoordinationHarnessType.id)) {
    registry.register(multiAgentCoordinationHarnessType);
  }
  const harness = new Harness(
    { ...config, harnessTypeId: config.harnessTypeId ?? COORDINATION_HARNESS_TYPE_ID },
    registry,
  );
  await harness.init();
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
