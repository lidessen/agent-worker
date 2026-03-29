import type { ContextProvider } from "../../types.ts";
import { createChannelTools } from "./channel.ts";
import { createInboxTools } from "./inbox.ts";
import { createTeamTools } from "./team.ts";
import { createResourceTools } from "./resource.ts";

export interface WorkspaceToolSet {
  [name: string]: (args: Record<string, unknown>) => Promise<string>;
}

/** Create all workspace tools for a given agent. */
export function createWorkspaceTools(
  agentName: string,
  provider: ContextProvider,
  agentChannels: Set<string>,
  lookupAgentChannels?: (name: string) => Set<string> | undefined,
): WorkspaceToolSet {
  const channelTools = createChannelTools(agentName, provider, agentChannels, lookupAgentChannels);
  const inboxTools = createInboxTools(agentName, provider);
  const teamTools = createTeamTools(agentName, provider);
  const resourceTools = createResourceTools(agentName, provider);

  return {
    // Channel tools
    channel_send: (args) =>
      channelTools.channel_send(args as Parameters<typeof channelTools.channel_send>[0] & { force?: boolean }),
    channel_read: (args) =>
      channelTools.channel_read(args as Parameters<typeof channelTools.channel_read>[0]),
    channel_list: () => channelTools.channel_list(),
    channel_join: (args) =>
      channelTools.channel_join(args as Parameters<typeof channelTools.channel_join>[0]),
    channel_leave: (args) =>
      channelTools.channel_leave(args as Parameters<typeof channelTools.channel_leave>[0]),

    // Inbox tools
    wait_inbox: async (args) => {
      const timeoutMs = (args.timeout as number) ?? 60000;
      const result = await Promise.race([
        provider.inbox.onNewEntry(agentName).then(() => "received" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
      ]);

      if (result === "timeout") {
        return "Timeout: no new inbox messages.";
      }

      // Return current inbox contents using same format as my_inbox
      const entries = await provider.inbox.peek(agentName);
      if (entries.length === 0) return "New message received. Inbox: empty (already processed).";

      const lines: string[] = [];
      for (const entry of entries) {
        const msg = await provider.channels.getMessage(entry.channel, entry.messageId);
        if (!msg) continue;
        const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
        lines.push(
          `- [${msg.id}] #${entry.channel} from:@${msg.from}${priority}: "${msg.content}"`,
        );
      }
      return `New message received. Inbox (${lines.length} pending):\n${lines.join("\n")}`;
    },
    my_inbox: () => inboxTools.my_inbox(),
    my_inbox_ack: (args) =>
      inboxTools.my_inbox_ack(args as Parameters<typeof inboxTools.my_inbox_ack>[0]),
    my_inbox_defer: (args) =>
      inboxTools.my_inbox_defer(args as Parameters<typeof inboxTools.my_inbox_defer>[0]),
    no_action: (args) => inboxTools.no_action(args as Parameters<typeof inboxTools.no_action>[0]),
    my_status_set: (args) =>
      inboxTools.my_status_set(args as Parameters<typeof inboxTools.my_status_set>[0]),

    // Team tools
    team_members: () => teamTools.team_members(),
    team_doc_read: (args) =>
      teamTools.team_doc_read(args as Parameters<typeof teamTools.team_doc_read>[0]),
    team_doc_write: (args) =>
      teamTools.team_doc_write(args as Parameters<typeof teamTools.team_doc_write>[0]),
    team_doc_append: (args) =>
      teamTools.team_doc_append(args as Parameters<typeof teamTools.team_doc_append>[0]),
    team_doc_list: () => teamTools.team_doc_list(),
    team_doc_create: (args) =>
      teamTools.team_doc_create(args as Parameters<typeof teamTools.team_doc_create>[0]),

    // Resource tools
    resource_create: (args) =>
      resourceTools.resource_create(args as Parameters<typeof resourceTools.resource_create>[0]),
    resource_read: (args) =>
      resourceTools.resource_read(args as Parameters<typeof resourceTools.resource_read>[0]),

    // Chronicle tools
    chronicle_append: async (args) => {
      const { category, content } = args as { category: string; content: string };
      const entry = await provider.chronicle.append({ author: agentName, category, content });
      return `Chronicle entry recorded: ${entry.id}`;
    },
    chronicle_read: async (args) => {
      const { limit, category } = args as { limit?: number; category?: string };
      const entries = await provider.chronicle.read({ limit, category });
      if (entries.length === 0) return "No chronicle entries.";
      return entries
        .map((e) => `[${e.timestamp}] ${e.category} (@${e.author}): ${e.content}`)
        .join("\n");
    },
  };
}

/** Tool descriptions for MCP server registration. */
export const WORKSPACE_TOOL_DEFS = {
  channel_send: {
    description:
      "Send a message to a channel. The guard checks for new messages since you last " +
      "read the channel — if others posted, you'll get a warning with their messages. " +
      "Review and call again with force=true to send anyway, or adjust your message. " +
      "Content must be under 1200 characters. " +
      "For longer content, first call resource_create to store it, then send a short " +
      "message here that summarizes the content and includes the resource ID so others " +
      "can call resource_read to view the full version.",
    parameters: {
      channel: { type: "string", description: "Channel name" },
      content: {
        type: "string",
        description: "Message content (max 1200 chars). Reference resource IDs for large content.",
      },
      to: { type: "string", description: "DM recipient (optional)" },
      force: {
        type: "boolean",
        description: "Bypass the new-message guard (send even if channel has new messages)",
      },
    },
    required: ["channel", "content"],
  },
  channel_read: {
    description: "Read recent messages from a channel",
    parameters: {
      channel: { type: "string", description: "Channel name" },
      limit: { type: "number", description: "Max messages to return (default: 20)" },
    },
    required: ["channel"],
  },
  channel_list: {
    description: "List available channels and your subscriptions",
    parameters: {},
    required: [],
  },
  channel_join: {
    description: "Join a channel to receive messages",
    parameters: {
      channel: { type: "string", description: "Channel name" },
    },
    required: ["channel"],
  },
  channel_leave: {
    description: "Leave a channel",
    parameters: {
      channel: { type: "string", description: "Channel name" },
    },
    required: ["channel"],
  },
  wait_inbox: {
    description:
      "Block and wait for a new inbox message. Returns when a message arrives or timeout expires.",
    parameters: {
      timeout: { type: "number", description: "Max wait in ms (default 60000)" },
    },
    required: [],
  },
  my_inbox: {
    description: "View your pending inbox messages",
    parameters: {},
    required: [],
  },
  my_inbox_ack: {
    description: "Acknowledge a message (remove from inbox)",
    parameters: {
      message_id: { type: "string", description: "Message ID to acknowledge" },
    },
    required: ["message_id"],
  },
  my_inbox_defer: {
    description: "Defer a message for later processing",
    parameters: {
      message_id: { type: "string", description: "Message ID to defer" },
      until: { type: "string", description: "ISO timestamp to defer until (optional)" },
    },
    required: ["message_id"],
  },
  no_action: {
    description:
      "Explicitly decline to act on the current task. Use this instead of staying silent " +
      "when you've read the message but determined you should not respond — e.g. the message " +
      "is not relevant to you, it's a loop you shouldn't continue, or another agent is better suited.",
    parameters: {
      reason: { type: "string", description: "Why you chose not to act" },
    },
    required: ["reason"],
  },
  my_status_set: {
    description: "Update your status",
    parameters: {
      status: { type: "string", description: "idle | running | stopped" },
      task: { type: "string", description: "Current task description (optional)" },
    },
    required: ["status"],
  },
  team_members: {
    description: "List all team members and their status",
    parameters: {},
    required: [],
  },
  team_doc_read: {
    description: "Read a shared document",
    parameters: {
      name: { type: "string", description: "Document name" },
    },
    required: ["name"],
  },
  team_doc_write: {
    description: "Write/overwrite a shared document",
    parameters: {
      name: { type: "string", description: "Document name" },
      content: { type: "string", description: "Document content" },
    },
    required: ["name", "content"],
  },
  team_doc_append: {
    description: "Append to a shared document",
    parameters: {
      name: { type: "string", description: "Document name" },
      content: { type: "string", description: "Content to append" },
    },
    required: ["name", "content"],
  },
  team_doc_list: {
    description: "List all shared documents",
    parameters: {},
    required: [],
  },
  team_doc_create: {
    description: "Create a new shared document",
    parameters: {
      name: { type: "string", description: "Document name" },
      content: { type: "string", description: "Initial content" },
    },
    required: ["name", "content"],
  },
  resource_create: {
    description: "Create a resource for large content",
    parameters: {
      content: { type: "string", description: "Content to store" },
    },
    required: ["content"],
  },
  resource_read: {
    description: "Read a resource by ID. Use this to retrieve content stored via resource_create.",
    parameters: {
      id: { type: "string", description: "Resource ID" },
    },
    required: ["id"],
  },
  chronicle_append: {
    description:
      "Record an observation to the team chronicle — an append-only log of decisions, plans, " +
      "corrections, patterns, milestones, and insights. Unlike team_doc (editable shared docs), " +
      "chronicle entries are immutable and ordered by time.",
    parameters: {
      category: {
        type: "string",
        description:
          "Entry category: decision, plan, task, correction, pattern, milestone, or insight",
      },
      content: { type: "string", description: "Observation content" },
    },
    required: ["category", "content"],
  },
  chronicle_read: {
    description: "Read entries from the team chronicle, optionally filtered by category or limited to recent entries.",
    parameters: {
      limit: { type: "number", description: "Max entries to return (most recent)" },
      category: { type: "string", description: "Filter by category" },
    },
    required: [],
  },
} as const;
