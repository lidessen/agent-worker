import type { ContextProvider } from "../../types.ts";

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

      const lines = members.map((m) => {
        const task = m.currentTask ? ` — ${m.currentTask}` : "";
        return `- @${m.name}: ${m.status}${task}`;
      });
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
