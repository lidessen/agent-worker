/**
 * Type definitions for @semajsx/tailwind
 */

/**
 * A style token that can be used as a class name
 */
export interface StyleToken {
  /** Internal marker for type identification */
  __kind: "style";
  /** The generated class name */
  _: string;
  /** The CSS template for this utility */
  __cssTemplate: string;
  /** Returns the class name when converted to string */
  toString(): string;
}

/**
 * Configuration options for Tailwind utilities
 */
export interface TailwindConfig {
  /**
   * Class name prefix. Default: "" (no prefix).
   * Use "s-" for SemaJSX namespace isolation.
   * @example
   * ```ts
   * configureTailwind({ prefix: "s-" });
   * // Result: s-p-4, s-bg-blue-500
   * ```
   */
  prefix?: string;
}

/**
 * A utility function that creates a StyleToken from a value
 */
export type UtilityFn = (value: string, valueName?: string) => StyleToken;

/**
 * Tagged template function for arbitrary values
 */
export type TaggedUtilityFn = (strings: TemplateStringsArray, ...values: unknown[]) => StyleToken;
