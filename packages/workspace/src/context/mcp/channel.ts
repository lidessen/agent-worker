import type { ContextProvider } from "../../types.ts";
import { extractMentions } from "../../utils.ts";

export interface ChannelTools {
  channel_send: (args: {
    channel: string;
    content: string;
    to?: string;
    force?: boolean;
  }) => Promise<string>;
  channel_read: (args: { channel: string; limit?: number }) => Promise<string>;
  channel_list: () => Promise<string>;
  channel_join: (args: { channel: string }) => Promise<string>;
  channel_leave: (args: { channel: string }) => Promise<string>;
}

/**
 * Per-agent channel cursors — tracks the last message ID the agent has seen
 * in each channel (updated on channel_read and successful channel_send).
 */
export type ChannelCursors = Map<string, string>;

export function createChannelTools(
  agentName: string,
  provider: ContextProvider,
  agentChannels: Set<string>,
  /** Lookup function: returns the channels a registered agent has joined, or undefined if not a registered agent. */
  lookupAgentChannels?: (name: string) => Set<string> | undefined,
): ChannelTools {
  /** Cursor: channel → last-seen message ID. */
  const cursors: ChannelCursors = new Map();

  return {
    async channel_send(args) {
      // Strip leading # — agents often write "#general" instead of "general"
      const channel = args.channel.replace(/^#/, "");
      const { content, to, force } = args;

      // ── Channel send guard (optimistic concurrency) ──────────────
      // Like "read before write": check if the channel moved since we last read it.
      const cursor = cursors.get(channel);
      if (cursor !== undefined && !force) {
        const newMessages = await provider.channels.read(channel, { sinceId: cursor || undefined });
        // Filter out our own messages — we don't need to warn about those
        const othersMessages = newMessages.filter((m) => m.from !== agentName);
        if (othersMessages.length > 0) {
          const preview = othersMessages
            .slice(-5) // Show at most 5 recent messages
            .map((m) => `  @${m.from}: ${m.content.slice(0, 200)}${m.content.length > 200 ? "..." : ""}`)
            .join("\n");
          return (
            `⚠ ${othersMessages.length} new message(s) in #${channel} since you last read it:\n` +
            `${preview}\n\n` +
            "Review these messages — your response may be outdated or duplicate. " +
            "Call channel_send again with force=true to send anyway, or adjust your message."
          );
        }
      }

      // ── @mention guard ───────────────────────────────────────────
      // Before sending, verify that @mentioned agents are in this channel.
      if (lookupAgentChannels && !force) {
        const mentions = extractMentions(content);
        const notInChannel = mentions.filter((m) => {
          const channels = lookupAgentChannels(m);
          return channels !== undefined && !channels.has(channel);
        });
        if (notInChannel.length > 0) {
          const agentDetails = notInChannel
            .map((m) => {
              const channels = lookupAgentChannels(m)!;
              const channelList = [...channels].map((c) => `#${c}`).join(", ") || "no channels";
              return `  @${m} is in: ${channelList}`;
            })
            .join("\n");
          const agentList = notInChannel.map((m) => `@${m}`).join(", ");
          return (
            `⚠ ${agentList} ${notInChannel.length === 1 ? "is" : "are"} not subscribed to #${channel} — message not sent.\n` +
            `${agentDetails}\n\n` +
            "Re-send to a channel they're in, or call channel_send again with force=true to post anyway " +
            `(the message will appear in #${channel} but won't reach the mentioned agent).`
          );
        }
      }

      try {
        const msg = await provider.send({ channel, from: agentName, content, to });
        // Update cursor to our own message
        cursors.set(channel, msg.id);

        return `Sent message ${msg.id} to #${channel}`;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("too long")) {
          return (
            `ERROR: ${errMsg}\n\n` +
            "To fix: call resource_create with the full content, then call channel_send " +
            "with a short summary that includes the resource ID."
          );
        }
        throw err;
      }
    },

    async channel_read(args) {
      const channel = args.channel.replace(/^#/, "");
      const { limit } = args;
      const messages = await provider.channels.read(channel, { limit: limit ?? 20 });

      // Always update cursor — even on empty channel, mark "I've read up to here".
      // Empty string sentinel means "read the channel, it was empty".
      // The send guard will use sinceId="" which won't match any ID,
      // so readSinceId returns all messages — correct behavior.
      const lastMsg = messages[messages.length - 1];
      cursors.set(channel, lastMsg?.id ?? "");

      if (messages.length === 0) return `#${channel}: no messages`;

      const blocks = messages.map((m) => {
        const time = m.timestamp.split("T")[1]?.slice(0, 5) ?? "";
        const header = `<msg:${m.id}> ${time} @${m.from}`;
        // Indent multiline content for visual separation
        const body = m.content.includes("\n")
          ? m.content.split("\n").map((l) => l ? `  ${l}` : "").join("\n")
          : `  ${m.content}`;
        return `${header}\n${body}`;
      });
      return `#${channel} (${messages.length} messages):\n\n${blocks.join("\n\n")}`;
    },

    async channel_list() {
      const channels = provider.channels.listChannels();
      const joined = channels.filter((ch) => agentChannels.has(ch));
      const available = channels.filter((ch) => !agentChannels.has(ch));
      let result = `Joined: ${joined.join(", ") || "none"}`;
      if (available.length > 0) {
        result += `\nAvailable: ${available.join(", ")}`;
      }
      return result;
    },

    async channel_join(args) {
      const channel = args.channel.replace(/^#/, "");
      agentChannels.add(channel);
      return `Joined #${channel}`;
    },

    async channel_leave(args) {
      const channel = args.channel.replace(/^#/, "");
      agentChannels.delete(channel);
      return `Left #${channel}`;
    },
  };
}
