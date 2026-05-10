/** @jsxImportSource semajsx/prompt */
//
// Coord-flavored prompt sections: `inboxSection` and
// `responseGuidelines`. `COORDINATION_BASE_SECTIONS` lists the coord-
// specific additions to a prompt; consumers that want a full prompt
// for coord agents prepend substrate's `soulSection` themselves
// (orchestrator does this) — keeping this module free of a back-
// reference into the substrate's barrel avoids a TDZ circularity at
// module init time (substrate barrel re-exports `createHarness` which
// imports the coord type, and the coord type's package barrel
// re-exports this module).
//
// Per resolved Q #4 of the substrate cut blueprint: coord owns these
// sections because they reference channels, inbox entries, and
// agent-as-teammate semantics — none of which are universal substrate
// concerns.

import type { InboxEntry, PromptContext, PromptSection } from "@agent-worker/harness";

/** Pending inbox notifications for the agent (excluding the current instruction). */
export const inboxSection: PromptSection = async (ctx) => {
  const pending = ctx.inboxEntries.filter((e) => e.messageId !== ctx.currentMessageId);
  if (pending.length === 0) return null;

  const byChannel = new Map<string, InboxEntry[]>();
  for (const entry of pending) {
    const entries = byChannel.get(entry.channel) ?? [];
    entries.push(entry);
    byChannel.set(entry.channel, entries);
  }

  const groups = Array.from(byChannel.entries());
  return (
    <section title={`Pending Inbox (${pending.length})`}>
      {groups.map(([channel, entries], groupIndex) => {
        const recent = entries.slice(-2);
        const hiddenCount = entries.length - recent.length;
        return (
          <>
            <line key={`channel.${channel}`}>{`#${channel} (${entries.length} new)`}</line>
            {recent.map((entry) => {
              const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
              const preview = entry.preview.length >= 100 ? `${entry.preview}…` : entry.preview;
              return (
                <item key={`entry.${entry.messageId}`}>
                  {`@${entry.from}${priority}: "${preview}"`}
                </item>
              );
            })}
            {hiddenCount > 0 && <item key={`more.${channel}`}>{`+${hiddenCount} more`}</item>}
            {groupIndex < groups.length - 1 && <br key={`break.${channel}`} />}
          </>
        );
      })}
      <br />
      <line>Use channel_read for full messages.</line>
    </section>
  );
};

/** Guidelines for when to respond vs stay silent (coord-shaped: channel_send, no_action, teammates). */
export const responseGuidelines: PromptSection = async (ctx: PromptContext) => {
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

  return (
    <section title="Communication">
      <raw>{text}</raw>
    </section>
  );
};

/**
 * Coord-specific prompt sections (`responseGuidelines` and
 * `inboxSection`). Consumers compose with substrate's `soulSection`
 * (and any capability-specific sections) at use site; the orchestrator
 * does this for coord agents.
 */
export const COORDINATION_BASE_SECTIONS: PromptSection[] = [
  responseGuidelines,
  inboxSection,
];
