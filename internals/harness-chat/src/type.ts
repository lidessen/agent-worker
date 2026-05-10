// `singleAgentChatHarnessType` — the chat-shaped peer to
// `multiAgentCoordinationHarnessType`.
//
// Per design/decisions/008-single-agent-chat-harness-type.md, this
// type owns one agent + one conversation thread + a simple
// idle/thinking state machine. No channels, inbox, queue, telegram,
// team-docs. A chat turn is a one-shot dispatch (slice 2); slice 1
// only wires the runtime + lifecycle.

import type {
  ContributeMcpToolsInput,
  ContributeRuntimeInput,
  HarnessConfig,
  HarnessType,
  OnInitInput,
  OnShutdownInput,
  SnapshotExtensionInput,
  StorageBackend,
} from "@agent-worker/harness";
import { ChatRuntime } from "./runtime.ts";
import {
  SINGLE_AGENT_CHAT_HARNESS_TYPE_ID,
  type ChatHarnessAgentConfig,
  type ChatSnapshot,
} from "./types.ts";

export { SINGLE_AGENT_CHAT_HARNESS_TYPE_ID };

/**
 * Substrate `Harness` shape this type reads from. Kept narrow; only
 * what `contributeRuntime` needs to seed the conversation store.
 */
interface ChatHostHarness {
  storage: StorageBackend;
}

/** Read the agent block off a HarnessConfig. */
function readAgentConfig(config: HarnessConfig): ChatHarnessAgentConfig | undefined {
  // `agent` isn't a typed field on HarnessConfig today (coord uses
  // `agents: string[]`); keep the cast narrow + local until config
  // schema gains an explicit slot.
  return (config as unknown as { agent?: ChatHarnessAgentConfig }).agent;
}

export const singleAgentChatHarnessType: HarnessType<unknown, ChatRuntime> = {
  id: SINGLE_AGENT_CHAT_HARNESS_TYPE_ID,
  label: "single-agent chat",

  contributeRuntime({ harness, config }: ContributeRuntimeInput): ChatRuntime {
    const h = harness as ChatHostHarness;
    const agent = readAgentConfig(config as HarnessConfig) ?? {};
    return new ChatRuntime({ agent, storage: h.storage });
  },

  async onInit({ runtime }: OnInitInput<ChatRuntime>): Promise<void> {
    if (!runtime) return;
    await runtime.load();
  },

  async onShutdown({ runtime }: OnShutdownInput<ChatRuntime>): Promise<void> {
    if (!runtime) return;
    await runtime.shutdown();
  },

  /**
   * Slice 1: chat agents inherit the substrate's universal tool slice
   * (resource_, chronicle_, task_ / wake_ / handoff_, worktree_) via
   * `factory.buildAgentToolSet`'s substrate path. The chat type
   * contributes nothing extra at the MCP layer for now — runtime-side
   * tool surfaces (claude-code's bash/edit/grep/web_fetch, codex's
   * built-ins) come from the underlying loop.
   */
  contributeMcpTools(_input: ContributeMcpToolsInput<ChatRuntime>) {
    return [];
  },

  async snapshotExtension({ runtime }: SnapshotExtensionInput<ChatRuntime>): Promise<ChatSnapshot | undefined> {
    if (!runtime) return undefined;
    return {
      agentName: runtime.agentName,
      runtime: runtime.runtimeId,
      state: runtime.state,
      turnCount: runtime.turnCount,
      recent: runtime.recent(10),
    };
  },
};
