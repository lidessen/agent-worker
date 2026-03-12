/**
 * Unified target syntax parser.
 *
 * Format: [agent] [@workspace[:tag]] [#channel]
 *
 * Examples:
 *   "alice"                → { agent: "alice" }
 *   "alice@review"         → { agent: "alice", workspace: "review" }
 *   "alice@review:pr-42"   → { agent: "alice", workspace: "review:pr-42" }
 *   "@review"              → { workspace: "review" }
 *   "@review:pr-42"        → { workspace: "review:pr-42" }
 *   "@review#design"       → { workspace: "review", channel: "design" }
 *   "@review:pr-42#design" → { workspace: "review:pr-42", channel: "design" }
 *   "alice@review#design"  → { agent: "alice", workspace: "review", channel: "design" }
 */

export interface Target {
  agent?: string;
  workspace?: string; // "review" or "review:pr-42"
  channel?: string;
}

/**
 * Parse a target string into its components.
 *
 * Grammar: `^([^@#]+)?(?:@([^#]+))?(?:#(.+))?$`
 * - Everything before `@` is the agent name
 * - Between `@` and `#` is the workspace (may contain `:` for tags)
 * - After `#` is the channel name
 */
export function parseTarget(raw: string): Target {
  if (!raw) {
    throw new Error("Target string is empty");
  }

  const match = raw.match(/^([^@#]+)?(?:@([^#]+))?(?:#(.+))?$/);
  if (!match) {
    throw new Error(`Invalid target: "${raw}"`);
  }

  const agent = match[1] || undefined;
  const workspace = match[2] || undefined;
  const channel = match[3] || undefined;

  if (!agent && !workspace && !channel) {
    throw new Error(`Target "${raw}" must specify at least an agent, workspace, or channel`);
  }

  return { agent, workspace, channel };
}

/**
 * Format a Target back into its string representation.
 */
export function formatTarget(target: Target): string {
  let result = target.agent ?? "";
  if (target.workspace) result += `@${target.workspace}`;
  if (target.channel) result += `#${target.channel}`;
  return result;
}
