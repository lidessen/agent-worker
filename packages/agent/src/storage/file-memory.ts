import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { MemoryEntry, MemoryStorage } from "../types.ts";

let nextMemId = 1;

/**
 * File-based memory storage. Stores all entries in a single JSON file.
 * Search is keyword-based (simple substring match).
 */
export class FileMemoryStorage implements MemoryStorage {
  private filePath: string;
  private entries: MemoryEntry[] | null = null;

  constructor(dir: string, filename = "memories.json") {
    this.filePath = join(dir, filename);
  }

  private async load(): Promise<MemoryEntry[]> {
    if (this.entries) return this.entries;
    const file = Bun.file(this.filePath);
    if (await file.exists()) {
      this.entries = (await file.json()) as MemoryEntry[];
    } else {
      this.entries = [];
    }
    return this.entries;
  }

  private async save(): Promise<void> {
    if (!this.entries) return;
    await mkdir(join(this.filePath, ".."), { recursive: true });
    await Bun.write(this.filePath, JSON.stringify(this.entries, null, 2));
  }

  async add(entry: Omit<MemoryEntry, "id">): Promise<string> {
    const entries = await this.load();
    const id = `mem_${nextMemId++}`;
    entries.push({ ...entry, id });
    await this.save();
    return id;
  }

  async search(query: string, limit = 10): Promise<MemoryEntry[]> {
    const entries = await this.load();
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter(Boolean);

    // Score by number of matching keywords
    const scored = entries.map((entry) => {
      const textLower = entry.text.toLowerCase();
      const score = words.reduce(
        (s, word) => s + (textLower.includes(word) ? 1 : 0),
        0,
      );
      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  async list(limit = 50): Promise<MemoryEntry[]> {
    const entries = await this.load();
    return entries.slice(-limit);
  }

  async remove(id: string): Promise<void> {
    const entries = await this.load();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx >= 0) {
      entries.splice(idx, 1);
      await this.save();
    }
  }
}
