/**
 * Theme system for @semajsx/style
 *
 * Provides a CSS custom properties-based theme system with type-safe
 * design tokens. Themes can be switched at runtime by toggling classes.
 *
 * @example
 * ```ts
 * import { defineTokens, createTheme } from "@semajsx/style";
 *
 * const tokens = defineTokens({
 *   colors: {
 *     primary: "#3b82f6",
 *     background: "#ffffff",
 *     text: "#1f2937",
 *   },
 *   space: {
 *     sm: "0.5rem",
 *     md: "1rem",
 *   },
 * });
 *
 * // tokens.colors.primary.toString() === "var(--colors-primary)"
 *
 * const light = createTheme(tokens);
 * const dark = createTheme(tokens, {
 *   colors: { primary: "#60a5fa", background: "#1a1a2e", text: "#f0f0f0" },
 * });
 *
 * // Use tokens in rules
 * const root = rule`${c.root} {
 *   color: ${tokens.colors.text};
 *   background: ${tokens.colors.background};
 * }`;
 * ```
 */

import { hashString } from "./hash";
import { inject } from "./inject";

/**
 * A token reference that stringifies to a CSS var() expression
 */
export interface TokenRef {
  /** The CSS custom property name (e.g., "--colors-primary") */
  readonly varName: string;
  /** The default value for this token */
  readonly defaultValue: string;
  /** Returns var(--token-name) for use in CSS */
  toString(): string;
}

/**
 * Recursive type for token definitions
 * Supports nested objects of string values
 */
export type TokenDefinition = {
  [key: string]: string | TokenDefinition;
};

/**
 * Maps a TokenDefinition to TokenRef objects at leaves
 */
export type TokenRefs<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? TokenRef
    : T[K] extends TokenDefinition
      ? TokenRefs<T[K]>
      : never;
};

/**
 * Partial override values matching token structure
 */
export type TokenOverrides<T> = {
  [K in keyof T]?: T[K] extends string
    ? string
    : T[K] extends TokenDefinition
      ? TokenOverrides<T[K]>
      : never;
};

/**
 * Internal flat map of varName -> defaultValue
 */
interface FlatTokenMap {
  varName: string;
  defaultValue: string;
}

/**
 * Symbol to identify TokenRef objects
 */
const TOKEN_REF_BRAND = Symbol.for("@semajsx/style/tokenRef");

/**
 * Check if a value is a TokenRef
 */
export function isTokenRef(value: unknown): value is TokenRef {
  return (
    value != null &&
    typeof value === "object" &&
    TOKEN_REF_BRAND in value &&
    (value as Record<symbol, unknown>)[TOKEN_REF_BRAND] === true
  );
}

/**
 * Define design tokens as CSS custom properties.
 *
 * Creates a typed token object where each leaf value becomes a CSS custom property reference.
 * Token refs stringify to `var(--path-to-token)` for use in CSS rules.
 *
 * **Important**: This function only creates token *references* (e.g., `var(--colors-primary)`).
 * It does NOT inject CSS variables into the document. To actually apply the token values,
 * you must also call `createTheme(tokens)` and then `inject(theme)`:
 *
 * ```ts
 * import { defineTokens, createTheme, inject } from "@semajsx/style";
 *
 * const tokens = defineTokens({ colors: { primary: "#3b82f6" } });
 * const theme = createTheme(tokens);  // generates :root { --colors-primary: #3b82f6 }
 * inject(theme);                       // injects the CSS into the document
 * ```
 *
 * For a convenience function that does all three steps, see {@link defineAndInjectTokens}.
 *
 * @example
 * ```ts
 * const tokens = defineTokens({
 *   colors: {
 *     primary: "#3b82f6",
 *     secondary: "#6b7280",
 *   },
 *   space: {
 *     sm: "0.5rem",
 *     md: "1rem",
 *     lg: "1.5rem",
 *   },
 *   radii: {
 *     sm: "4px",
 *     md: "8px",
 *   },
 * });
 *
 * // tokens.colors.primary.toString() === "var(--colors-primary)"
 * // tokens.space.md.varName === "--space-md"
 * ```
 */
export function defineTokens<T extends TokenDefinition>(definition: T): TokenRefs<T> {
  return buildTokenRefs(definition, []) as TokenRefs<T>;
}

/**
 * Recursively build TokenRef objects from a definition
 */
function buildTokenRefs(obj: TokenDefinition, path: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = [...path, key];

    if (typeof value === "string") {
      const varName = "--" + currentPath.join("-");
      const ref: TokenRef = {
        varName,
        defaultValue: value,
        toString() {
          return `var(${varName})`;
        },
      };
      Object.defineProperty(ref, TOKEN_REF_BRAND, { value: true });
      result[key] = ref;
    } else if (typeof value === "object" && value !== null) {
      result[key] = buildTokenRefs(value as TokenDefinition, currentPath);
    }
  }

  return result;
}

/**
 * Collect all TokenRef leaf nodes from a token tree
 */
function collectTokenRefs(obj: unknown): FlatTokenMap[] {
  const refs: FlatTokenMap[] = [];

  if (isTokenRef(obj)) {
    refs.push({ varName: obj.varName, defaultValue: obj.defaultValue });
    return refs;
  }

  if (typeof obj === "object" && obj !== null) {
    for (const value of Object.values(obj)) {
      refs.push(...collectTokenRefs(value));
    }
  }

  return refs;
}

/**
 * Collect override values matching the token structure
 */
function collectOverrides(
  tokens: unknown,
  overrides: Record<string, unknown>,
): { varName: string; value: string }[] {
  const result: { varName: string; value: string }[] = [];

  for (const key of Object.keys(overrides)) {
    const overrideValue = overrides[key];
    const tokenValue = (tokens as Record<string, unknown>)[key];

    if (typeof overrideValue === "string" && isTokenRef(tokenValue)) {
      result.push({ varName: tokenValue.varName, value: overrideValue });
    } else if (
      typeof overrideValue === "object" &&
      overrideValue !== null &&
      typeof tokenValue === "object" &&
      tokenValue !== null
    ) {
      result.push(...collectOverrides(tokenValue, overrideValue as Record<string, unknown>));
    }
  }

  return result;
}

/**
 * Symbol used to identify theme StyleTokens
 */
const STYLE_TOKEN_BRAND = Symbol.for("@semajsx/style/token");

/**
 * Create a theme from token definitions
 *
 * Returns a StyleToken that sets all CSS custom properties. The default theme
 * uses `:root` selector, while overridden themes get a scoped class.
 *
 * @param tokens - Token refs from defineTokens()
 * @param overrides - Optional partial overrides for token values
 * @returns A StyleToken that can be injected or used as a class
 *
 * @example
 * ```ts
 * // Default theme (applies to :root)
 * const light = createTheme(tokens);
 * inject(light);
 *
 * // Override theme (scoped to a class)
 * const dark = createTheme(tokens, {
 *   colors: { primary: "#60a5fa", background: "#1a1a2e" },
 * });
 * inject(dark);
 *
 * // Apply dark theme to an element
 * <div class={dark}>...</div>
 * ```
 */
export function createTheme<T extends TokenDefinition>(
  tokens: TokenRefs<T>,
  overrides?: TokenOverrides<T>,
): import("./types").StyleToken {
  if (!overrides) {
    // Default theme: set all token values on :root
    const allTokens = collectTokenRefs(tokens);
    const vars = allTokens.map((t) => `  ${t.varName}: ${t.defaultValue};`).join("\n");
    const css = `:root {\n${vars}\n}`;

    const token = {
      __kind: "style" as const,
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

  // Override theme: scoped to a generated class
  const overrideList = collectOverrides(tokens, overrides as Record<string, unknown>);
  const hash = hashString(overrideList.map((o) => o.varName + o.value).join(""));
  const className = `theme-${hash}`;
  const vars = overrideList.map((o) => `  ${o.varName}: ${o.value};`).join("\n");
  const css = `.${className} {\n${vars}\n}`;

  const token = {
    __kind: "style" as const,
    _: className,
    __cssTemplate: css,
    __bindingDefs: undefined,
    toString() {
      return this._ ?? "";
    },
  };
  Object.defineProperty(token, STYLE_TOKEN_BRAND, { value: true });
  return token;
}

/**
 * Convenience: defineTokens + createTheme + inject in one step.
 * Returns the token refs (same as defineTokens), but also immediately
 * injects the CSS custom properties into :root.
 *
 * **Note**: This function has a side effect (injects a `<style>` element into `document.head`).
 * For SSR or cases where you need to control injection timing, use `defineTokens()` +
 * `createTheme()` + `inject()` separately.
 *
 * @param definition - Token definitions (same as defineTokens)
 * @returns The token refs for use in CSS rules
 *
 * @example
 * ```ts
 * import { defineAndInjectTokens } from "@semajsx/style";
 *
 * const tokens = defineAndInjectTokens({
 *   colors: {
 *     primary: "#3b82f6",
 *     background: "#ffffff",
 *   },
 *   space: {
 *     sm: "0.5rem",
 *     md: "1rem",
 *   },
 * });
 *
 * // tokens.colors.primary.toString() === "var(--colors-primary)"
 * // CSS variables are already injected into :root
 * ```
 */
export function defineAndInjectTokens<T extends TokenDefinition>(definition: T): TokenRefs<T> {
  const tokens = defineTokens(definition);
  const theme = createTheme(tokens);
  inject(theme);
  return tokens;
}
