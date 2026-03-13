import type { AgentLoop, ToolKitConfig } from "../types.ts";
import type { ToolSet } from "ai";
import type { RunCoordinator } from "../run-coordinator.ts";
import type { ToolHandlerDeps } from "../tool-registry.ts";
import { createBuiltinTools, mergeTools, validateToolNamespace } from "../toolkit.ts";
import { AgentMcpServer } from "./mcp-server.ts";

export interface LoopWiringDeps extends ToolHandlerDeps {
  loop: AgentLoop;
  coordinator: RunCoordinator;
  toolkit?: ToolKitConfig;
}

/**
 * Handles all loop capability detection and tool wiring.
 *
 * Two paths:
 *
 * 1. Direct tool injection (AI SDK loops with directTools/prepareStep)
 * 2. HTTP MCP server (CLI loops — tools exposed via Streamable HTTP)
 */
export class LoopWiring {
  private mcpServer: AgentMcpServer | null = null;

  constructor(private deps: LoopWiringDeps) {}

  /** Extract the ToolHandlerDeps subset (shared by MCP, toolkit). */
  private get handlerDeps(): ToolHandlerDeps {
    return {
      inbox: this.deps.inbox,
      todos: this.deps.todos,
      notes: this.deps.notes,
      memory: this.deps.memory,
      sendGuard: this.deps.sendGuard,
      reminders: this.deps.reminders,
    };
  }

  async init(): Promise<void> {
    const { loop, coordinator, toolkit } = this.deps;
    const includeBuiltins = toolkit?.includeBuiltins !== false;
    const userTools = toolkit?.tools;

    // Validate user tool namespace against builtins
    if (userTools && includeBuiltins) {
      validateToolNamespace(userTools, createBuiltinTools(this.handlerDeps));
    }

    // ── Direct tool injection ─────────────────────────────────────────
    if (loop.supports.includes("directTools") && loop.setTools) {
      const tools = this.buildToolSet(includeBuiltins, userTools);
      if (Object.keys(tools).length > 0) {
        loop.setTools(tools);
      }
    }

    // ── prepareStep hook ──────────────────────────────────────────────
    if (loop.supports.includes("prepareStep") && loop.setPrepareStep) {
      loop.setPrepareStep((opts) => coordinator.assembleForStep(opts));
    }

    // ── CLI loops: HTTP MCP server ────────────────────────────────────
    if (!loop.supports.includes("directTools") && loop.setMcpConfig) {
      this.mcpServer = new AgentMcpServer(this.handlerDeps);
      const configPath = await this.mcpServer.startHttp();
      loop.setMcpConfig(configPath);
    }
  }

  async stop(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.stop();
      this.mcpServer = null;
    }
  }

  private buildToolSet(includeBuiltins: boolean, userTools?: ToolSet): ToolSet {
    if (includeBuiltins) {
      return mergeTools(createBuiltinTools(this.handlerDeps), userTools);
    }
    return userTools ?? {};
  }
}
