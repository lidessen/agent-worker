/**
 * Signal interfaces - Minimal pluggable reactive primitives
 *
 * These interfaces define the core Signal contract for SemaJSX.
 * Any signal implementation that satisfies these interfaces can be used
 * with the SemaJSX runtime.
 *
 * Design principles:
 * 1. Minimal interface - only 2 methods (value + subscribe)
 * 2. No peek() - redundant in explicit dependency system
 * 3. No set()/update() - these are convenience methods, not interface requirements
 * 4. Maximum compatibility - works with Preact Signals, Vue refs, and others
 */

/**
 * ReadableSignal - Read-only reactive value
 *
 * Minimal interface for third-party signal compatibility.
 * Any object with `value` and `subscribe()` can be used as a signal.
 *
 * @example
 * ```ts
 * const count: ReadableSignal<number> = { ... };
 * console.log(count.value);  // Read current value
 * const unsub = count.subscribe(v => console.log(v));  // Listen to changes
 * unsub();  // Unsubscribe
 * ```
 */
export interface ReadableSignal<T> {
  /**
   * Current value of the signal
   * Reading this property does NOT track dependencies (explicit dependency system)
   */
  readonly value: T;

  /**
   * Subscribe to changes
   * @param listener - Callback invoked when the signal changes
   * @returns Unsubscribe function
   */
  subscribe(listener: (value: T) => void): () => void;
}

/**
 * WritableSignal - Mutable reactive value
 *
 * Extends ReadableSignal with a writable value property.
 * Note: set() and update() are NOT part of the core interface.
 * Implementations may provide these as convenience methods.
 *
 * @example
 * ```ts
 * const count: WritableSignal<number> = signal(0);
 * count.value = 1;  // Set via property
 * console.log(count.value);  // Read value
 * ```
 */
export interface WritableSignal<T> extends ReadableSignal<T> {
  /**
   * Current value of the signal (writable)
   * Setting this property will notify all subscribers
   */
  value: T;
}

/**
 * MaybeSignal - Value that may or may not be a signal
 * Useful for accepting both static values and reactive signals
 */
export type MaybeSignal<T> = T | ReadableSignal<T>;

/**
 * SignalValue - Extract the value type from a Signal
 * Useful for type inference with generic signals
 */
export type SignalValue<S> = S extends ReadableSignal<infer T> ? T : never;

/**
 * Legacy type aliases for backward compatibility
 * @deprecated Use ReadableSignal instead
 */
export type Signal<T> = ReadableSignal<T>;
