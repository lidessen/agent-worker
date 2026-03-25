import type { PromptSection } from "../../loop/prompt.ts";
import type { Message } from "../../types.ts";

/** Max chars per message before truncation. */
const MSG_PREVIEW_LIMIT = 300;
/** Number of recent messages to include per channel. */
const RECENT_MSG_LIMIT = 20;

/**
 * Workspace prompt section — injected alongside workspace MCP tools.
 * Tells the agent who it is, where it is, and how to use workspace tools.
 */
export const workspacePromptSection: PromptSection = async (ctx) => {
  const members = await ctx.provider.status.getAll();
  const teammates = members.filter((m) => m.name !== ctx.agentName);
  const channels = ctx.provider.channels.listChannels();
  const isLead = ctx.provider.lead === ctx.agentName;

  const lines: string[] = [
    "## Workspace",
    "",
    `You are **@${ctx.agentName}** in a collaborative workspace with channels, teammates, and shared documents.`,
  ];

  if (isLead) {
    lines.push("");
    lines.push("### You are the workspace lead");
    lines.push("- You are responsible for responding to user messages, even if they don't @ you directly.");
    lines.push("- Unmentioned messages from users (e.g. telegram) are routed to you at normal priority.");
    lines.push("- You have access to debug tools and can see all channels.");
    lines.push("- Coordinate the team, review work, and report back to the user.");
  }

  lines.push("");
  lines.push("### Key mechanics");
  lines.push("- `channel_send` posts to channels. Plain text output is your private thinking -- only you see it.");
  lines.push("- `@name` in messages notifies that teammate.");
  lines.push("- Messages over 1200 chars: use `resource_create` first, then send a summary with the resource ID.");
  lines.push("- `channel_read` shows full conversation history beyond what's shown below.");
  lines.push("");
  lines.push("### Directories");
  lines.push(`- Personal sandbox: \`${ctx.sandboxDir ?? "(not available)"}\``);
  lines.push(`- Shared workspace: \`${ctx.workspaceSandboxDir ?? "(not available)"}\``);
  lines.push("");
  lines.push("### Channels");
  lines.push(channels.length > 0 ? channels.map((ch) => `- #${ch}`).join("\n") : "- (none)");

  if (teammates.length > 0) {
    lines.push("", "### Teammates", ...teammates.map((m) => `- @${m.name}: ${m.status}`));
  }

  return lines.join("\n");
};

/**
 * Unified conversation section — shows recent channel messages with the
 * current instruction highlighted in-context using a `→` marker.
 *
 * Replaces the old separate "Current Task" + "Recent Messages" sections.
 * The agent sees the full conversation flow and knows exactly which message
 * it's responding to.
 */
export const conversationSection: PromptSection = async (ctx) => {
  const channels = ctx.provider.channels.listChannels();
  if (channels.length === 0 && !ctx.currentInstruction) return null;

  const sections: Array<{ text: string; hasCurrent: boolean }> = [];

  for (const ch of channels) {
    const allMsgs = await ctx.provider.channels.read(ch);
    if (allMsgs.length === 0) continue;

    const total = allMsgs.length;
    const recent = allMsgs.slice(-RECENT_MSG_LIMIT);
    const omitted = total - recent.length;

    let foundCurrent = false;
    const blocks = recent.map((m) => {
      const isCurrent = ctx.currentMessageId === m.id;
      if (isCurrent) foundCurrent = true;
      const marker = isCurrent ? "→ " : "  ";
      const formatted = formatMessage(m);
      // Indent continuation lines of multi-line messages to match marker width
      return formatted.split("\n").map((line, i) => (i === 0 ? `${marker}${line}` : `  ${line}`)).join("\n");
    });

    let header = `#${ch}:`;
    if (omitted > 0) {
      header += ` (${omitted} earlier -- use \`channel_read\` with higher \`limit\` to see more)`;
    }
    sections.push({ text: `${header}\n${blocks.join("\n")}`, hasCurrent: foundCurrent });
  }

  // If the instruction didn't come from a channel (e.g. direct/API), show it separately
  const instructionInTimeline = ctx.currentMessageId && sections.some((s) => s.hasCurrent);

  const parts: string[] = ["## Conversation"];

  if (!instructionInTimeline && ctx.currentInstruction) {
    parts.push("");
    parts.push(`**Respond to:** ${ctx.currentInstruction}`);
  }

  if (sections.length > 0) {
    parts.push("");
    parts.push(sections.map((s) => s.text).join("\n\n"));
  }

  return parts.join("\n");
};

/** Shared documents available in the workspace. */
export const docsPromptSection: PromptSection = async (ctx) => {
  const docs = await ctx.provider.documents.list();
  if (docs.length === 0) return null;
  return `## Shared Documents\n\nAvailable: ${docs.join(", ")}`;
};

/** All workspace prompt sections, in order. */
export const WORKSPACE_PROMPT_SECTIONS: PromptSection[] = [
  workspacePromptSection,
  conversationSection,
  docsPromptSection,
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMessage(m: Message): string {
  const time = m.timestamp.split("T")[1]?.slice(0, 5) ?? "";
  let content = m.content;
  if (content.length > MSG_PREVIEW_LIMIT) {
    content = content.slice(0, MSG_PREVIEW_LIMIT) + "...";
  }
  const header = `<msg:${m.id}> [${time}] @${m.from}`;
  if (content.includes("\n") || content.length > 80) {
    const body = content.split("\n").map((l) => l ? `  ${l}` : "").join("\n");
    return `${header}\n${body}`;
  }
  return `${header}: ${content}`;
}
