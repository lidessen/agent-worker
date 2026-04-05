import { createSdkMcpServer, type SdkMcpToolDefinition } from "@agent-worker/loop";
import type { ToolSet } from "ai";
import type { ToolHandlerDeps } from "../tool-registry.ts";
import { createMcpToolDefinitions } from "./tool-adapter.ts";

export interface ClaudeSdkMcpBridge {
  servers: Record<string, unknown>;
  close(): Promise<void>;
}

export function createClaudeSdkMcpBridge(args: {
  deps: ToolHandlerDeps;
  includeBuiltins: boolean;
  userTools?: ToolSet;
}): ClaudeSdkMcpBridge {
  const tools: SdkMcpToolDefinition[] = createMcpToolDefinitions(args).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    handler: tool.handler,
  }));

  const server = createSdkMcpServer({
    name: "agent-worker",
    version: "0.0.1",
    tools,
  });

  return {
    servers: {
      "agent-worker": server,
    },
    async close() {
      await server.instance.close();
    },
  };
}
