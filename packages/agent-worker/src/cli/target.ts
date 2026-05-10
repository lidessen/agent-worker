/**
 * Unified target syntax parser.
 *
 * Format: [agent] [@harness[:tag]] [#channel]
 *
 * Examples:
 *   "alice"                → { agent: "alice" }
 *   "alice@review"         → { agent: "alice", harness: "review" }
 *   "alice@review:pr-42"   → { agent: "alice", harness: "review:pr-42" }
 *   "@review"              → { harness: "review" }
 *   "@review:pr-42"        → { harness: "review:pr-42" }
 *   "@review#design"       → { harness: "review", channel: "design" }
 *   "@review:pr-42#design" → { harness: "review:pr-42", channel: "design" }
 *   "alice@review#design"  → { agent: "alice", harness: "review", channel: "design" }
 */

export interface Target {
  agent?: string;
  harness?: string; // "review" or "review:pr-42"
  channel?: string;
}

/**
 * Parse a target string into its components.
 *
 * Grammar: `^([^@#]+)?(?:@([^#]+))?(?:#(.+))?$`
 * - Everything before `@` is the agent name
 * - Between `@` and `#` is the harness (may contain `:` for tags)
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
  const harness = match[2] || undefined;
  const channel = match[3] || undefined;

  if (!agent && !harness && !channel) {
    throw new Error(`Target "${raw}" must specify at least an agent, harness, or channel`);
  }

  return { agent, harness, channel };
}

/**
 * Format a Target back into its string representation.
 */
export function formatTarget(target: Target): string {
  let result = target.agent ?? "";
  if (target.harness) result += `@${target.harness}`;
  if (target.channel) result += `#${target.channel}`;
  return result;
}
