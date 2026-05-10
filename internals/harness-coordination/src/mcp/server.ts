// Coord-flavored MCP tool builder and tool definition catalog.
//
// `createCoordinationTools` builds the per-agent tool set that
// `multiAgentCoordinationHarnessType.contributeMcpTools` returns:
// channel_*, my_inbox*, no_action, my_status_set, team_*, and
// wait_inbox. Substrate's tool builder owns the universal slice
// (resource_*, chronicle_*, task_*/wake_*/handoff_*, worktree_*).
//
// `COORDINATION_TOOL_DEFS` is a static catalog mirroring the same
// surface — used by stdio-entry / MCP servers to register tool
// metadata without a live Harness instance.

import type {
  ContextProvider,
  HarnessToolHandler,
  HarnessToolSet,
  ToolDef,
} from "@agent-worker/harness";
import { createChannelTools } from "./channel.ts";
import { createInboxTools } from "./inbox.ts";
import { createTeamTools } from "./team.ts";

export interface CoordinationToolsContext {
  agentName: string;
  provider: ContextProvider;
  agentChannels: Set<string>;
  /** Lookup function: returns the channels a registered agent has joined, or undefined if not a registered agent. */
  lookupAgentChannels?: (name: string) => Set<string> | undefined;
}

/** Build the coord-flavored tool set bound to a single agent. */
export function createCoordinationTools(ctx: CoordinationToolsContext): HarnessToolSet {
  const { agentName, provider, agentChannels, lookupAgentChannels } = ctx;
  const channelTools = createChannelTools(agentName, provider, agentChannels, lookupAgentChannels);
  const inboxTools = createInboxTools(agentName, provider);
  const teamTools = createTeamTools(agentName, provider);

  return {
    // Channel tools
    channel_send: (args) =>
      channelTools.channel_send(
        args as Parameters<typeof channelTools.channel_send>[0] & { force?: boolean },
      ),
    channel_read: (args) =>
      channelTools.channel_read(args as Parameters<typeof channelTools.channel_read>[0]),
    channel_list: () => channelTools.channel_list(),
    channel_join: (args) =>
      channelTools.channel_join(args as Parameters<typeof channelTools.channel_join>[0]),
    channel_leave: (args) =>
      channelTools.channel_leave(args as Parameters<typeof channelTools.channel_leave>[0]),

    // Inbox tools
    wait_inbox: async (args) => {
      // 5-minute default: Phase 1 validation observed 60s being
      // too short for lead agents that wait for coder workers —
      // hitting the timeout woke the lead redundantly for no new
      // work. 5 minutes matches a typical worker run length for
      // a small multi-file task and still caps the block so
      // runaway waits surface.
      const timeoutMs = (args.timeout as number) ?? 300_000;
      const result = await Promise.race([
        provider.inbox.onNewEntry(agentName).then(() => "received" as const),
        new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
      ]);

      if (result === "timeout") {
        return "Timeout: no new inbox messages.";
      }

      // Return current inbox contents using same format as my_inbox.
      // Mark returned entries as seen so the orchestrator's next tick
      // (after this run ends) does not re-enqueue them as a fresh run.
      // Crash recovery is still correct: on daemon restart,
      // markRunStart flips seen → pending so the agent gets another
      // chance to process them.
      const entries = await provider.inbox.peek(agentName);
      if (entries.length === 0) return "New message received. Inbox: empty (already processed).";

      for (const entry of entries) {
        await provider.inbox.markSeen(agentName, entry.messageId);
      }

      const lines = entries.map((entry) => {
        const priority = entry.priority !== "normal" ? ` [${entry.priority}]` : "";
        const preview = entry.preview.length >= 100 ? `${entry.preview}…` : entry.preview;
        return `- [${entry.messageId}] #${entry.channel} from:@${entry.from}${priority}: "${preview}"`;
      });
      return `New message received. Inbox (${lines.length} pending):\n${lines.join("\n")}\nUse channel_read to view full messages.`;
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
  } satisfies Record<string, HarnessToolHandler>;
}

/**
 * Static tool-definition catalog for the coord-flavored tool set.
 * Mirrors the names returned by `createCoordinationTools`. Consumers
 * that need a tool catalog without a live Harness (stdio-entry, MCP
 * server registration) read this directly.
 */
export const COORDINATION_TOOL_DEFS: Record<string, ToolDef> = {
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
      timeout: { type: "number", description: "Max wait in ms (default 300000 = 5 minutes)" },
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
};
