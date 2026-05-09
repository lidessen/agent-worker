import type { ReadableSignal, MaybeSignal } from "./types";

/**
 * Check if a value is a signal
 *
 * Uses duck typing to check for the minimal signal interface:
 * - has a `value` property
 * - has a `subscribe` method
 */
export function isSignal<T = unknown>(value: unknown): value is ReadableSignal<T> {
  return (
    value != null &&
    typeof value === "object" &&
    "value" in value &&
    "subscribe" in value &&
    typeof value.subscribe === "function"
  );
}

/**
 * Unwrap a signal or return the value as-is
 *
 * Useful for accepting both static values and signals:
 * @example
 * ```ts
 * function Component(props: { count: MaybeSignal<number> }) {
 *   const value = unwrap(props.count);  // Always get the current value
 * }
 * ```
 */
export function unwrap<T>(value: MaybeSignal<T>): T {
  return isSignal(value) ? value.value : value;
}
