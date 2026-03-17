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

      const lines: string[] = [];
      for (const entry of entries) {
        const msg = await provider.channels.getMessage(entry.channel, entry.messageId);
        if (!msg) continue;
        const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
        lines.push(
          `- [${msg.id}] #${entry.channel} from:@${msg.from}${priority}: "${msg.content}"`,
        );
      }
      return `Inbox (${lines.length} pending):\n${lines.join("\n")}`;
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
