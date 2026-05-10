/** @jsxImportSource semajsx/prompt */

import type { ContextProvider, InboxEntry } from "../types.ts";
import type { HarnessStateStore } from "../state/index.ts";
import type { Worktree } from "../state/types.ts";
import { renderPromptDocument } from "./prompt-ui.tsx";
import type { PromptSectionNode } from "./prompt-ui.tsx";

export type PromptSection = (
  ctx: PromptContext,
) => Promise<PromptSectionNode | PromptSectionNode[] | null>;

export interface PromptContext {
  agentName: string;
  instructions?: string;
  provider: ContextProvider;
  inboxEntries: InboxEntry[];
  currentInstruction?: string;
  /** Priority of the current instruction (immediate/normal/background). */
  currentPriority?: string;
  /** Message ID of the current instruction (if it came from a channel message). */
  currentMessageId?: string;
  /** Channel the current instruction came from. */
  currentChannel?: string;
  /** Agent's personal sandbox directory. */
  sandboxDir?: string;
  /** Shared harness sandbox directory (visible to all agents). */
  harnessSandboxDir?: string;
  /**
   * Worktrees attached to the agent's current Wake. Resolved per-run by
   * the orchestrator from the state store. Empty / absent when the agent
   * has no active Wake or the active Wake has not created any worktrees
   * yet.
   */
  worktrees?: readonly Worktree[];
  /** Kernel state store — task ledger visible to the lead. Undefined in legacy callers. */
  stateStore?: HarnessStateStore;
  /**
   * Agent's resolved role. The lead prompt section uses this to show the
   * task ledger; workers see only the conversation view.
   */
  role?: "lead" | "worker" | "observer";
  /** Harness name — used as harnessId when showing task ledger. */
  harnessName?: string;
}

/** Agent's custom instructions (from YAML config). Substrate-only — universal across types. */
export const soulSection: PromptSection = async (ctx) => {
  if (!ctx.instructions) return null;
  return (
    <section title="Instructions">
      <raw>{ctx.instructions}</raw>
    </section>
  );
};

/** Assemble all prompt sections. */
export async function assemblePrompt(
  sections: PromptSection[],
  ctx: PromptContext,
): Promise<string> {
  const parts: PromptSectionNode[] = [];

  for (const section of sections) {
    const result = await section(ctx);
    if (!result) continue;
    if (Array.isArray(result)) {
      parts.push(...result);
    } else {
      parts.push(result);
    }
  }

  return renderPromptDocument(parts);
}

/**
 * Substrate-only base sections — only the universal `soulSection`.
 * Coord-flavored sections (`inboxSection`, `responseGuidelines`) live
 * in `@agent-worker/harness-coordination`'s `COORDINATION_BASE_SECTIONS`.
 * Capability-specific sections are appended via the orchestrator's
 * `promptSections` config.
 */
export const SUBSTRATE_BASE_SECTIONS: PromptSection[] = [soulSection];
