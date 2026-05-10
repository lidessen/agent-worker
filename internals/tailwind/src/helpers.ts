/**
 * Helper functions for @semajsx/tailwind
 *
 * Usage:
 * ```ts
 * import { cx, p4, m4, wFull, bgBlue500 } from "@semajsx/tailwind";
 *
 * // Combine class names
 * <div class={cx(p4, m4, wFull, bgBlue500)}>
 *
 * // With conditional classes
 * <div class={cx(p4, isActive && bgBlue500, isLarge && textLg)}>
 *
 * // Nested arrays work too
 * <div class={cx([p4, m4], [wFull, bgBlue500])}>
 * ```
 */

import type { StyleToken } from "./types";

/**
 * Loose style token type accepted by cx() — compatible with both
 * @semajsx/tailwind StyleToken (_: string) and @semajsx/style StyleToken (_?: string)
 */
interface StyleTokenLike {
  __kind: "style";
  _?: string;
}

/**
 * Type for values that can be passed to cx()
 * - StyleToken / StyleTokenLike: a token from @semajsx/tailwind or @semajsx/style
 * - string: a raw class name
 * - false | null | undefined: ignored (for conditional classes)
 * - array of the above
 */
export type CxValue = StyleToken | StyleTokenLike | string | false | null | undefined | CxValue[];

/**
 * Combine multiple style tokens into a single class string.
 *
 * This is the primary way to compose utilities:
 *
 * @example
 * ```tsx
 * import { cx, p4, m4, wFull, bgBlue500 } from "@semajsx/tailwind";
 *
 * // Basic usage
 * <div class={cx(p4, m4, wFull, bgBlue500)}>
 * // Output: "p-4 m-4 w-full bg-blue-500"
 *
 * // Conditional classes
 * <div class={cx(p4, isActive && bgBlue500)}>
 *
 * // With raw strings
 * <div class={cx(p4, "custom-class", bgBlue500)}>
 *
 * // Nested arrays
 * const base = [p4, m4];
 * const colors = [bgBlue500, textWhite];
 * <div class={cx(base, colors)}>
 * ```
 */
export function cx(...values: CxValue[]): string {
  const classes: string[] = [];

  function process(value: CxValue): void {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        process(item);
      }
      return;
    }

    if (typeof value === "string") {
      classes.push(value);
      return;
    }

    // StyleToken
    if (value.__kind === "style" && value._) {
      classes.push(value._);
    }
  }

  for (const value of values) {
    process(value);
  }

  return classes.join(" ");
}

/**
 * Extract CSS templates from style tokens.
 * Useful for SSR or build-time CSS extraction.
 *
 * @example
 * ```ts
 * import { extractCss, p4, m4, wFull } from "@semajsx/tailwind";
 *
 * const css = extractCss(p4, m4, wFull);
 * // ".p-4 { padding: 1rem; }\n.m-4 { margin: 1rem; }\n.w-full { width: 100%; }"
 * ```
 */
export function extractCss(...tokens: (StyleToken | StyleToken[])[]): string {
  const cssSet = new Set<string>();

  function process(token: StyleToken | StyleToken[]): void {
    if (Array.isArray(token)) {
      for (const t of token) {
        process(t);
      }
      return;
    }

    if (token.__kind === "style" && token.__cssTemplate) {
      cssSet.add(token.__cssTemplate);
    }
  }

  for (const token of tokens) {
    process(token);
  }

  return Array.from(cssSet).join("\n");
}
