import type { ContextProvider, InboxEntry } from "../types.ts";

export type PromptSection = (ctx: PromptContext) => Promise<string | null>;

export interface PromptContext {
  agentName: string;
  instructions?: string;
  provider: ContextProvider;
  inboxEntries: InboxEntry[];
  currentInstruction?: string;
}

/** Agent's custom instructions (from YAML config). */
export const soulSection: PromptSection = async (ctx) => {
  if (!ctx.instructions) return null;
  return `## Instructions\n\n${ctx.instructions}`;
};

/** Pending inbox messages for the agent. */
export const inboxSection: PromptSection = async (ctx) => {
  if (ctx.inboxEntries.length === 0) return null;

  const lines: string[] = [];
  for (const entry of ctx.inboxEntries) {
    const msg = await ctx.provider.channels.getMessage(entry.channel, entry.messageId);
    if (!msg) continue;
    const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
    lines.push(`- [${msg.id}] #${entry.channel} from @${msg.from}${priority}: "${msg.content}"`);
  }

  if (lines.length === 0) return null;
  return `## Inbox (${lines.length} pending)\n\n${lines.join("\n")}`;
};

/** The instruction currently being processed. */
export const currentTaskSection: PromptSection = async (ctx) => {
  if (!ctx.currentInstruction) return null;
  return `## Current Task\n\n${ctx.currentInstruction}`;
};

/** Assemble all prompt sections. */
export async function assemblePrompt(
  sections: PromptSection[],
  ctx: PromptContext,
): Promise<string> {
  const parts: string[] = [];

  for (const section of sections) {
    const result = await section(ctx);
    if (result) parts.push(result);
  }

  return parts.join("\n\n---\n\n");
}

/**
 * Base sections — agent-level context only (no workspace awareness).
 * Used internally by WorkspaceAgentLoop as the foundation; capability-specific
 * sections (workspace, docs) are appended via promptSections.
 */
export const BASE_SECTIONS: PromptSection[] = [soulSection, inboxSection, currentTaskSection];
