/**
 * Hash utilities for generating unique class names
 *
 * Uses a simple but effective hash algorithm that produces short,
 * deterministic strings suitable for class names.
 */

/**
 * Generate a short hash from a string
 *
 * Uses djb2 algorithm for fast, deterministic hashing
 */
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  // Convert to base36 for compact representation, take last 5 chars
  return Math.abs(hash).toString(36).slice(-5);
}

/**
 * Generate a unique ID using a counter + random suffix
 *
 * Used for runtime-generated class names where determinism isn't required
 */
let counter = 0;
export function uniqueId(): string {
  return (++counter).toString(36) + Math.random().toString(36).slice(2, 5);
}
