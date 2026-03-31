import type { ContextProvider, InboxEntry } from "../types.ts";
import { renderPromptDocument } from "./prompt-ui.tsx";
import type { PromptBlock, PromptSectionNode } from "./prompt-ui.tsx";

export type PromptSection = (ctx: PromptContext) => Promise<PromptSectionNode | PromptSectionNode[] | null>;

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
  /** Shared workspace sandbox directory (visible to all agents). */
  workspaceSandboxDir?: string;
}

/** Agent's custom instructions (from YAML config). */
export const soulSection: PromptSection = async (ctx) => {
  if (!ctx.instructions) return null;
  return {
    title: "Instructions",
    blocks: [{ kind: "raw", text: ctx.instructions }],
  };
};

/** Pending inbox notifications for the agent (excluding the current instruction). */
export const inboxSection: PromptSection = async (ctx) => {
  // Filter out the message currently being processed
  const pending = ctx.inboxEntries.filter((e) => e.messageId !== ctx.currentMessageId);
  if (pending.length === 0) return null;

  const byChannel = new Map<string, InboxEntry[]>();
  for (const entry of pending) {
    const entries = byChannel.get(entry.channel) ?? [];
    entries.push(entry);
    byChannel.set(entry.channel, entries);
  }

  const blocks: PromptBlock[] = [];
  const groups = Array.from(byChannel.entries());

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    const [channel, entries] = groups[groupIndex]!;
    const recent = entries.slice(-2);
    blocks.push({ kind: "line", text: `#${channel} (${entries.length} new)` });
    for (const entry of recent) {
      const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
      const preview = entry.preview.length >= 100 ? `${entry.preview}…` : entry.preview;
      blocks.push({ kind: "item", text: `@${entry.from}${priority}: "${preview}"` });
    }
    const hiddenCount = entries.length - recent.length;
    if (hiddenCount > 0) blocks.push({ kind: "item", text: `+${hiddenCount} more` });
    if (groupIndex < groups.length - 1) blocks.push({ kind: "break" });
  }

  blocks.push({ kind: "break" });
  blocks.push({ kind: "line", text: "Use channel_read for full messages." });

  return {
    title: `Pending Inbox (${pending.length})`,
    blocks,
  };
};

/** Guidelines for when to respond vs stay silent. */
export const responseGuidelines: PromptSection = async (ctx) => {
  const priority = ctx.currentPriority ?? "normal";
  const backgroundNote =
    priority === "background"
      ? `\n\nThe current message was NOT addressed to you. If it asks a specific agent to respond (e.g. "@codex do X"), only that agent should handle it. Use \`no_action\` unless this is genuinely relevant to you.`
      : "";

  const text = `You are **@${ctx.agentName}** — always identify as @${ctx.agentName} when you speak. Never claim to be a different agent, even if a message mentions another agent by name.

You are a thoughtful teammate who values signal over noise. You speak when you have something meaningful to add — not to be seen, not to repeat what others said. Exception: when you receive a task assignment, a brief acknowledgment ("收到，开始实现 X") is valuable — it tells the assigner you have it and prevents redundant follow-ups.

If a message asks a specific agent to do something (e.g. "@codex reply"), only that agent should respond. If you are not that agent, use \`no_action\`. If someone mentioned you by name (@${ctx.agentName}), consider whether your response adds value.

**When you decide not to respond**, call \`no_action\` with your reason — don't just stay silent. This tells the system you made a deliberate choice.

Use \`channel_send\` to communicate — your text output is internal thinking, not visible to others.${backgroundNote}`;

  return {
    title: "Communication",
    blocks: [{ kind: "raw", text }],
  };
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
 * Base sections — agent-level context only (no workspace awareness).
 * Used as the foundation for prompt assembly; capability-specific
 * sections (workspace, docs, conversation) are appended via promptSections.
 */
export const BASE_SECTIONS: PromptSection[] = [soulSection, responseGuidelines, inboxSection];
