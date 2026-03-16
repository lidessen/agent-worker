// ── Loop implementations ────────────────────────────────────────────────────
export { AiSdkLoop } from "./loops/ai-sdk.ts";
export type { AiSdkLoopOptions } from "./loops/ai-sdk.ts";

export { ClaudeCodeLoop } from "./loops/claude-code.ts";
export type { ClaudeCodeModel } from "./loops/claude-code.ts";
export { CodexLoop } from "./loops/codex.ts";
export { CursorLoop } from "./loops/cursor.ts";
export { MockLoop } from "./loops/mock.ts";
export type { MockLoopOptions } from "./loops/mock.ts";

// ── Types ───────────────────────────────────────────────────────────────────
export type {
  LoopStatus,
  LoopEvent,
  LoopResult,
  LoopRun,
  TokenUsage,
  CliLoopOptions,
  ClaudeCodeLoopOptions,
  CodexLoopOptions,
  CursorLoopOptions,
  PreflightResult,
  EventChannel,
} from "./types.ts";

export { createEventChannel } from "./types.ts";

// ── Utilities ───────────────────────────────────────────────────────────────
export {
  checkCliAvailability,
  checkClaudeCodeAuth,
  checkCodexAuth,
  type CliCheckResult,
} from "./utils/cli.ts";
export { runCliLoop, type CliLoopConfig } from "./utils/cli-loop.ts";
export { createStreamParser } from "./utils/stream-parser.ts";
export { extractProvider, hasProviderKey } from "./utils/models.ts";

// ── Tool relevance ─────────────────────────────────────────────────────────
export { ToolRelevanceEngine } from "./tool-relevance.ts";
export type { ToolRelevanceConfig, StepContext, ToolTier } from "./tool-relevance.ts";

// ── Built-in tools ─────────────────────────────────────────────────────────
export {
  createLoopTools,
  createGrepTool,
  createWebFetchTool,
  createWebSearchTool,
  createWebBrowseTool,
  closeBrowser,
} from "./tools/index.ts";
export type { LoopToolsOptions, WebSearchOptions } from "./tools/index.ts";
