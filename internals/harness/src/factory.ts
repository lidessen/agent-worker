import type { HarnessConfig } from "./types.ts";
import { Harness } from "./harness.ts";
import {
  createHarnessTools,
  HARNESS_TOOL_DEFS,
  type HarnessToolHandler,
  type HarnessToolSet,
  type HarnessToolsOptions,
  type ToolDef,
} from "./context/mcp/server.ts";
import { HARNESS_PROMPT_SECTIONS } from "./context/mcp/prompts.tsx";
import type { PromptSection } from "./loop/prompt.tsx";
import { createHarnessTypeRegistry, type HarnessTypeRegistry } from "./type/index.ts";
import {
  COORDINATION_HARNESS_TYPE_ID,
  coordinationRuntime,
  multiAgentCoordinationHarnessType,
} from "@agent-worker/harness-coordination";
import { singleAgentChatHarnessType } from "@agent-worker/harness-chat";

// ── createHarness ────────────────────────────────────────────────────────

/**
 * Construct and initialize a Harness. Auto-registers both shipped
 * `HarnessType`s (coord and chat) in the registry; the harness's
 * `harnessTypeId` field selects which one this instance plugs into.
 *
 * Default: coord. Chat harnesses opt in via
 * `harnessTypeId: "single-agent-chat"` plus an `agent` block on the
 * config (see decision 008). Coord callers continue to pass
 * `agents: [...]` as before; the default keeps existing behavior
 * unchanged.
 *
 * Callers that want the substrate no-op type construct via
 * `new Harness(...)` directly.
 */
export async function createHarness(
  config: HarnessConfig,
  harnessTypeRegistry?: HarnessTypeRegistry,
): Promise<Harness> {
  const registry = harnessTypeRegistry ?? createHarnessTypeRegistry();
  if (!registry.get(multiAgentCoordinationHarnessType.id)) {
    registry.register(multiAgentCoordinationHarnessType);
  }
  if (!registry.get(singleAgentChatHarnessType.id)) {
    registry.register(singleAgentChatHarnessType);
  }
  const harness = new Harness(
    { ...config, harnessTypeId: config.harnessTypeId ?? COORDINATION_HARNESS_TYPE_ID },
    registry,
  );
  await harness.init();
  return harness;
}

// ── buildAgentToolSet ─────────────────────────────────────────────────────

/**
 * Build the full per-agent tool set + def map: substrate tools merged
 * with whatever the registered `HarnessType` contributes via
 * `contributeMcpTools`. Per-agent MCP servers and out-of-band callers
 * (daemon `/tool-call`, debug clients) all funnel through this so the
 * substrate↔type merge happens in one place.
 *
 * Substrate-only and type-only tools live separately (`createHarnessTools`
 * + `HARNESS_TOOL_DEFS` for substrate; the type's contribution for
 * its own slice). This helper does not inspect contributed item shapes
 * beyond casting them to `{name, def, handler}`; that boundary cast
 * is the substrate's only knowledge of contributed tool layout.
 */
export function buildAgentToolSet(
  agentName: string,
  harness: Harness,
  options: Pick<HarnessToolsOptions, "activeWakeId" | "harnessKey" | "dataDir"> = {},
): { tools: HarnessToolSet; defs: Record<string, ToolDef> } {
  // task_dispatch needs an InstructionQueue, which the coord type owns.
  // Non-coord harnesses get task tools without the dispatch enabler.
  const coordRt =
    harness.harnessTypeId === COORDINATION_HARNESS_TYPE_ID
      ? coordinationRuntime(harness)
      : undefined;
  const tools: HarnessToolSet = {
    ...createHarnessTools(agentName, harness.contextProvider, {
      stateStore: harness.stateStore,
      harnessName: harness.name,
      harnessKey: options.harnessKey,
      dataDir: options.dataDir,
      instructionQueue: coordRt?.instructionQueue,
      activeWakeId: options.activeWakeId,
      harnessTypeRegistry: harness.harnessTypeRegistry,
      harnessTypeId: harness.harnessTypeId,
    }),
  };
  const defs: Record<string, ToolDef> = { ...HARNESS_TOOL_DEFS };

  const type = harness.harnessTypeRegistry.resolve(harness.harnessTypeId);
  const contributed =
    type.contributeMcpTools?.({
      harness,
      runtime: harness.typeRuntime,
      agentName,
    }) ?? [];
  for (const raw of contributed) {
    const item = raw as { name: string; def: ToolDef; handler: HarnessToolHandler };
    tools[item.name] = item.handler;
    defs[item.name] = item.def;
  }

  return { tools, defs };
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
  const { tools } = buildAgentToolSet(agentName, runtime);
  const dirs: AgentDirs = {
    harnessSandboxDir: runtime.harnessSandboxDir,
    sandboxDir: runtime.agentSandboxDir(agentName),
  };
  return { tools, promptSections: HARNESS_PROMPT_SECTIONS, dirs };
}
