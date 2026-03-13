/**
 * Context-based tool relevance engine for AI SDK prepareStep.
 *
 * Scores every registered tool against real step context (tool calls,
 * results, model text, errors) and returns the top-K most relevant.
 * No hardcoded tool-name rules — all scoring is based on generic signals
 * derived from runtime context.
 */

import type { ToolSet, Tool } from "ai";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToolRelevanceConfig {
  /** Always-active tools that bypass scoring. */
  coreTools?: string[];
  /** Max tools to activate per step (including core). 0 = unlimited. Default: 0 */
  maxActiveTools?: number;
  /** Minimum relevance score to be included (0-1). Default: 0 */
  minScore?: number;
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

interface ScoredTool {
  name: string;
  score: number;
}

// ── Scoring signals ──────────────────────────────────────────────────────────

/**
 * Extract context signals from step history.
 * These are the raw materials all scoring functions work with.
 */
function extractSignals(ctx: StepContext) {
  const recentSteps = ctx.steps.slice(-3); // last 3 steps

  // Tools used recently, with recency weighting
  const recentToolUse = new Map<string, number>();
  for (let i = 0; i < recentSteps.length; i++) {
    const step = recentSteps[i]!;
    const recencyWeight = (i + 1) / recentSteps.length; // newer = higher
    for (const tc of step.toolCalls ?? []) {
      const prev = recentToolUse.get(tc.toolName) ?? 0;
      recentToolUse.set(tc.toolName, Math.max(prev, recencyWeight));
    }
  }

  // Tools that produced errors in last step
  const errorTools = new Set<string>();
  const lastStep = ctx.steps[ctx.steps.length - 1];
  if (lastStep) {
    for (const tr of lastStep.toolResults ?? []) {
      const result = String(tr.result ?? "");
      if (
        result.startsWith("Error:") ||
        result.includes("error") ||
        result.includes("failed") ||
        result.includes("not found")
      ) {
        errorTools.add(tr.toolName);
      }
    }
  }

  // Text from last step (model's reasoning/plan)
  const lastText = lastStep?.text ?? "";

  // Co-occurrence: tools used together in the same step
  const coOccurrence = new Map<string, Set<string>>();
  for (const step of ctx.steps) {
    const names = (step.toolCalls ?? []).map((tc) => tc.toolName);
    for (const name of names) {
      if (!coOccurrence.has(name)) coOccurrence.set(name, new Set());
      for (const other of names) {
        if (other !== name) coOccurrence.get(name)!.add(other);
      }
    }
  }

  return { recentToolUse, errorTools, lastText, coOccurrence, lastStep };
}

// ── Individual scoring functions ─────────────────────────────────────────────

/** Recently-used tools are likely needed again (momentum). */
function scoreRecency(toolName: string, signals: ReturnType<typeof extractSignals>): number {
  return signals.recentToolUse.get(toolName) ?? 0;
}

/** Tools that errored need to be available for retry/recovery. */
function scoreErrorRecovery(toolName: string, signals: ReturnType<typeof extractSignals>): number {
  return signals.errorTools.has(toolName) ? 1.0 : 0;
}

/** Tools whose descriptions match keywords in the model's recent text. */
function scoreDescriptionMatch(
  toolName: string,
  description: string,
  signals: ReturnType<typeof extractSignals>,
): number {
  if (!signals.lastText || !description) return 0;

  // Extract meaningful keywords from the tool description (3+ chars, no stop words)
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "are",
    "was",
    "has",
    "have",
    "will",
    "can",
    "use",
    "used",
    "using",
  ]);

  const descWords = description
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const textLower = signals.lastText.toLowerCase();

  let matches = 0;
  for (const word of descWords) {
    if (textLower.includes(word)) matches++;
  }

  // Also check if the tool name itself appears in the text
  const nameWords = toolName
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  for (const word of nameWords) {
    if (textLower.includes(word)) matches++;
  }

  const totalKeywords = descWords.length + nameWords.length;
  return totalKeywords > 0 ? Math.min(matches / Math.max(totalKeywords * 0.3, 1), 1) : 0;
}

/** Tools co-occurring with recently-used tools. */
function scoreCoOccurrence(toolName: string, signals: ReturnType<typeof extractSignals>): number {
  let maxScore = 0;
  for (const [usedTool, weight] of signals.recentToolUse) {
    const peers = signals.coOccurrence.get(usedTool);
    if (peers?.has(toolName)) {
      maxScore = Math.max(maxScore, weight * 0.7);
    }
  }
  return maxScore;
}

// ── Engine ───────────────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS = {
  recency: 0.35,
  errorRecovery: 0.25,
  descriptionMatch: 0.25,
  coOccurrence: 0.15,
} as const;

export class ToolRelevanceEngine {
  private config: Required<ToolRelevanceConfig>;

  constructor(config: ToolRelevanceConfig = {}) {
    this.config = {
      coreTools: config.coreTools ?? [],
      maxActiveTools: config.maxActiveTools ?? 0,
      minScore: config.minScore ?? 0,
    };
  }

  /**
   * Select tools for the next step based on context.
   *
   * Returns undefined (= all tools active) when:
   * - Step 0 (no history yet)
   * - maxActiveTools is 0 and minScore is 0 (no filtering configured)
   * - All tools score above threshold anyway
   */
  selectActiveTools(tools: ToolSet, ctx: StepContext): string[] | undefined {
    const allNames = Object.keys(tools);

    // Step 0: no context to score against, use everything
    if (ctx.stepNumber === 0 || ctx.steps.length === 0) return undefined;

    const { coreTools, maxActiveTools, minScore } = this.config;

    // No filtering configured
    if (maxActiveTools === 0 && minScore === 0 && coreTools.length === 0) return undefined;

    const signals = extractSignals(ctx);
    const coreSet = new Set(coreTools);

    // Score non-core tools
    const scored: ScoredTool[] = [];
    for (const name of allNames) {
      if (coreSet.has(name)) continue;

      const description = getToolDescription(tools[name]!);
      const score =
        SIGNAL_WEIGHTS.recency * scoreRecency(name, signals) +
        SIGNAL_WEIGHTS.errorRecovery * scoreErrorRecovery(name, signals) +
        SIGNAL_WEIGHTS.descriptionMatch * scoreDescriptionMatch(name, description, signals) +
        SIGNAL_WEIGHTS.coOccurrence * scoreCoOccurrence(name, signals);

      scored.push({ name, score });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Apply filters
    let selected = scored;
    if (minScore > 0) {
      selected = selected.filter((t) => t.score >= minScore);
    }

    const coreInTools = coreTools.filter((name) => name in tools);

    if (maxActiveTools > 0) {
      const slotsForScored = Math.max(0, maxActiveTools - coreInTools.length);
      selected = selected.slice(0, slotsForScored);
    }

    const result = [...coreInTools, ...selected.map((t) => t.name)];

    // If we'd return all tools anyway, return undefined (no filtering)
    if (result.length >= allNames.length) return undefined;

    return result;
  }

  /** Expose scoring for debugging/logging. */
  scoreTools(
    tools: ToolSet,
    ctx: StepContext,
  ): Array<{ name: string; score: number; isCore: boolean }> {
    const coreSet = new Set(this.config.coreTools);
    const signals = ctx.steps.length > 0 ? extractSignals(ctx) : null;

    return Object.keys(tools).map((name) => {
      if (coreSet.has(name)) return { name, score: 1.0, isCore: true };
      if (!signals) return { name, score: 0, isCore: false };

      const description = getToolDescription(tools[name]!);
      const score =
        SIGNAL_WEIGHTS.recency * scoreRecency(name, signals) +
        SIGNAL_WEIGHTS.errorRecovery * scoreErrorRecovery(name, signals) +
        SIGNAL_WEIGHTS.descriptionMatch * scoreDescriptionMatch(name, description, signals) +
        SIGNAL_WEIGHTS.coOccurrence * scoreCoOccurrence(name, signals);

      return { name, score, isCore: false };
    });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToolDescription(t: Tool): string {
  // AI SDK Tool has description at top level
  if (t && typeof t === "object" && "description" in t) {
    return String((t as { description?: string }).description ?? "");
  }
  return "";
}
