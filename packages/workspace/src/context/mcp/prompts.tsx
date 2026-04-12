/** @jsxImportSource semajsx/prompt */

import type { PromptSection } from "../../loop/prompt.tsx";
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
  return (
    <section title="Workspace">
      <raw>
        {`You are **@${ctx.agentName}** in a collaborative workspace with channels, teammates, and shared documents.`}
      </raw>
      <br />
      {isLead && (
        <>
          <line>You are the workspace lead</line>
          <item>
            You are responsible for responding to user messages, even if they don&apos;t @ you
            directly.
          </item>
          <item>
            Unmentioned messages from users (e.g. telegram) are routed to you at normal priority.
          </item>
          <item>You have access to debug tools and can see all channels.</item>
          <item>Coordinate the team, review work, and report back to the user.</item>
          <br />
        </>
      )}
      <line>Key mechanics</line>
      <item>
        `channel_send` posts to channels. Plain text output is your private thinking -- only you see
        it.
      </item>
      <item>`@name` in messages notifies that teammate.</item>
      <item>
        Messages over 1200 chars: use `resource_create` first, then send a summary with the resource
        ID.
      </item>
      <item>`channel_read` shows full conversation history beyond what&apos;s shown below.</item>
      <br />
      <line>Directories</line>
      <field label="Personal sandbox" value={`\`${ctx.sandboxDir ?? "(not available)"}\``} />
      <field
        label="Shared workspace"
        value={`\`${ctx.workspaceSandboxDir ?? "(not available)"}\``}
      />
      <br />
      <line>Channels</line>
      {channels.length > 0 ? (
        channels.map((channel) => <item key={channel}>{`#${channel}`}</item>)
      ) : (
        <item>(none)</item>
      )}
      {teammates.length > 0 && (
        <>
          <br />
          <line>Teammates</line>
          {teammates.map((teammate) => (
            <item key={teammate.name}>{`@${teammate.name}: ${teammate.status}`}</item>
          ))}
        </>
      )}
    </section>
  );
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

  let instructionInTimeline = false;
  const channelSections = await Promise.all(
    channels.map(async (ch) => {
      const allMsgs = await ctx.provider.channels.read(ch);
      if (allMsgs.length === 0) return null;

      const total = allMsgs.length;
      const recent = allMsgs.slice(-RECENT_MSG_LIMIT);
      const omitted = total - recent.length;
      let foundCurrent = false;
      const messageBlocks = recent.map((m) => {
        const isCurrent = ctx.currentMessageId === m.id;
        if (isCurrent) foundCurrent = true;
        const marker = isCurrent ? "→ " : "  ";
        const formatted = formatMessage(m);
        return formatted
          .split("\n")
          .map((line, i) => (i === 0 ? `${marker}${line}` : `  ${line}`))
          .join("\n");
      });

      let header = `#${ch}:`;
      if (omitted > 0) {
        header += ` (${omitted} earlier -- use \`channel_read\` with higher \`limit\` to see more)`;
      }
      if (foundCurrent) instructionInTimeline = true;
      return (
        <>
          <line key={`header.${ch}`}>{header}</line>
          <indent key={`messages.${ch}`}>
            {messageBlocks.map((block, index) => (
              <raw key={`message.${ch}.${index}`}>{block}</raw>
            ))}
          </indent>
        </>
      );
    }),
  );

  const visibleChannels = channelSections.filter((section) => section !== null);

  return (
    <section title="Conversation">
      {!instructionInTimeline && ctx.currentInstruction && (
        <>
          <raw>{`**Respond to:** ${ctx.currentInstruction}`}</raw>
          <br />
        </>
      )}
      {visibleChannels.map((section, index) => (
        <>
          {section}
          {index < visibleChannels.length - 1 && <br />}
        </>
      ))}
    </section>
  );
};

/** Shared documents available in the workspace. */
export const docsPromptSection: PromptSection = async (ctx) => {
  const docs = await ctx.provider.documents.list();
  if (docs.length === 0) return null;
  return (
    <section title="Shared Documents">
      <line>{`Available: ${docs.join(", ")}`}</line>
    </section>
  );
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
    const body = content
      .split("\n")
      .map((l) => (l ? `  ${l}` : ""))
      .join("\n");
    return `${header}\n${body}`;
  }
  return `${header}: ${content}`;
}
