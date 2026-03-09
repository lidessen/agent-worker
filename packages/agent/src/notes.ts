import type { NotesStorage } from "./types.ts";

/** In-memory notes storage (default). Not persisted across restarts. */
export class InMemoryNotesStorage implements NotesStorage {
  private store = new Map<string, string>();

  async read(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async write(key: string, content: string): Promise<void> {
    this.store.set(key, content);
  }

  async list(): Promise<string[]> {
    return [...this.store.keys()];
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
