import type { ContextProvider } from "../../types.ts";

export interface ResourceTools {
  resource_create: (args: { content: string }) => Promise<string>;
  resource_read: (args: { id: string }) => Promise<string>;
}

export function createResourceTools(
  agentName: string,
  provider: ContextProvider,
): ResourceTools {
  return {
    async resource_create(args) {
      const resource = await provider.resources.create(args.content, agentName);
      return `Created resource ${resource.id}`;
    },

    async resource_read(args) {
      const resource = await provider.resources.read(args.id);
      if (!resource) return `Resource "${args.id}" not found.`;
      return resource.content;
    },
  };
}
