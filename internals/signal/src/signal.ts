import type { WritableSignal } from "./types";
import { scheduleUpdate } from "./batch";

/**
 * Create a writable signal
 */
export function signal<T>(initialValue: T): WritableSignal<T> {
  let value = initialValue;
  const subscribers = new Set<(value: T) => void>();

  const sig: WritableSignal<T> = {
    get value() {
      return value;
    },

    set value(newValue: T) {
      if (!Object.is(value, newValue)) {
        value = newValue;
        notify();
      }
    },

    set(newValue: T) {
      this.value = newValue;
    },

    update(fn: (prev: T) => T) {
      this.value = fn(value);
    },

    subscribe(listener: (value: T) => void) {
      subscribers.add(listener);
      return () => {
        subscribers.delete(listener);
      };
    },
  };

  const notifyCallback = () => {
    for (const listener of subscribers) {
      listener(value);
    }
  };

  function notify() {
    scheduleUpdate(notifyCallback);
  }

  return sig;
}
