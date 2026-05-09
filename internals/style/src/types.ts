/**
 * Type definitions for @semajsx/style
 */

import type { ReadableSignal } from "@semajsx/signal";

/**
 * Class name reference - a reference object that stringifies to a hashed class name
 */
export interface ClassRef {
  /** Unique identifier for this class ref */
  readonly id: symbol;
  /** Returns the hashed class name */
  toString(): string;
}

/**
 * Collection of class refs created by classes()
 */
export type ClassRefs<T extends readonly string[]> = {
  readonly [K in T[number]]: ClassRef;
};

/**
 * Signal binding definition (before variable name assignment)
 * Stores information about signals interpolated in rule templates
 */
export interface SignalBindingDef {
  /** The signal to bind */
  signal: ReadableSignal<unknown>;
  /** Position in template (for placeholder replacement) */
  index: number;
}

/**
 * Style token - immutable definition containing className and CSS
 *
 * StyleTokens are created by rule() and can be:
 * - Used in class props (stringifies to className)
 * - Passed to inject() for manual CSS injection
 */
export interface StyleToken {
  /** Discriminant for type narrowing */
  readonly __kind: "style";
  /** Class name (only for class selectors, undefined for pseudo/combinator rules) */
  readonly _?: string;
  /** CSS template with {{0}}, {{1}} placeholders for signal values */
  readonly __cssTemplate: string;
  /** Signal references + positions (undefined if no signals) */
  readonly __bindingDefs?: SignalBindingDef[];
  /** Returns className or empty string */
  toString(): string;
}

/**
 * Options for style injection
 */
export interface InjectOptions {
  /** Target element or shadow root for style injection */
  target?: Element | ShadowRoot;
}

/**
 * Options for creating a style registry
 */
export interface RegistryOptions {
  /** Default injection target */
  target?: Element | ShadowRoot;
  /** Whether to deduplicate injected styles (default: true) */
  dedupe?: boolean;
}

/**
 * Style registry for managing style injection
 */
export interface StyleRegistry {
  /** Inject styles into the target */
  inject(token: StyleToken | StyleToken[] | Record<string, StyleToken>): void;
  /** Clear all injected styles */
  clear(): void;
}
