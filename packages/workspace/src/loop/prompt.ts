import type { ContextProvider, InboxEntry } from "../types.ts";

export type PromptSection = (ctx: PromptContext) => Promise<string | null>;

export interface PromptContext {
  agentName: string;
  instructions?: string;
  provider: ContextProvider;
  inboxEntries: InboxEntry[];
  currentInstruction?: string;
}

/** Default prompt sections. Each returns a section string or null. */

export const soulSection: PromptSection = async (ctx) => {
  if (!ctx.instructions) return null;
  return `## Instructions\n\n${ctx.instructions}`;
};

export const teamSection: PromptSection = async (ctx) => {
  const members = await ctx.provider.status.getAll();
  if (members.length === 0) return null;

  const lines = members.map((m) => {
    const task = m.currentTask ? ` (${m.currentTask})` : "";
    return `- @${m.name}: ${m.status}${task}`;
  });
  return `## Team Members\n\n${lines.join("\n")}`;
};

export const inboxSection: PromptSection = async (ctx) => {
  if (ctx.inboxEntries.length === 0) return "## Inbox\n\nNo pending messages.";

  const lines: string[] = [];
  for (const entry of ctx.inboxEntries) {
    const msg = await ctx.provider.channels.getMessage(entry.channel, entry.messageId);
    if (!msg) continue;
    const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
    lines.push(`- [${msg.id}] #${entry.channel} from:@${msg.from}${priority}: "${msg.content}"`);
  }

  return `## Inbox (${lines.length} pending)\n\n${lines.join("\n")}`;
};

export const currentTaskSection: PromptSection = async (ctx) => {
  if (!ctx.currentInstruction) return null;
  return `## Current Task\n\n${ctx.currentInstruction}`;
};

export const docsSection: PromptSection = async (ctx) => {
  const docs = await ctx.provider.documents.list();
  if (docs.length === 0) return null;
  return `## Shared Documents\n\nAvailable: ${docs.join(", ")}`;
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

/** Default section list. */
export const DEFAULT_SECTIONS: PromptSection[] = [
  soulSection,
  teamSection,
  inboxSection,
  currentTaskSection,
  docsSection,
];
