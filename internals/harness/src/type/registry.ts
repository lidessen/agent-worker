// In-memory `HarnessTypeRegistry`. One instance per process, owned by
// the daemon and passed into each Harness at construction.

import type { HarnessType, HarnessTypeRegistry } from "./types.ts";
import { defaultHarnessType, DEFAULT_HARNESS_TYPE_ID } from "./default.ts";

class InMemoryHarnessTypeRegistry implements HarnessTypeRegistry {
  private readonly types = new Map<string, HarnessType>();
  private readonly order: string[] = [];

  constructor() {
    this.register(defaultHarnessType);
  }

  register(type: HarnessType): void {
    if (!type.id) throw new Error("HarnessType.id is required");
    if (!this.types.has(type.id)) this.order.push(type.id);
    this.types.set(type.id, type);
  }

  get(id: string): HarnessType | undefined {
    return this.types.get(id);
  }

  resolve(id: string | undefined): HarnessType {
    if (id !== undefined) {
      const found = this.types.get(id);
      if (found) return found;
    }
    // Default is always registered in the constructor, so this lookup
    // can't return undefined under normal use; fall back defensively.
    return this.types.get(DEFAULT_HARNESS_TYPE_ID) ?? defaultHarnessType;
  }

  list(): HarnessType[] {
    return this.order
      .map((id) => this.types.get(id))
      .filter((t): t is HarnessType => t !== undefined);
  }
}

/**
 * Build a fresh registry seeded with the default no-op type. Call once
 * per daemon process (typically in the `Daemon` constructor).
 */
export function createHarnessTypeRegistry(): HarnessTypeRegistry {
  return new InMemoryHarnessTypeRegistry();
}
