/**
 * Rule creation for @semajsx/style
 *
 * The rule() function is a tagged template that creates StyleToken objects
 * from CSS selector + block syntax.
 */

import { isSignal } from "@semajsx/signal";
import type { ReadableSignal } from "@semajsx/signal";
import { isClassRef } from "./classes";
import type { ClassRef, SignalBindingDef, StyleToken } from "./types";

/**
 * Symbol used to identify StyleToken objects
 */
const STYLE_TOKEN_BRAND = Symbol.for("@semajsx/style/token");

/**
 * Extract the class name from a CSS rule if it starts with a simple class selector
 *
 * @example
 * ".root-x7f3a { padding: 8px; }" -> "root-x7f3a"
 * ".root-x7f3a:hover { ... }" -> undefined (pseudo-class)
 * ".root-x7f3a > .icon { ... }" -> undefined (combinator)
 */
function extractClassName(css: string): string | undefined {
  // Match simple class selector at the start: .className { ... }
  const match = css.match(/^\s*\.([a-zA-Z0-9_-]+)\s*\{/);
  return match ? match[1] : undefined;
}

/**
 * Create a StyleToken from a tagged template containing selector + CSS block
 *
 * @example
 * ```ts
 * const c = classes(["root", "icon"]);
 *
 * // Simple class selector
 * const root = rule`${c.root} { padding: 8px 16px; }`;
 *
 * // Pseudo-class selector
 * const rootHover = rule`${c.root}:hover { background: blue; }`;
 *
 * // Descendant combinator
 * const rootIcon = rule`${c.root} > ${c.icon} { margin-right: 8px; }`;
 *
 * // With signal interpolation
 * const height = signal(100);
 * const box = rule`${c.box} { height: ${height}px; }`;
 * ```
 */
export function rule(
  strings: TemplateStringsArray,
  ...values: (ClassRef | ReadableSignal<unknown> | string | number | { toString(): string })[]
): StyleToken {
  const bindingDefs: SignalBindingDef[] = [];

  // Build CSS template with placeholders for signals
  // strings[0] is always defined for template literals
  let cssTemplate = strings[0] ?? "";

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const nextString = strings[i + 1] ?? "";

    if (isClassRef(value)) {
      // ClassRef: interpolate the hashed class name with dot prefix
      cssTemplate += "." + value.toString() + nextString;
    } else if (isSignal(value)) {
      // Signal: use placeholder {{index}}, variable name assigned by anchor later
      // No unit extraction - signal value should include unit if needed (e.g., "100px")
      const index = bindingDefs.length;
      bindingDefs.push({ signal: value, index });
      cssTemplate += `{{${index}}}` + nextString;
    } else {
      // Static value: interpolate directly
      cssTemplate += String(value) + nextString;
    }
  }

  const className = extractClassName(cssTemplate);

  const token: StyleToken = {
    __kind: "style",
    _: className,
    __cssTemplate: cssTemplate,
    __bindingDefs: bindingDefs.length > 0 ? bindingDefs : undefined,
    toString() {
      return this._ ?? "";
    },
  };

  // Add brand for type checking
  Object.defineProperty(token, STYLE_TOKEN_BRAND, { value: true });

  return token;
}

/**
 * Combine multiple StyleTokens into a single token for grouped injection
 *
 * @example
 * ```ts
 * const buttonStates = rules(
 *   rule`${c.root}:hover { background: blue; }`,
 *   rule`${c.root}:active { transform: scale(0.98); }`,
 *   rule`${c.root}:disabled { opacity: 0.5; }`,
 * );
 * ```
 *
 * Note: The combined token has no className (_: undefined) since it may
 * contain multiple selectors. Use it for injection only, not as a className.
 */
export function rules(...tokens: StyleToken[]): StyleToken {
  const allBindingDefs: SignalBindingDef[] = [];

  // Build combined CSS with adjusted placeholder indices
  const combinedCSS = tokens
    .map((t, tokenIndex) => {
      let css = t.__cssTemplate;
      const bindings = t.__bindingDefs ?? [];

      // Adjust indices in both the CSS template and binding definitions
      for (const def of bindings) {
        const newIndex = def.index + tokenIndex * 100;
        // Replace placeholder with adjusted index
        css = css.replaceAll(`{{${def.index}}}`, `{{${newIndex}}}`);
        allBindingDefs.push({ ...def, index: newIndex });
      }

      return css;
    })
    .join("\n");

  const token: StyleToken = {
    __kind: "style",
    _: undefined, // Combined rules have no single class name
    __cssTemplate: combinedCSS,
    __bindingDefs: allBindingDefs.length > 0 ? allBindingDefs : undefined,
    toString() {
      return "";
    },
  };

  // Add brand for type checking
  Object.defineProperty(token, STYLE_TOKEN_BRAND, { value: true });

  return token;
}

/**
 * Check if a value is a StyleToken
 */
export function isStyleToken(value: unknown): value is StyleToken {
  return (
    value != null &&
    typeof value === "object" &&
    "__kind" in value &&
    (value as StyleToken).__kind === "style"
  );
}
