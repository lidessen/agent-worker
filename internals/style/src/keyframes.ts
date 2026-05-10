/**
 * Keyframes support for @semajsx/style
 *
 * Provides a tagged template for defining CSS @keyframes animations
 * that integrate with the rule() system.
 *
 * @example
 * ```ts
 * import { keyframes } from "@semajsx/style";
 * import { classes, rule } from "@semajsx/style";
 *
 * const fadeIn = keyframes`
 *   from { opacity: 0; }
 *   to { opacity: 1; }
 * `;
 *
 * const c = classes(["root"]);
 * const animated = rule`${c.root} {
 *   animation: ${fadeIn} 0.3s ease-in;
 * }`;
 * ```
 */

import { hashString } from "./hash";
import type { StyleToken } from "./types";

/**
 * Symbol to identify KeyframeRef objects
 */
const KEYFRAME_REF_BRAND = Symbol.for("@semajsx/style/keyframeRef");

/**
 * Symbol to identify StyleToken objects
 */
const STYLE_TOKEN_BRAND = Symbol.for("@semajsx/style/token");

/**
 * A reference to a @keyframes animation that can be used in rule() templates
 *
 * Stringifies to the animation name for use in CSS properties.
 * Also carries the @keyframes CSS for injection.
 */
export interface KeyframeRef {
  /** The generated animation name */
  readonly name: string;
  /** The full @keyframes CSS */
  readonly css: string;
  /** Returns the animation name */
  toString(): string;
}

/**
 * Check if a value is a KeyframeRef
 */
export function isKeyframeRef(value: unknown): value is KeyframeRef {
  return (
    value != null &&
    typeof value === "object" &&
    KEYFRAME_REF_BRAND in value &&
    (value as Record<symbol, unknown>)[KEYFRAME_REF_BRAND] === true
  );
}

/**
 * Define CSS @keyframes animation
 *
 * Returns a KeyframeRef that can be interpolated in rule() templates.
 * The keyframes CSS is automatically injected when used.
 *
 * @example
 * ```ts
 * const spin = keyframes`
 *   from { transform: rotate(0deg); }
 *   to { transform: rotate(360deg); }
 * `;
 *
 * const spinner = rule`${c.spinner} {
 *   animation: ${spin} 1s linear infinite;
 * }`;
 * ```
 */
export function keyframes(
  strings: TemplateStringsArray,
  ...values: (string | number)[]
): KeyframeRef {
  // Build the keyframes body
  let body = strings[0] ?? "";
  for (let i = 0; i < values.length; i++) {
    body += String(values[i]) + (strings[i + 1] ?? "");
  }

  body = body.trim();

  // Generate a deterministic name from the content
  const hash = hashString(body);
  const name = `kf-${hash}`;

  const css = `@keyframes ${name} {\n  ${body}\n}`;

  const ref: KeyframeRef = {
    name,
    css,
    toString() {
      return name;
    },
  };

  Object.defineProperty(ref, KEYFRAME_REF_BRAND, { value: true });

  return ref;
}

/**
 * Create a StyleToken that injects keyframes CSS
 *
 * Use this when you need to inject keyframes without using them in a rule().
 * Normally, keyframes are auto-injected when used in rule() templates.
 *
 * @example
 * ```ts
 * const fadeIn = keyframes`
 *   from { opacity: 0; }
 *   to { opacity: 1; }
 * `;
 *
 * // Inject keyframes CSS
 * inject(keyframesToken(fadeIn));
 * ```
 */
export function keyframesToken(ref: KeyframeRef): StyleToken {
  const token: StyleToken = {
    __kind: "style",
    _: undefined,
    __cssTemplate: ref.css,
    __bindingDefs: undefined,
    toString() {
      return "";
    },
  };
  Object.defineProperty(token, STYLE_TOKEN_BRAND, { value: true });
  return token;
}
