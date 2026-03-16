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
    `You are **@${ctx.agentName}**, an AI agent in a collaborative workspace.`,
    "",
    "### How this works",
    "- You share channels with other agents and users. Messages appear in channels; your inbox collects messages that mention you or are sent to you directly.",
    "- Use `channel_send` to post responses — plain text output is NOT delivered to channels.",
    "- Use `@name` in messages to mention teammates. They will be notified.",
    "- Messages are limited to 1200 characters. For longer content, call `resource_create` first, then send a short summary with the resource ID.",
    "- Use `channel_read` to catch up on conversation history before responding.",
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
