import type { ContextProvider, AgentStatus } from "../../types.ts";

export interface InboxTools {
  my_inbox: () => Promise<string>;
  my_inbox_ack: (args: { message_id: string }) => Promise<string>;
  my_inbox_defer: (args: { message_id: string; until?: string }) => Promise<string>;
  no_action: (args: { reason: string }) => Promise<string>;
  my_status_set: (args: { status: AgentStatus; task?: string }) => Promise<string>;
}

export function createInboxTools(agentName: string, provider: ContextProvider): InboxTools {
  return {
    async my_inbox() {
      const entries = await provider.inbox.peek(agentName);
      if (entries.length === 0) return "Inbox: empty";

      const lines = entries.map((entry) => {
        const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
        const preview = entry.preview.length >= 100 ? `${entry.preview}…` : entry.preview;
        return `- [${entry.messageId}] #${entry.channel} from:@${entry.from}${priority}: "${preview}"`;
      });
      return `Inbox (${lines.length} pending):\n${lines.join("\n")}\nUse channel_read to view full messages.`;
    },

    async my_inbox_ack(args) {
      await provider.inbox.ack(agentName, args.message_id);
      return `Acknowledged ${args.message_id}`;
    },

    async my_inbox_defer(args) {
      await provider.inbox.defer(agentName, args.message_id, args.until);
      return `Deferred ${args.message_id}${args.until ? ` until ${args.until}` : ""}`;
    },

    async no_action(args) {
      return `No action taken: ${args.reason}`;
    },

    async my_status_set(args) {
      await provider.status.set(agentName, args.status, args.task);
      return `Status set to ${args.status}`;
    },
  };
}
