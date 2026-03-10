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
): WorkspaceToolSet {
  const channelTools = createChannelTools(agentName, provider, agentChannels);
  const inboxTools = createInboxTools(agentName, provider);
  const teamTools = createTeamTools(agentName, provider);
  const resourceTools = createResourceTools(agentName, provider);

  return {
    // Channel tools
    channel_send: (args) =>
      channelTools.channel_send(args as Parameters<typeof channelTools.channel_send>[0]),
    channel_read: (args) =>
      channelTools.channel_read(args as Parameters<typeof channelTools.channel_read>[0]),
    channel_list: () => channelTools.channel_list(),
    channel_join: (args) =>
      channelTools.channel_join(args as Parameters<typeof channelTools.channel_join>[0]),
    channel_leave: (args) =>
      channelTools.channel_leave(args as Parameters<typeof channelTools.channel_leave>[0]),

    // Inbox tools
    my_inbox: () => inboxTools.my_inbox(),
    my_inbox_ack: (args) =>
      inboxTools.my_inbox_ack(args as Parameters<typeof inboxTools.my_inbox_ack>[0]),
    my_inbox_defer: (args) =>
      inboxTools.my_inbox_defer(args as Parameters<typeof inboxTools.my_inbox_defer>[0]),
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
  };
}

/** Tool descriptions for MCP server registration. */
export const WORKSPACE_TOOL_DEFS = {
  channel_send: {
    description: "Send a message to a channel",
    parameters: {
      channel: { type: "string", description: "Channel name" },
      content: { type: "string", description: "Message content" },
      to: { type: "string", description: "DM recipient (optional)" },
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
    description: "Read a resource by ID",
    parameters: {
      id: { type: "string", description: "Resource ID" },
    },
    required: ["id"],
  },
} as const;
