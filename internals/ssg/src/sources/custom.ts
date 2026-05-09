import type { CollectionEntry, ChangeSet, WatchCallback } from "../types";
import type { CustomSourceOptions } from "./types";
import { BaseSource } from "./base";

/**
 * Custom source for collections
 */
export class CustomSource<T = unknown> extends BaseSource<T> {
  id: string;
  private options: CustomSourceOptions<T>;

  constructor(options: CustomSourceOptions<T>) {
    super();
    this.options = options;
    this.id = options.id;
  }

  async getEntries(): Promise<CollectionEntry<T>[]> {
    const items = await this.options.getEntries();

    return items.map((item, index) => {
      const id = (item as Record<string, unknown>).id?.toString() ?? index.toString();
      const slug = (item as Record<string, unknown>).slug?.toString() ?? id;

      return {
        id,
        slug,
        data: item,
        body: (item as Record<string, unknown>).body?.toString() ?? "",
        render: async () => ({
          Content: () => {
            throw new Error("Custom content rendering not yet implemented");
          },
        }),
      };
    });
  }

  override async getEntry(id: string): Promise<CollectionEntry<T> | null> {
    if (this.options.getEntry) {
      const item = await this.options.getEntry(id);
      if (!item) return null;

      const slug = (item as Record<string, unknown>).slug?.toString() ?? id;

      return {
        id,
        slug,
        data: item,
        body: (item as Record<string, unknown>).body?.toString() ?? "",
        render: async () => ({
          Content: () => {
            throw new Error("Custom content rendering not yet implemented");
          },
        }),
      };
    }

    return super.getEntry(id);
  }

  override watch(callback: WatchCallback<T>): () => void {
    if (this.options.watch) {
      return this.options.watch(callback);
    }
    return () => {};
  }

  override async getChanges(since: string): Promise<ChangeSet<T>> {
    if (this.options.getChanges) {
      return this.options.getChanges(since);
    }

    const entries = await this.getEntries();
    return {
      cursor: Date.now().toString(),
      added: [],
      updated: entries,
      deleted: [],
    };
  }
}

/**
 * Create a custom source
 */
export function createSource<T = unknown>(options: CustomSourceOptions<T>): CustomSource<T> {
  return new CustomSource<T>(options);
}
