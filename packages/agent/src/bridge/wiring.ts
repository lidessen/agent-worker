import type { AgentLoop, ToolKitConfig } from "../types.ts";
import type { ToolSet } from "ai";
import type { RunCoordinator } from "../run-coordinator.ts";
import type { ToolHandlerDeps } from "../tool-registry.ts";
import { createBuiltinTools, mergeTools, validateToolNamespace } from "../toolkit.ts";
import { ToolBridge } from "./tool-bridge.ts";
import { AgentMcpServer } from "./mcp-server.ts";

export interface LoopWiringDeps extends ToolHandlerDeps {
  loop: AgentLoop;
  coordinator: RunCoordinator;
  toolkit?: ToolKitConfig;
}

/**
 * Handles all loop capability detection and tool wiring.
 *
 * Separates three concerns that were previously mixed in Agent.init():
 *
 * 1. Direct tool injection (AI SDK loops with directTools capability)
 * 2. prepareStep hook (AI SDK loops with prepareStep capability)
 * 3. CLI bridge setup (CLI loops — bridge is always started, includeBuiltins
 *    only controls which tools the entry script exposes)
 *
 * The bridge is a transport mechanism — it always starts for CLI loops.
 * includeBuiltins is a policy decision — it controls tool visibility,
 * not whether the transport exists.
 */
export class LoopWiring {
  private bridge: ToolBridge | null = null;
  private mcpServer: AgentMcpServer | null = null;

  constructor(private deps: LoopWiringDeps) {}

  /** Extract the ToolHandlerDeps subset (shared by bridge, MCP, toolkit). */
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

    // ── CLI bridge ────────────────────────────────────────────────────
    // Transport is independent of tool selection: bridge always starts
    // for CLI loops. includeBuiltins controls which tools the MCP entry
    // script registers, not whether the bridge exists.
    if (!loop.supports.includes("directTools") && loop.setMcpConfig) {
      this.bridge = new ToolBridge(this.handlerDeps);
      const transport = await this.bridge.start();

      this.mcpServer = new AgentMcpServer(this.handlerDeps);
      const configPath = await this.mcpServer.startAndWriteConfig(
        transport,
        this.deps.memory !== null,
        includeBuiltins,
      );
      loop.setMcpConfig(configPath);
    }
  }

  async stop(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.stop();
      this.mcpServer = null;
    }
    if (this.bridge) {
      await this.bridge.stop();
      this.bridge = null;
    }
  }

  private buildToolSet(includeBuiltins: boolean, userTools?: ToolSet): ToolSet {
    if (includeBuiltins) {
      return mergeTools(createBuiltinTools(this.handlerDeps), userTools);
    }
    return userTools ?? {};
  }
}
