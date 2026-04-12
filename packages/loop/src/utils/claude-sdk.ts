export {
  createSdkMcpServer,
  type SdkMcpToolDefinition,
  type HookEvent as ClaudeHookEvent,
  type HookCallback as ClaudeHookCallback,
  type HookCallbackMatcher as ClaudeHookCallbackMatcher,
} from "@anthropic-ai/claude-agent-sdk";

export type ClaudeHooks = Partial<
  Record<
    import("@anthropic-ai/claude-agent-sdk").HookEvent,
    import("@anthropic-ai/claude-agent-sdk").HookCallbackMatcher[]
  >
>;
