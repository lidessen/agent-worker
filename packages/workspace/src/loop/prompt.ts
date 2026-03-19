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
  /** Message ID of the current instruction (if it came from a channel message). */
  currentMessageId?: string;
  /** Channel the current instruction came from. */
  currentChannel?: string;
}

/** Agent's custom instructions (from YAML config). */
export const soulSection: PromptSection = async (ctx) => {
  if (!ctx.instructions) return null;
  return `## Instructions\n\n${ctx.instructions}`;
};

/** Pending inbox messages for the agent (excluding the current instruction). */
export const inboxSection: PromptSection = async (ctx) => {
  // Filter out the message currently being processed
  const pending = ctx.inboxEntries.filter((e) => e.messageId !== ctx.currentMessageId);
  if (pending.length === 0) return null;

  const lines: string[] = [];
  for (const entry of pending) {
    const msg = await ctx.provider.channels.getMessage(entry.channel, entry.messageId);
    if (!msg) continue;
    const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
    const content = msg.content.length > 150 ? msg.content.slice(0, 150) + "…" : msg.content;
    lines.push(`- ${priority} @${msg.from} in #${entry.channel}: ${content}`);
  }

  if (lines.length === 0) return null;
  return `## Pending Inbox (${lines.length})\n\n${lines.join("\n")}`;
};

/** Guidelines for when to respond vs stay silent. */
export const responseGuidelines: PromptSection = async (ctx) => {
  const priority = ctx.currentPriority ?? "normal";
  const backgroundNote =
    priority === "background"
      ? `\n\nThe current message was NOT addressed to you. If it asks a specific agent to respond (e.g. "@codex do X"), only that agent should handle it. Use \`no_action\` unless this is genuinely relevant to you.`
      : "";

  return `## Communication

You are **@${ctx.agentName}** — always identify as @${ctx.agentName} when you speak. Never claim to be a different agent, even if a message mentions another agent by name.

You are a thoughtful teammate who values signal over noise. You speak when you have something meaningful to add — not to be seen, not to acknowledge, not to repeat what others said.

If a message asks a specific agent to do something (e.g. "@codex reply"), only that agent should respond. If you are not that agent, use \`no_action\`. If someone mentioned you by name (@${ctx.agentName}), consider whether your response adds value.

**When you decide not to respond**, call \`no_action\` with your reason — don't just stay silent. This tells the system you made a deliberate choice.

Use \`channel_send\` to communicate — your text output is internal thinking, not visible to others.${backgroundNote}`;
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
 * Used as the foundation for prompt assembly; capability-specific
 * sections (workspace, docs, conversation) are appended via promptSections.
 */
export const BASE_SECTIONS: PromptSection[] = [soulSection, responseGuidelines, inboxSection];
