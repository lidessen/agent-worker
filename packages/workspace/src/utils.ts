import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Generate a short unique ID (nanoid-style, 12 chars). */
export function nanoid(size = 12): string {
  const bytes = randomBytes(size);
  let id = "";
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return id;
}

/** Extract @mentions from a string. Returns unique agent names. */
export function extractMentions(content: string): string[] {
  const matches = content.match(/@(\w+)/g);
  if (!matches) return [];
  const names = matches.map((m) => m.slice(1));
  return [...new Set(names)];
}

/**
 * Extract the set of mentions that are *addressing* the message (as
 * opposed to inline references). An agent is "addressed" if its
 * `@name` appears as a leading token of the message. If the message
 * has no leading `@` tokens, fall back to all mentions (so the
 * classic "Hey @bob please review" pattern still wakes bob).
 *
 * Rationale:
 *   "@maintainer Build..." — maintainer addressed, body `@implementer`
 *     references are not addressing (maintainer's chronicle messages
 *     like "dispatched to @implementer (attempt att_xxx)" used to
 *     wake the worker redundantly because the mention parser was
 *     position-blind).
 *   "Hey @alice please review" — no leading tokens, so all mentions
 *     are treated as addressing (legacy behavior preserved).
 *   "@a @b hello" — both a and b are addressed.
 */
export function extractAddressedMentions(content: string): string[] {
  const trimmed = content.trimStart();
  const tokens = trimmed.split(/\s+/);
  const leading: string[] = [];
  for (const tok of tokens) {
    const m = /^@(\w+)/.exec(tok);
    if (!m) break;
    leading.push(m[1]!);
  }
  if (leading.length > 0) return [...new Set(leading)];
  // No leading mentions → fall back to every mention in the body.
  return extractMentions(content);
}
