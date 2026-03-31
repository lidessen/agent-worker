import type { PromptSection } from "../../loop/prompt.ts";
import type { Message } from "../../types.ts";
import type { PromptBlock } from "../../loop/prompt-ui.tsx";

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

  const blocks: PromptBlock[] = [
    {
      kind: "raw",
      text: `You are **@${ctx.agentName}** in a collaborative workspace with channels, teammates, and shared documents.`,
    },
    { kind: "break" },
  ];

  if (isLead) {
    blocks.push({ kind: "line", text: "You are the workspace lead" });
    blocks.push({
      kind: "item",
      text: "You are responsible for responding to user messages, even if they don't @ you directly.",
    });
    blocks.push({
      kind: "item",
      text: "Unmentioned messages from users (e.g. telegram) are routed to you at normal priority.",
    });
    blocks.push({ kind: "item", text: "You have access to debug tools and can see all channels." });
    blocks.push({ kind: "item", text: "Coordinate the team, review work, and report back to the user." });
    blocks.push({ kind: "break" });
  }

  blocks.push({ kind: "line", text: "Key mechanics" });
  blocks.push({
    kind: "item",
    text: "`channel_send` posts to channels. Plain text output is your private thinking -- only you see it.",
  });
  blocks.push({ kind: "item", text: "`@name` in messages notifies that teammate." });
  blocks.push({
    kind: "item",
    text: "Messages over 1200 chars: use `resource_create` first, then send a summary with the resource ID.",
  });
  blocks.push({
    kind: "item",
    text: "`channel_read` shows full conversation history beyond what's shown below.",
  });
  blocks.push({ kind: "break" });
  blocks.push({ kind: "line", text: "Directories" });
  blocks.push({ kind: "field", label: "Personal sandbox", value: `\`${ctx.sandboxDir ?? "(not available)"}\`` });
  blocks.push({
    kind: "field",
    label: "Shared workspace",
    value: `\`${ctx.workspaceSandboxDir ?? "(not available)"}\``,
  });
  blocks.push({ kind: "break" });
  blocks.push({ kind: "line", text: "Channels" });

  if (channels.length > 0) {
    for (const channel of channels) {
      blocks.push({ kind: "item", text: `#${channel}` });
    }
  } else {
    blocks.push({ kind: "item", text: "(none)" });
  }

  if (teammates.length > 0) {
    blocks.push({ kind: "break" });
    blocks.push({ kind: "line", text: "Teammates" });
    for (const teammate of teammates) {
      blocks.push({ kind: "item", text: `@${teammate.name}: ${teammate.status}` });
    }
  }

  return {
    title: "Workspace",
    blocks,
  };
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

  const blocks: PromptBlock[] = [];
  let instructionInTimeline = false;

  for (const ch of channels) {
    const allMsgs = await ctx.provider.channels.read(ch);
    if (allMsgs.length === 0) continue;

    const total = allMsgs.length;
    const recent = allMsgs.slice(-RECENT_MSG_LIMIT);
    const omitted = total - recent.length;

    let foundCurrent = false;
    const messageBlocks = recent.map((m) => {
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
    if (foundCurrent) instructionInTimeline = true;

    blocks.push({ kind: "line", text: header });
    blocks.push({
      kind: "indent",
      blocks: messageBlocks.map((block) => ({ kind: "raw", text: block })),
    });
    blocks.push({ kind: "break" });
  }

  if (!instructionInTimeline && ctx.currentInstruction) {
    blocks.unshift({ kind: "break" });
    blocks.unshift({ kind: "raw", text: `**Respond to:** ${ctx.currentInstruction}` });
  }

  if (blocks.length > 0 && blocks[blocks.length - 1]?.kind === "break") {
    blocks.pop();
  }

  return {
    title: "Conversation",
    blocks,
  };
};

/** Shared documents available in the workspace. */
export const docsPromptSection: PromptSection = async (ctx) => {
  const docs = await ctx.provider.documents.list();
  if (docs.length === 0) return null;
  return {
    title: "Shared Documents",
    blocks: [{ kind: "line", text: `Available: ${docs.join(", ")}` }],
  };
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
