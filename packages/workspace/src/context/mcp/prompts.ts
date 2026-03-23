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

  const lines = [
    "## Workspace",
    "",
    `You are **@${ctx.agentName}** in a collaborative workspace with channels, teammates, and shared documents.`,
    "",
    "### Key mechanics",
    "- `channel_send` posts to channels. Plain text output is your private thinking — only you see it.",
    "- `@name` in messages notifies that teammate.",
    "- Messages over 1200 chars: use `resource_create` first, then send a summary with the resource ID.",
    "- `channel_read` shows full conversation history beyond what's shown below.",
    "",
    "### Directories",
    `- Personal sandbox: \`${ctx.sandboxDir ?? "(not available)"}\``,
    `- Shared workspace: \`${ctx.workspaceSandboxDir ?? "(not available)"}\``,
    "",
    "### Channels",
    channels.length > 0 ? channels.map((ch) => `- #${ch}`).join("\n") : "- (none)",
  ];

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

  const sections: string[] = [];

  for (const ch of channels) {
    const allMsgs = await ctx.provider.channels.read(ch);
    if (allMsgs.length === 0) continue;

    const total = allMsgs.length;
    const recent = allMsgs.slice(-RECENT_MSG_LIMIT);
    const omitted = total - recent.length;

    const lines = recent.map((m) => {
      const isCurrent = ctx.currentMessageId === m.id;
      const marker = isCurrent ? "→ " : "  ";
      return `${marker}${formatMessage(m)}`;
    });

    let header = `#${ch}:`;
    if (omitted > 0) {
      header += ` (${omitted} earlier — use \`channel_read\` with higher \`limit\` to see more)`;
    }
    sections.push(`${header}\n${lines.join("\n")}`);
  }

  // If the instruction didn't come from a channel (e.g. direct/API), show it separately
  const instructionInTimeline = ctx.currentMessageId && sections.some((s) => s.includes(`→ `));

  const parts: string[] = ["## Conversation"];

  if (!instructionInTimeline && ctx.currentInstruction) {
    parts.push("");
    parts.push(`**Respond to:** ${ctx.currentInstruction}`);
  }

  if (sections.length > 0) {
    parts.push("");
    parts.push("Truncated messages show `<msg:ID>` — use `channel_read` to see full text.");
    parts.push("");
    parts.push(sections.join("\n\n"));
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
  const content = m.content;
  if (content.length > MSG_PREVIEW_LIMIT) {
    const preview = content.slice(0, MSG_PREVIEW_LIMIT);
    return `[${time}] @${m.from}: ${preview}… <msg:${m.id}>`;
  }
  return `[${time}] @${m.from}: ${content}`;
}
