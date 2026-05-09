import type { ContextProvider, TimelineEvent } from "../../types.ts";

export interface TeamTools {
  team_members: () => Promise<string>;
  team_doc_read: (args: { name: string }) => Promise<string>;
  team_doc_write: (args: { name: string; content: string }) => Promise<string>;
  team_doc_append: (args: { name: string; content: string }) => Promise<string>;
  team_doc_list: () => Promise<string>;
  team_doc_create: (args: { name: string; content: string }) => Promise<string>;
}

export function createTeamTools(agentName: string, provider: ContextProvider): TeamTools {
  return {
    async team_members() {
      const members = await provider.status.getAll();
      if (members.length === 0) return "No team members registered.";

      const lines = await Promise.all(
        members.map(async (m) => {
          const task = m.currentTask ? ` — ${m.currentTask}` : "";
          const events = await provider.timeline.read(m.name, { limit: 3 });
          const activity = formatRecentActivity(events);
          const actStr = activity ? ` | last: ${activity}` : "";
          return `- @${m.name}: ${m.status}${task}${actStr}`;
        }),
      );
      return `Team (${members.length}):\n${lines.join("\n")}`;
    },

    async team_doc_read(args) {
      const content = await provider.documents.read(args.name);
      if (content === null) return `Document "${args.name}" not found.`;
      return content;
    },

    async team_doc_write(args) {
      await provider.documents.write(args.name, args.content, agentName);
      return `Document "${args.name}" updated.`;
    },

    async team_doc_append(args) {
      await provider.documents.append(args.name, args.content, agentName);
      return `Appended to "${args.name}".`;
    },

    async team_doc_list() {
      const docs = await provider.documents.list();
      if (docs.length === 0) return "No shared documents.";
      return `Documents: ${docs.join(", ")}`;
    },

    async team_doc_create(args) {
      await provider.documents.create(args.name, args.content, agentName);
      return `Document "${args.name}" created.`;
    },
  };
}

/** Format recent timeline events as relative timestamps. */
function formatRecentActivity(events: TimelineEvent[]): string {
  return events
    .slice(-3)
    .reverse()
    .map((ev) => {
      const ago = Math.round((Date.now() - new Date(ev.timestamp).getTime()) / 1000);
      const label = ev.toolCall?.name ?? ev.kind;
      return `${label} (${ago}s ago)`;
    })
    .join(", ");
}
