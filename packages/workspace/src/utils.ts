import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Generate a short unique ID (nanoid-style, 12 chars). */
export function nanoid(size = 12): string {
  const bytes = randomBytes(size);
  let id = "";
  for (let i = 0; i < size; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
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
