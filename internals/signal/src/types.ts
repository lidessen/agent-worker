/**
 * Signal types for @semajsx/signal
 *
 * Base interfaces (ReadableSignal, WritableSignal) are defined here
 * and re-exported by @semajsx/core. This avoids a circular dependency
 * between signal and core at the package level.
 */

/**
 * ReadableSignal - Read-only reactive value
 *
 * Minimal interface for third-party signal compatibility.
 * Any object with `value` and `subscribe()` can be used as a signal.
 */
export interface ReadableSignal<T = any> {
  /** Current value of the signal */
  readonly value: T;
  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
}

/**
 * WritableSignal - Extends ReadableSignal with set() and update()
 *
 * The base contract only requires a writable `value` property.
 * This implementation adds set() and update() as convenience methods.
 */
export interface WritableSignal<T = any> extends ReadableSignal<T> {
  /** Current value of the signal (writable) */
  value: T;
  /**
   * Set signal value (convenience method)
   * Equivalent to: signal.value = newValue
   */
  set(value: T): void;
  /**
   * Update signal value based on previous value (convenience method)
   * Equivalent to: signal.value = fn(signal.value)
   */
  update(fn: (prev: T) => T): void;
}

/**
 * Legacy type alias
 * @deprecated Use ReadableSignal instead
 */
export type Signal<T = any> = ReadableSignal<T>;

/** Value that may or may not be a signal */
export type MaybeSignal<T> = T | ReadableSignal<T>;

/** Extract the value type from a Signal */
export type SignalValue<S> = S extends ReadableSignal<infer T> ? T : never;
