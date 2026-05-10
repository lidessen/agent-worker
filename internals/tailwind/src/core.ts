/**
 * Core utility creation functions for @semajsx/tailwind
 */

import type { StyleToken, TailwindConfig, UtilityFn, TaggedUtilityFn } from "./types";
import { getConfig } from "./config";

/**
 * djb2 hash algorithm - deterministic, fast, and suitable for class names
 *
 * @param str - The string to hash
 * @returns A short hash string (5 characters, base36)
 */
export function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36).slice(-5);
}

/**
 * Convert a CSS value to a valid class name suffix.
 * - Simple values (alphanumeric, dots, hyphens) are used directly
 * - Complex values (calc, rgb, etc.) are hashed
 *
 * @param value - The CSS value
 * @returns A sanitized suffix for class names
 *
 * @example
 * ```ts
 * valueToSuffix("4px")           // "4px"
 * valueToSuffix("0.5rem")        // "0_5rem"
 * valueToSuffix("calc(100%-4px)") // "a1b2c" (hashed)
 * ```
 */
export function valueToSuffix(value: string): string {
  // Fast path: simple values don't need hash
  if (/^[\w.-]+$/.test(value)) {
    return value.replace(/\./g, "_");
  }
  // Slow path: complex values need deterministic hash
  return hashString(value);
}

/**
 * Escape special characters in class names for CSS selectors.
 * In CSS, dots and other special characters need to be escaped.
 */
function escapeClassName(className: string): string {
  return className.replace(/\./g, "\\.");
}

/**
 * Create a utility function for a single CSS property.
 *
 * @param property - The CSS property (e.g., "padding", "background-color")
 * @param utilityName - The utility prefix (e.g., "p", "bg")
 * @param config - Optional configuration (defaults to global config)
 * @returns A function that creates StyleTokens
 *
 * @example
 * ```ts
 * const padding = createUtility("padding", "p");
 * padding("1rem", "4"); // { _: "p-4", __cssTemplate: ".p-4 { padding: 1rem; }" }
 * ```
 */
export function createUtility(
  property: string,
  utilityName: string,
  config?: TailwindConfig,
): UtilityFn {
  return (value: string, valueName?: string): StyleToken => {
    const cfg = config ?? getConfig();
    const prefix = cfg.prefix ?? "";
    const suffix = valueName ?? valueToSuffix(value);
    const className = `${prefix}${utilityName}-${suffix}`;
    const escapedClassName = escapeClassName(className);

    return {
      __kind: "style",
      _: className,
      __cssTemplate: `.${escapedClassName} { ${property}: ${value}; }`,
      toString() {
        return this._;
      },
    };
  };
}

/**
 * Create a tagged template function for arbitrary values.
 *
 * @param utilityFn - The utility function to wrap
 * @returns A tagged template function
 *
 * @example
 * ```ts
 * const p = createTaggedUtility(createUtility("padding", "p"));
 * p`10px`; // { _: "p-10px", __cssTemplate: ".p-10px { padding: 10px; }" }
 * p`calc(100% - 40px)`; // { _: "p-a1b2c", __cssTemplate: ".p-a1b2c { padding: calc(100% - 40px); }" }
 * ```
 */
export function createTaggedUtility(utilityFn: UtilityFn): TaggedUtilityFn {
  return (strings: TemplateStringsArray, ...values: unknown[]): StyleToken => {
    // Combine template strings with interpolated values
    let result = strings[0] ?? "";
    for (let i = 0; i < values.length; i++) {
      result += String(values[i]) + (strings[i + 1] ?? "");
    }
    return utilityFn(result);
  };
}

/**
 * Create a utility for multi-value CSS properties.
 *
 * @param properties - Array of CSS properties
 * @param utilityName - The utility prefix
 * @param config - Optional configuration
 * @returns A function that creates StyleTokens
 *
 * @example
 * ```ts
 * const mx = createMultiUtility(["margin-left", "margin-right"], "mx");
 * mx("1rem", "4"); // { _: "mx-4", __cssTemplate: ".mx-4 { margin-left: 1rem; margin-right: 1rem; }" }
 * ```
 */
export function createMultiUtility(
  properties: string[],
  utilityName: string,
  config?: TailwindConfig,
): UtilityFn {
  return (value: string, valueName?: string): StyleToken => {
    const cfg = config ?? getConfig();
    const prefix = cfg.prefix ?? "";
    const suffix = valueName ?? valueToSuffix(value);
    const className = `${prefix}${utilityName}-${suffix}`;
    const escapedClassName = escapeClassName(className);

    const cssProperties = properties.map((p) => `${p}: ${value};`).join(" ");

    return {
      __kind: "style",
      _: className,
      __cssTemplate: `.${escapedClassName} { ${cssProperties} }`,
      toString() {
        return this._;
      },
    };
  };
}
