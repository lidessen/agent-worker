import type { PromptSection } from "../../loop/prompt.ts";

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
    "- `channel_read` shows conversation history — check it before responding to understand context.",
    "",
    "### Channels",
    channels.length > 0 ? channels.map((ch) => `- #${ch}`).join("\n") : "- (none)",
  ];

  if (teammates.length > 0) {
    lines.push(
      "",
      "### Teammates",
      ...teammates.map((m) => {
        const task = m.currentTask ? ` — ${m.currentTask}` : "";
        return `- @${m.name}: ${m.status}${task}`;
      }),
    );
  }

  return lines.join("\n");
};

/** Recent channel history so agents know what's already been said. */
export const recentHistorySection: PromptSection = async (ctx) => {
  const channels = ctx.provider.channels.listChannels();
  if (channels.length === 0) return null;

  const sections: string[] = [];
  for (const ch of channels) {
    const msgs = await ctx.provider.channels.read(ch, { limit: 10 });
    if (msgs.length === 0) continue;

    const lines = msgs.map((m) => `  @${m.from}: ${m.content.slice(0, 150)}`);
    sections.push(`#${ch}:\n${lines.join("\n")}`);
  }

  if (sections.length === 0) return null;
  return `## Recent Messages\n\n${sections.join("\n\n")}`;
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
  recentHistorySection,
  docsPromptSection,
];
