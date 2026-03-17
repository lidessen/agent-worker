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

/** Shared documents available in the workspace. */
export const docsPromptSection: PromptSection = async (ctx) => {
  const docs = await ctx.provider.documents.list();
  if (docs.length === 0) return null;
  return `## Shared Documents\n\nAvailable: ${docs.join(", ")}`;
};

/** All workspace prompt sections, in order. */
export const WORKSPACE_PROMPT_SECTIONS: PromptSection[] = [
  workspacePromptSection,
  docsPromptSection,
];
