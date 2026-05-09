import type { CollectionSource, CollectionEntry, ChangeSet, WatchCallback } from "../types";

/**
 * Base class for collection sources
 */
export abstract class BaseSource<T = unknown> implements CollectionSource<T> {
  abstract id: string;

  abstract getEntries(): Promise<CollectionEntry<T>[]>;

  async getEntry(id: string): Promise<CollectionEntry<T> | null> {
    const entries = await this.getEntries();
    return entries.find((e) => e.id === id) ?? null;
  }

  watch?(callback: WatchCallback<T>): () => void;

  getChanges?(since: string): Promise<ChangeSet<T>>;
}
