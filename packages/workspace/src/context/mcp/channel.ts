import type { ContextProvider, Priority } from "../../types.ts";

export interface ChannelTools {
  channel_send: (args: {
    channel: string;
    content: string;
    to?: string;
  }) => Promise<string>;
  channel_read: (args: {
    channel: string;
    limit?: number;
  }) => Promise<string>;
  channel_list: () => Promise<string>;
  channel_join: (args: { channel: string }) => Promise<string>;
  channel_leave: (args: { channel: string }) => Promise<string>;
}

export function createChannelTools(
  agentName: string,
  provider: ContextProvider,
  agentChannels: Set<string>,
): ChannelTools {
  return {
    async channel_send(args) {
      const { channel, content, to } = args;
      const msg = await provider.smartSend(channel, agentName, content, { to });
      return `Sent message ${msg.id} to #${channel}`;
    },

    async channel_read(args) {
      const { channel, limit } = args;
      const messages = await provider.channels.read(channel, { limit: limit ?? 20 });
      if (messages.length === 0) return `#${channel}: no messages`;

      const lines = messages.map(
        (m) => `[${m.id}] @${m.from}: ${m.content}`,
      );
      return `#${channel} (${messages.length} messages):\n${lines.join("\n")}`;
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
      agentChannels.add(args.channel);
      return `Joined #${args.channel}`;
    },

    async channel_leave(args) {
      agentChannels.delete(args.channel);
      return `Left #${args.channel}`;
    },
  };
}
