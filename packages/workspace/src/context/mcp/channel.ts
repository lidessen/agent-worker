import type { ContextProvider } from "../../types.ts";

export interface ChannelTools {
  channel_send: (args: { channel: string; content: string; to?: string }) => Promise<string>;
  channel_read: (args: { channel: string; limit?: number }) => Promise<string>;
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
      // Strip leading # — agents often write "#general" instead of "general"
      const channel = args.channel.replace(/^#/, "");
      const { content, to } = args;
      try {
        const msg = await provider.send({ channel, from: agentName, content, to });
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
      if (messages.length === 0) return `#${channel}: no messages`;

      const lines = messages.map((m) => `[${m.id}] @${m.from}: ${m.content}`);
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
