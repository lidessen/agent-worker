/**
 * Tool tier classification for AI SDK prepareStep.
 *
 * Tools are categorized into three tiers:
 *
 *   always      — injected every step
 *   contextual  — injected based on step context (recently used, errored, etc.)
 *   on-demand   — hidden by default, surfaced via a discovery tool
 */

import type { ToolSet, Tool } from "ai";

// ── Types ────────────────────────────────────────────────────────────────────

export type ToolTier = "always" | "contextual" | "on-demand";

export interface ToolRelevanceConfig {
  /**
   * Categorize tools by name. Tools not listed default to "contextual".
   *
   * ```ts
   * { tiers: { bash: "always", webSearch: "contextual", rareTool: "on-demand" } }
   * ```
   */
  tiers?: Record<string, ToolTier>;
}

/** Minimal step info — mirrors what AI SDK prepareStep receives. */
export interface StepContext {
  stepNumber: number;
  steps: ReadonlyArray<{
    text?: string;
    toolCalls?: ReadonlyArray<{ toolName: string }>;
    toolResults?: ReadonlyArray<{
      toolName: string;
      result?: unknown;
    }>;
    finishReason?: string;
  }>;
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class ToolRelevanceEngine {
  private tiers: Record<string, ToolTier>;

  /** On-demand tools activated by the model. Resets per run. */
  private _activatedOnDemand = new Set<string>();

  constructor(config: ToolRelevanceConfig = {}) {
    this.tiers = config.tiers ?? {};
  }

  /** Get the tier of a tool. Defaults to "contextual" if not configured. */
  getTier(toolName: string): ToolTier {
    return this.tiers[toolName] ?? "contextual";
  }

  /** Classify all registered tools by tier. */
  classify(tools: ToolSet): { always: string[]; contextual: string[]; onDemand: string[] } {
    const always: string[] = [];
    const contextual: string[] = [];
    const onDemand: string[] = [];

    for (const name of Object.keys(tools)) {
      switch (this.getTier(name)) {
        case "always":
          always.push(name);
          break;
        case "on-demand":
          onDemand.push(name);
          break;
        default:
          contextual.push(name);
      }
    }

    return { always, contextual, onDemand };
  }

  /** Mark an on-demand tool as activated. */
  activateOnDemand(toolName: string): void {
    this._activatedOnDemand.add(toolName);
  }

  /** Reset on-demand activations (call at the start of each run). */
  resetActivations(): void {
    this._activatedOnDemand.clear();
  }

  /**
   * Select tools for the next step based on tier + step context.
   *
   * - always:      included every step
   * - contextual:  included if used or errored in recent steps, otherwise included at step 0
   * - on-demand:   included only when explicitly activated
   *
   * Returns undefined when no filtering would occur (all tools active).
   */
  selectActiveTools(tools: ToolSet, ctx: StepContext): string[] | undefined {
    const allNames = Object.keys(tools);
    const { always, contextual, onDemand } = this.classify(tools);

    // No on-demand tools and no tier config → no filtering needed
    if (onDemand.length === 0 && always.length === 0) return undefined;

    // Step 0: always + all contextual, no on-demand yet
    if (ctx.stepNumber === 0 || ctx.steps.length === 0) {
      if (onDemand.length === 0) return undefined;
      return [...always, ...contextual];
    }

    // Contextual: include tools that were used or errored recently
    const recentlyUsed = new Set<string>();
    const recentSteps = ctx.steps.slice(-3);
    for (const step of recentSteps) {
      for (const tc of step.toolCalls ?? []) {
        recentlyUsed.add(tc.toolName);
      }
    }

    const lastStep = ctx.steps[ctx.steps.length - 1];
    const erroredTools = new Set<string>();
    if (lastStep) {
      for (const tr of lastStep.toolResults ?? []) {
        const result = String(tr.result ?? "");
        if (
          result.startsWith("Error:") ||
          result.includes("error") ||
          result.includes("failed") ||
          result.includes("not found")
        ) {
          erroredTools.add(tr.toolName);
        }
      }
    }

    const activeContextual = contextual.filter(
      (name) => recentlyUsed.has(name) || erroredTools.has(name),
    );

    // If no contextual tools were recently active, include all contextual
    // (don't starve the model of tools it hasn't tried yet)
    const selectedContextual = activeContextual.length > 0 ? activeContextual : contextual;

    // On-demand: only include activated ones
    const activeOnDemand = onDemand.filter((name) => this._activatedOnDemand.has(name));

    const result = [...always, ...selectedContextual, ...activeOnDemand];

    // If we'd return all tools anyway, skip filtering
    if (result.length >= allNames.length) return undefined;

    return result;
  }

  /**
   * Build the catalog of on-demand tools for discovery.
   */
  getOnDemandCatalog(tools: ToolSet): Array<{ name: string; description: string }> {
    const { onDemand } = this.classify(tools);
    return onDemand.map((name) => ({
      name,
      description: getToolDescription(tools[name]!),
    }));
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToolDescription(t: Tool): string {
  if (t && typeof t === "object" && "description" in t) {
    return String((t as { description?: string }).description ?? "");
  }
  return "";
}
