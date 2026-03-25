#!/usr/bin/env bun
/**
 * Stdio MCP server entry point for workspace tools.
 *
 * Launched as a subprocess by CLI agents (claude-code, codex, cursor).
 * Connects to the daemon HTTP API to proxy workspace tool calls.
 *
 * Usage: bun stdio-entry.ts <daemon-url> <token> <workspace> <agent>
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const [daemonUrl, token, workspace, agent] = process.argv.slice(2);
if (!daemonUrl || !token || !workspace || !agent) {
  console.error("Usage: stdio-entry.ts <daemon-url> <token> <workspace> <agent>");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

async function callWorkspaceTool(name: string, args: Record<string, unknown>): Promise<string> {
  // Route tool calls through the daemon's send API or directly call workspace endpoints
  const toolMap: Record<string, () => Promise<string>> = {
    channel_send: async () => {
      const ch = (args.channel as string)?.replace(/^#/, "") ?? "general";
      const res = await fetch(`${daemonUrl}/workspaces/${workspace}/send`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: args.content, from: agent, channel: ch, agent: args.to }),
      });
      const data = (await res.json()) as { sent?: boolean };
      return data.sent ? `Sent to #${ch}` : "Send failed";
    },
    channel_read: async () => {
      const ch = (args.channel as string)?.replace(/^#/, "") ?? "general";
      const limit = (args.limit as number) ?? 20;
      const res = await fetch(
        `${daemonUrl}/workspaces/${workspace}/channels/${ch}?limit=${limit}`,
        { headers },
      );
      const data = (await res.json()) as {
        messages?: Array<{ id: string; from: string; content: string }>;
      };
      if (!data.messages?.length) return `#${ch}: no messages`;
      const lines = data.messages.map(
        (m: { id: string; from: string; content: string }) => `[${m.id}] @${m.from}: ${m.content}`,
      );
      return `#${ch} (${data.messages.length} messages):\n${lines.join("\n")}`;
    },
    channel_list: async () => {
      const res = await fetch(`${daemonUrl}/workspaces/${workspace}/channels`, { headers });
      const data = (await res.json()) as { channels: string[] };
      return `Channels: ${data.channels.join(", ")}`;
    },
    no_action: async () => {
      return `No action taken: ${args.reason}`;
    },
    team_members: async () => {
      const res = await fetch(`${daemonUrl}/workspaces/${workspace}/status`, { headers });
      const data = (await res.json()) as {
        agents?: Array<{ name: string; status: string; currentTask?: string }>;
      };
      if (!data.agents?.length) return "No team members";
      const lines = data.agents.map((a) => {
        const task = a.currentTask ? ` — ${a.currentTask}` : "";
        return `@${a.name}: ${a.status}${task}`;
      });
      return lines.join("\n");
    },
  };

  const handler = toolMap[name];
  if (handler) return handler();
  return `Unknown tool: ${name}`;
}

// Build MCP server
const server = new McpServer({ name: `workspace-${agent}`, version: "0.0.1" });

const toolDefs: Record<string, { desc: string; params: Record<string, z.ZodTypeAny> }> = {
  channel_send: {
    desc: "Send a message to a channel (max 1200 chars). Guard checks for new messages since you last read — use force=true to bypass.",
    params: {
      channel: z.string().describe("Channel name"),
      content: z.string().describe("Message content"),
      to: z.string().optional().describe("DM recipient"),
      force: z.boolean().optional().describe("Bypass the new-message guard"),
    },
  },
  channel_read: {
    desc: "Read recent messages from a channel",
    params: {
      channel: z.string().describe("Channel name"),
      limit: z.number().optional().describe("Max messages (default: 20)"),
    },
  },
  channel_list: {
    desc: "List available channels",
    params: {},
  },
  no_action: {
    desc: "Explicitly decline to act — use when message is not relevant to you or is a loop",
    params: {
      reason: z.string().describe("Why you chose not to act"),
    },
  },
  team_members: {
    desc: "List team members and their status",
    params: {},
  },
};

for (const [name, def] of Object.entries(toolDefs)) {
  const handler = async (args: Record<string, unknown>) => {
    const text = await callWorkspaceTool(name, args);
    return { content: [{ type: "text" as const, text }] };
  };
  if (Object.keys(def.params).length > 0) {
    server.tool(name, def.desc, def.params, handler);
  } else {
    server.tool(name, def.desc, handler);
  }
}

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
