/**
 * Responsive design utilities for @semajsx/style
 *
 * Provides breakpoint definitions and media query helpers for creating
 * responsive styles that integrate with the rule() system.
 *
 * @example
 * ```ts
 * import { breakpoints, media } from "@semajsx/style";
 *
 * const bp = breakpoints;
 *
 * // Use breakpoint values in media queries
 * const responsive = rules(
 *   rule`${c.root} { padding: 8px; }`,
 *   rule`@media ${bp.md} { .${c.root} { padding: 16px; } }`,
 * );
 *
 * // Or use the media() helper
 * const responsivePadding = media(bp.md,
 *   rule`${c.root} { padding: 16px; }`,
 * );
 * ```
 */

import type { StyleToken } from "./types";

/**
 * Symbol to identify StyleToken objects
 */
const STYLE_TOKEN_BRAND = Symbol.for("@semajsx/style/token");

/**
 * A breakpoint reference with min/max media query helpers
 */
export interface BreakpointRef {
  /** The breakpoint value (e.g., "768px") */
  readonly value: string;
  /** min-width media query: "(min-width: 768px)" */
  readonly min: string;
  /** max-width media query: "(max-width: 767.98px)" */
  readonly max: string;
  /** Returns the min-width media query by default */
  toString(): string;
}

/**
 * Collection of breakpoint refs
 */
export type BreakpointRefs<T extends Record<string, string>> = {
  readonly [K in keyof T]: BreakpointRef;
};

/**
 * Parse a CSS value to subtract 0.02px for max-width queries
 * This prevents overlap between min and max breakpoints
 */
function subtractPixel(value: string): string {
  const match = value.match(/^(\d+(?:\.\d+)?)(px|em|rem)$/);
  if (!match || !match[1] || !match[2]) return value;

  const num = parseFloat(match[1]);
  const unit = match[2];

  // Subtract 0.02 to avoid overlap
  return `${(num - 0.02).toFixed(2)}${unit}`;
}

/**
 * Define custom breakpoints
 *
 * Creates a typed breakpoint object where each entry becomes a BreakpointRef
 * with min/max media query helpers.
 *
 * @example
 * ```ts
 * const bp = defineBreakpoints({
 *   sm: "640px",
 *   md: "768px",
 *   lg: "1024px",
 *   xl: "1280px",
 * });
 *
 * // bp.md.toString() === "(min-width: 768px)"
 * // bp.md.min === "(min-width: 768px)"
 * // bp.md.max === "(max-width: 767.98px)"
 * ```
 */
export function defineBreakpoints<T extends Record<string, string>>(
  definition: T,
): BreakpointRefs<T> {
  const result: Record<string, BreakpointRef> = {};

  for (const key of Object.keys(definition)) {
    const value = definition[key] as string;
    const maxValue = subtractPixel(value);

    result[key] = {
      value,
      min: `(min-width: ${value})`,
      max: `(max-width: ${maxValue})`,
      toString() {
        return this.min;
      },
    };
  }

  return result as BreakpointRefs<T>;
}

/**
 * Default breakpoints matching Tailwind CSS defaults
 */
export const breakpoints: BreakpointRefs<{
  sm: string;
  md: string;
  lg: string;
  xl: string;
  "2xl": string;
}> = defineBreakpoints({
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
});

/**
 * Wrap style tokens in a media query
 *
 * Takes a media query string and one or more StyleTokens,
 * wrapping their CSS in a @media block.
 *
 * @example
 * ```ts
 * import { breakpoints, media } from "@semajsx/style";
 *
 * const bp = breakpoints;
 *
 * // Single rule
 * const mdPadding = media(bp.md,
 *   rule`${c.root} { padding: 16px; }`,
 * );
 *
 * // Multiple rules
 * const lgLayout = media(bp.lg,
 *   rule`${c.root} { display: grid; }`,
 *   rule`${c.sidebar} { width: 300px; }`,
 * );
 *
 * // Max-width (mobile-first breakpoint)
 * const mobileOnly = media(bp.md.max,
 *   rule`${c.root} { flex-direction: column; }`,
 * );
 *
 * // Custom media query
 * const darkMode = media("(prefers-color-scheme: dark)",
 *   rule`${c.root} { background: #1a1a2e; color: #f0f0f0; }`,
 * );
 * ```
 */
export function media(query: string | BreakpointRef, ...tokens: StyleToken[]): StyleToken {
  const queryStr = typeof query === "string" ? query : query.toString();

  // Extract CSS from each token and wrap in @media block
  const innerCSS = tokens.map((t) => `  ${t.__cssTemplate}`).join("\n");
  const css = `@media ${queryStr} {\n${innerCSS}\n}`;

  const token: StyleToken = {
    __kind: "style",
    _: undefined,
    __cssTemplate: css,
    __bindingDefs: undefined,
    toString() {
      return "";
    },
  };
  Object.defineProperty(token, STYLE_TOKEN_BRAND, { value: true });
  return token;
}

/**
 * Create a container query
 *
 * @example
 * ```ts
 * const wide = container("(min-width: 600px)",
 *   rule`${c.root} { display: grid; grid-template-columns: 1fr 1fr; }`,
 * );
 * ```
 */
export function container(query: string, ...tokens: StyleToken[]): StyleToken {
  const innerCSS = tokens.map((t) => `  ${t.__cssTemplate}`).join("\n");
  const css = `@container ${query} {\n${innerCSS}\n}`;

  const token: StyleToken = {
    __kind: "style",
    _: undefined,
    __cssTemplate: css,
    __bindingDefs: undefined,
    toString() {
      return "";
    },
  };
  Object.defineProperty(token, STYLE_TOKEN_BRAND, { value: true });
  return token;
}
