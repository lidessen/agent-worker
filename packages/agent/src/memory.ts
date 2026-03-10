import type { MemoryConfig, MemoryStorage, MemoryEntry, Turn } from "./types.ts";

/**
 * In-memory MemoryStorage (default when memory is enabled but no storage provided).
 */
export class InMemoryMemoryStorage implements MemoryStorage {
  private entries: MemoryEntry[] = [];
  private nextId = 1;

  async add(entry: Omit<MemoryEntry, "id">): Promise<string> {
    const id = `mem_${this.nextId++}`;
    this.entries.push({ ...entry, id });
    return id;
  }

  async search(query: string, limit = 10): Promise<MemoryEntry[]> {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter(Boolean);

    const scored = this.entries.map((entry) => {
      const textLower = entry.text.toLowerCase();
      const score = words.reduce((s, word) => s + (textLower.includes(word) ? 1 : 0), 0);
      return { entry, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  async list(limit = 50): Promise<MemoryEntry[]> {
    return this.entries.slice(-limit);
  }

  async remove(id: string): Promise<void> {
    const idx = this.entries.findIndex((e) => e.id === id);
    if (idx >= 0) this.entries.splice(idx, 1);
  }
}

/**
 * MemoryManager handles auto-extraction and recall.
 */
export class MemoryManager {
  private storage: MemoryStorage;
  private extractAt: "checkpoint" | "idle" | "never";
  private maxInjected: number;
  private extractMemories?: (turns: Turn[]) => Promise<string[]>;

  constructor(config: MemoryConfig) {
    this.storage = config.storage ?? new InMemoryMemoryStorage();
    this.extractAt = config.extractAt ?? "checkpoint";
    this.maxInjected = config.maxInjected ?? 10;
    this.extractMemories = config.extractMemories;
  }

  get storageBackend(): MemoryStorage {
    return this.storage;
  }

  /** Extract memories from recent turns and store them */
  async extract(turns: Turn[], source: string): Promise<void> {
    if (this.extractAt === "never") return;

    let memories: string[];
    if (this.extractMemories) {
      memories = await this.extractMemories(turns);
    } else {
      // Default: simple extraction from text turns
      memories = this.simpleExtract(turns);
    }

    for (const text of memories) {
      await this.storage.add({
        text,
        source,
        timestamp: Date.now(),
      });
    }
  }

  /** Recall relevant memories for the current context */
  async recall(query: string): Promise<MemoryEntry[]> {
    return this.storage.search(query, this.maxInjected);
  }

  /** Search memories (exposed as tool for LLM) */
  async search(query: string, limit?: number): Promise<MemoryEntry[]> {
    return this.storage.search(query, limit ?? this.maxInjected);
  }

  /** Format memories for prompt injection */
  async formatForPrompt(query: string): Promise<string> {
    const memories = await this.recall(query);
    if (memories.length === 0) return "";
    const lines = memories.map((m) => `• ${m.text}`);
    return `🧠 Relevant memories:\n${lines.join("\n")}`;
  }

  /** Should extract at this point? */
  shouldExtract(trigger: "checkpoint" | "idle"): boolean {
    if (this.extractAt === "never") return false;
    return this.extractAt === trigger;
  }

  /** Simple keyword-based extraction (fallback when no model/custom fn) */
  private simpleExtract(turns: Turn[]): string[] {
    // Extract key sentences from recent assistant turns
    const memories: string[] = [];
    for (const turn of turns) {
      if (turn.role !== "assistant") continue;
      // Take sentences that look like decisions or facts
      const sentences = turn.content.split(/[.!?\n]+/).filter((s) => s.trim().length > 20);
      for (const s of sentences.slice(0, 3)) {
        memories.push(s.trim());
      }
    }
    return memories.slice(0, 5);
  }
}
