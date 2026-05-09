import type { ToolSet } from "ai";
import type { AgentLoop, LoopInput } from "./types.ts";
import type { LoopEvent, TokenUsage } from "@agent-worker/loop";

export interface RuntimeBinding {
  id: string;
  runtimeType: string;
  model?: string;
  loop: AgentLoop;
  sessionRefs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ContextPacket {
  system?: string;
  prompt: string;
  sections?: Array<{
    id: string;
    title?: string;
    content: string;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ToolCapabilitySet {
  directTools?: ToolSet;
  mcpServers?: Record<string, unknown>;
  mcpConfigPath?: string;
  activeToolNames?: string[];
  metadata?: Record<string, unknown>;
}

export interface RunPolicy {
  cwd?: string;
  allowedPaths?: string[];
  env?: Record<string, string>;
  permissionMode?: string;
  sandbox?: string;
  approval?: string;
  model?: string;
  runtimeOptions?: Record<string, unknown>;
}

export interface RuntimeTrace {
  bindingId: string;
  events: LoopEvent[];
  startedAt: number;
  completedAt: number;
  auditRefs?: string[];
}

/**
 * Runtime-emitted draft of the Handoff generic core. The harness picks up
 * this draft, calls its own `produceExtension` hook (see decision 005) to
 * attach a per-harness extension, and commits the workspace `Handoff`
 * record. The runtime itself does not commit anything.
 */
export interface HandoffDraft {
  kind?: "progress" | "blocked" | "completed" | "aborted";
  summary: string;
  completed?: string[];
  pending?: string[];
  decisions?: string[];
  blockers?: string[];
  /** Refs to durable outputs produced during this Wake (Resource ids). */
  resources?: string[];
  metadata?: Record<string, unknown>;
}

export interface ArtifactCandidate {
  kind: "file" | "commit" | "url" | "patch" | "text" | "other";
  ref?: string;
  content?: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  status: "completed" | "failed" | "cancelled";
  usage?: TokenUsage;
  durationMs: number;
  error?: string;
  backendSessionRefs?: Record<string, unknown>;
}

export interface AgentRuntimeRunInput {
  binding: RuntimeBinding;
  packet: ContextPacket;
  capabilities?: ToolCapabilitySet;
  policy?: RunPolicy;
}

export interface AgentRuntimeRunResult {
  trace: RuntimeTrace;
  result: ExecutionResult;
  handoffDraft?: HandoffDraft;
  artifactCandidates: ArtifactCandidate[];
}

export class AgentRuntime {
  async run(input: AgentRuntimeRunInput): Promise<AgentRuntimeRunResult> {
    const { binding, packet, capabilities } = input;
    const startedAt = Date.now();
    const events: LoopEvent[] = [];

    this.applyCapabilities(binding.loop, capabilities);

    try {
      const run = binding.loop.run(renderPacket(packet));
      for await (const event of run) {
        events.push(event);
      }

      const loopResult = await run.result;
      const completedAt = Date.now();
      const text = events
        .filter((event): event is Extract<LoopEvent, { type: "text" }> => event.type === "text")
        .map((event) => event.text)
        .join("\n")
        .trim();

      return {
        trace: {
          bindingId: binding.id,
          events,
          startedAt,
          completedAt,
        },
        result: {
          status: binding.loop.status === "cancelled" ? "cancelled" : "completed",
          usage: loopResult.usage,
          durationMs: loopResult.durationMs,
          backendSessionRefs: binding.sessionRefs,
        },
        handoffDraft: text ? { summary: text } : undefined,
        artifactCandidates: [],
      };
    } catch (error) {
      const completedAt = Date.now();
      return {
        trace: {
          bindingId: binding.id,
          events,
          startedAt,
          completedAt,
        },
        result: {
          status: binding.loop.status === "cancelled" ? "cancelled" : "failed",
          durationMs: completedAt - startedAt,
          error: error instanceof Error ? error.message : String(error),
          backendSessionRefs: binding.sessionRefs,
        },
        artifactCandidates: [],
      };
    }
  }

  private applyCapabilities(loop: AgentLoop, capabilities?: ToolCapabilitySet): void {
    if (!capabilities) return;

    if (capabilities.directTools) {
      if (!loop.setTools) {
        throw new Error("Runtime binding does not support direct tool capabilities");
      }
      loop.setTools(capabilities.directTools);
    }

    if (capabilities.mcpServers && Object.keys(capabilities.mcpServers).length > 0) {
      if (!loop.setMcpServers) {
        throw new Error("Runtime binding does not support structured MCP server capabilities");
      }
      loop.setMcpServers(capabilities.mcpServers);
    }

    if (capabilities.mcpConfigPath) {
      if (!loop.setMcpConfig) {
        throw new Error("Runtime binding does not support MCP config file capabilities");
      }
      loop.setMcpConfig(capabilities.mcpConfigPath);
    }
  }
}

export function renderPacket(packet: ContextPacket): LoopInput {
  const sectionText = packet.sections
    ?.map((section) => {
      const title = section.title ?? section.id;
      return `## ${title}\n${section.content}`;
    })
    .join("\n\n");

  const prompt = [sectionText, packet.prompt].filter(Boolean).join("\n\n");

  return {
    system: packet.system ?? "",
    prompt,
  };
}
