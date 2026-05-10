import type { ReadableSignal } from "./types";
import { scheduleUpdate } from "./batch";

/**
 * Create a computed signal with declarative dependencies
 *
 * Lazy evaluation: subscribes to dependencies only when the computed itself
 * has subscribers, and unsubscribes when the last subscriber leaves.
 * This prevents memory leaks without manual disposal.
 *
 * @example
 * const count = signal(0);
 * const doubled = computed([count], c => c * 2);
 *
 * @example
 * const firstName = signal('John');
 * const lastName = signal('Doe');
 * const fullName = computed([firstName, lastName], (f, l) => `${f} ${l}`);
 */

// Single dependency overload
export function computed<T, R>(dep: ReadableSignal<T>, compute: (value: T) => R): ReadableSignal<R>;

// Multiple dependencies overload
export function computed<T extends readonly ReadableSignal<any>[], R>(
  deps: [...T],
  compute: (...values: { [K in keyof T]: T[K] extends ReadableSignal<infer V> ? V : never }) => R,
): ReadableSignal<R>;

// Implementation
export function computed(deps: any, compute: any): ReadableSignal<any> {
  const depsArray: ReadableSignal<any>[] = Array.isArray(deps) ? deps : [deps];

  let value: any;
  let active = false;
  let depUnsubs: Array<() => void> = [];
  const subscribers = new Set<(value: any) => void>();

  // Get current values from all dependencies
  const getValues = () => depsArray.map((dep) => dep.value);

  // Apply compute function with correct arity
  const computeValue = (values: any[]) =>
    Array.isArray(deps) ? compute(...values) : compute(values[0]);

  // Notify subscribers (scheduled via microtask)
  const notifyCallback = () => {
    for (const listener of subscribers) {
      listener(value);
    }
  };

  // Recompute when dependencies change (only called when active)
  const recompute = () => {
    const newValue = computeValue(getValues());
    if (!Object.is(value, newValue)) {
      value = newValue;
      scheduleUpdate(notifyCallback);
    }
  };

  // Activate: subscribe to all dependencies
  function activate() {
    value = computeValue(getValues());
    depUnsubs = depsArray.map((dep) => dep.subscribe(recompute));
    active = true;
  }

  // Deactivate: unsubscribe from all dependencies
  function deactivate() {
    for (const unsub of depUnsubs) unsub();
    depUnsubs = [];
    active = false;
  }

  return {
    get value() {
      if (!active) {
        // No subscribers — compute on demand, don't cache
        return computeValue(getValues());
      }
      return value;
    },

    subscribe(listener: (value: any) => void) {
      subscribers.add(listener);
      if (subscribers.size === 1) activate();
      return () => {
        subscribers.delete(listener);
        if (subscribers.size === 0) deactivate();
      };
    },
  };
}

export const memo: typeof computed = computed;
