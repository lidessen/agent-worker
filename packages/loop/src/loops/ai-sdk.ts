import { ToolLoopAgent, tool, type ToolSet, type LanguageModel } from "ai";
import { z } from "zod";
import { createBashTool, type CreateBashToolOptions, type BashToolkit } from "bash-tool";
import type { LoopEvent, LoopResult, LoopRun, LoopStatus, PreflightResult } from "../types.ts";
import { createEventChannel } from "../types.ts";
import { extractProvider, hasProviderKey } from "../utils/models.ts";
import { ToolRelevanceEngine, type ToolRelevanceConfig } from "../tool-relevance.ts";

// No typed model union — AI SDK supports any provider:model string

export interface AiSdkLoopOptions {
  /** AI SDK LanguageModel — string like "anthropic:claude-sonnet-4-20250514" or model instance */
  model: LanguageModel;
  /** System instructions */
  instructions?: string;
  /** Additional tools to merge with built-in tools (bash, readFile, writeFile) */
  tools?: ToolSet;
  /** Options for bash-tool sandbox */
  bashToolOptions?: CreateBashToolOptions;
  /** Tool relevance config for dynamic per-step tool filtering. */
  toolRelevance?: ToolRelevanceConfig;
}

export class AiSdkLoop {
  readonly supports = ["directTools", "prepareStep"] as const;
  private _status: LoopStatus = "idle";
  private abortController: AbortController | null = null;
  private agent: ToolLoopAgent<never, ToolSet> | null = null;

  bashToolkit: BashToolkit | null = null;
  tools: ToolSet = {};
  private _prepareStep:
    | ((opts: any) => Promise<Record<string, unknown>> | Record<string, unknown>)
    | null = null;
  private relevanceEngine: ToolRelevanceEngine | null = null;

  constructor(private options: AiSdkLoopOptions) {
    if (options.toolRelevance) {
      this.relevanceEngine = new ToolRelevanceEngine(options.toolRelevance);
    }
  }

  get status(): LoopStatus {
    return this._status;
  }

  /** Initialize bash tools and create the underlying ToolLoopAgent. Called automatically by run(). */
  async init(): Promise<void> {
    const { model, instructions, tools: userTools = {}, bashToolOptions } = this.options;

    this.bashToolkit = await createBashTool(bashToolOptions);
    const builtinTools: ToolSet = this.bashToolkit.tools as unknown as ToolSet;

    // Merge: builtins < options.tools < previously set tools (via setTools)
    this.tools = { ...builtinTools, ...userTools, ...this.tools };

    // Inject discovery tool if relevance engine has on-demand tools
    this._injectDiscoveryTool();

    const toolNames = Object.keys(this.tools);
    console.error(`[AiSdkLoop] init: ${toolNames.length} tools: [${toolNames.join(", ")}]`);

    this.agent = new ToolLoopAgent({
      model,
      instructions,
      tools: this.tools,
      prepareStep: this._buildPrepareStep(),
    });
  }

  run(input: string | { system: string; prompt: string }): LoopRun {
    if (this._status === "running") throw new Error("Already running");
    this._status = "running";
    this.abortController = new AbortController();

    const { system: inputSystem, prompt } =
      typeof input === "string"
        ? { system: undefined as string | undefined, prompt: input }
        : input;

    const channel = createEventChannel<LoopEvent>();
    const allEvents: LoopEvent[] = [];

    const emit = (event: LoopEvent) => {
      allEvents.push(event);
      channel.push(event);
    };

    const result = (async (): Promise<LoopResult> => {
      if (!this.agent) await this.init();
      this.relevanceEngine?.resetActivations();

      // If structured input has a system prompt, re-create agent with it
      if (inputSystem) {
        this.agent = new ToolLoopAgent({
          model: this.options.model,
          instructions: inputSystem,
          tools: this.tools,
          prepareStep: this._buildPrepareStep(),
        });
      }

      const startTime = Date.now();

      try {
        const streamResult = await this.agent!.stream({
          prompt,
          abortSignal: this.abortController!.signal,

          experimental_onToolCallStart: (event) => {
            const tc = event.toolCall;
            emit({
              type: "tool_call_start",
              name: tc.toolName,
              callId: tc.toolCallId,
              args: ("input" in tc ? tc.input : undefined) as Record<string, unknown> | undefined,
            });
          },

          experimental_onToolCallFinish: (event) => {
            const tc = event.toolCall;
            emit({
              type: "tool_call_end",
              name: tc.toolName,
              callId: tc.toolCallId,
              result: event.success ? event.output : undefined,
              durationMs: event.durationMs,
              error: !event.success ? String(event.error) : undefined,
            });
          },

          onStepFinish: ({ reasoningText, text }) => {
            if (reasoningText) emit({ type: "thinking", text: reasoningText });
            if (text) emit({ type: "text", text });
          },
        });

        // Consume the stream to drive the agent loop
        for await (const _ of streamResult.fullStream) {
        }

        this._status = "completed";
        channel.end();

        const totalUsage = await streamResult.totalUsage;
        return {
          events: allEvents,
          usage: {
            inputTokens: totalUsage.inputTokens ?? 0,
            outputTokens: totalUsage.outputTokens ?? 0,
            totalTokens: (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0),
          },
          durationMs: Date.now() - startTime,
        };
      } catch (err) {
        this._status = this.abortController!.signal.aborted ? "cancelled" : "failed";
        channel.error(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    })();

    return {
      [Symbol.asyncIterator]() {
        return channel.iterable[Symbol.asyncIterator]();
      },
      result,
    };
  }

  cancel(): void {
    this.abortController?.abort();
    if (this._status === "running") {
      this._status = "cancelled";
    }
  }

  setTools(tools: ToolSet): void {
    const newNames = Object.keys(tools);
    console.error(`[AiSdkLoop] setTools: adding ${newNames.length} tools: [${newNames.join(", ")}]`);
    this.tools = { ...this.tools, ...tools };
    // Re-create agent on next run to pick up new tools
    this.agent = null;
  }

  setPrepareStep(
    fn: (opts: any) => Promise<Record<string, unknown>> | Record<string, unknown>,
  ): void {
    this._prepareStep = fn;
  }

  setToolRelevance(config: ToolRelevanceConfig): void {
    this.relevanceEngine = new ToolRelevanceEngine(config);
    // Re-inject discovery tool with the new engine
    this._injectDiscoveryTool();
    // Re-create agent on next run to pick up new tools
    this.agent = null;
  }

  async cleanup(): Promise<void> {
    if (this.bashToolkit?.sandbox && "stop" in this.bashToolkit.sandbox) {
      await (this.bashToolkit.sandbox as { stop(): Promise<void> }).stop();
    }
  }

  /** Check if the environment looks configured (provider API key present). Not a runtime test. */
  async preflight(): Promise<PreflightResult> {
    const modelStr =
      typeof this.options.model === "string"
        ? this.options.model
        : ((this.options.model as { modelId?: string }).modelId ?? "");

    const provider = extractProvider(modelStr);
    if (!provider) {
      return {
        ok: false,
        error: "Unknown provider — model string should be like 'anthropic:claude-sonnet-4-6'",
      };
    }

    if (!hasProviderKey(provider)) {
      return { ok: false, error: `No API key found for provider "${provider}"` };
    }

    return { ok: true };
  }

  /**
   * Inject a discovery tool that lets the model list and activate on-demand tools.
   * Only added when the relevance engine is configured and tools include on-demand entries.
   */
  private _injectDiscoveryTool(): void {
    if (!this.relevanceEngine) return;
    const catalog = this.relevanceEngine.getOnDemandCatalog(this.tools);
    if (catalog.length === 0) return;

    const engine = this.relevanceEngine;

    this.tools._activate_tool = tool({
      description:
        "Discover and activate on-demand tools that are hidden by default. " +
        "Call with action 'list' to see available tools, or 'activate' with a tool name to enable it.",
      inputSchema: z.object({
        action: z.enum(["list", "activate"]),
        toolName: z.string().optional().describe("Tool name to activate (for activate action)"),
      }),
      execute: async ({ action, toolName }) => {
        if (action === "list") {
          const current = engine.getOnDemandCatalog(this.tools);
          return JSON.stringify({ available: current });
        }
        if (!toolName) return "Error: toolName required for activate action";
        if (engine.getTier(toolName) !== "on-demand") {
          return `Error: "${toolName}" is not an on-demand tool`;
        }
        engine.activateOnDemand(toolName);
        return `Activated tool: ${toolName}`;
      },
    });
  }

  /**
   * Build the combined prepareStep function that merges:
   * 1. External prepareStep hook (from agent coordinator — system prompt, etc.)
   * 2. Tool relevance engine (activeTools filtering)
   */
  private _buildPrepareStep(): ((opts: any) => Promise<any>) | undefined {
    const externalHook = this._prepareStep;
    const engine = this.relevanceEngine;

    // Nothing to do
    if (!externalHook && !engine) return undefined;

    return async (opts: any) => {
      // Gather results from both sources
      const externalResult = externalHook ? await externalHook(opts) : {};
      const resolved = (externalResult ?? {}) as Record<string, unknown>;

      // Tool relevance: compute activeTools from real step context
      if (engine) {
        const activeTools = engine.selectActiveTools(this.tools, {
          stepNumber: opts.stepNumber,
          steps: opts.steps,
        });
        if (activeTools) {
          resolved.activeTools = activeTools;
        }
      }

      return resolved;
    };
  }
}
