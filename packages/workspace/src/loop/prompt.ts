import type { ContextProvider, InboxEntry } from "../types.ts";

export type PromptSection = (ctx: PromptContext) => Promise<string | null>;

export interface PromptContext {
  agentName: string;
  instructions?: string;
  provider: ContextProvider;
  inboxEntries: InboxEntry[];
  currentInstruction?: string;
  /** Priority of the current instruction (immediate/normal/background). */
  currentPriority?: string;
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

  // Annotate with routing context so agent knows whether it was directly addressed
  const priority = ctx.currentPriority ?? "normal";
  if (priority === "background") {
    return `## Current Task\n\n${ctx.currentInstruction}\n\n> _This message was not directed at you. Only respond if you have something specific to contribute._`;
  }
  return `## Current Task\n\n${ctx.currentInstruction}`;
};

/** Guidelines for when to respond vs stay silent. */
export const responseGuidelines: PromptSection = async () => {
  return `## When to Respond

- **You are mentioned (@${"`"}your_name${"`"})**: You MUST respond via \`channel_send\`.
- **A message is directed to you (DM or to: you)**: You MUST respond.
- **A general channel message not mentioning you**: Only respond if you have **specific, relevant expertise** to contribute. Otherwise, stay silent — do NOT reply just to acknowledge or repeat what others said.
- **Another agent was mentioned, not you**: Do NOT respond unless you are explicitly asked or have critical information to add. Let the mentioned agent handle it.

When in doubt, stay silent. Less noise is better than redundant responses.`;
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
export const BASE_SECTIONS: PromptSection[] = [
  currentTaskSection,
  soulSection,
  responseGuidelines,
  inboxSection,
];
