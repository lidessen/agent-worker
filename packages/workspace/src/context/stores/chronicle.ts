import { nanoid } from "../../utils.ts";
import type { ChronicleEntry, StorageBackend, ChronicleStoreInterface } from "../../types.ts";

const CHRONICLE_DIR = "chronicle";

/** Return shard filename for a given date, e.g. "2026-03.jsonl". */
function shardName(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}.jsonl`;
}

export class ChronicleStore implements ChronicleStoreInterface {
  constructor(private readonly storage: StorageBackend) {}

  async append(partial: Omit<ChronicleEntry, "id" | "timestamp">): Promise<ChronicleEntry> {
    const now = new Date();
    const entry: ChronicleEntry = {
      ...partial,
      id: nanoid(),
      timestamp: now.toISOString(),
    };

    const path = `${CHRONICLE_DIR}/${shardName(now)}`;
    await this.storage.appendLine(path, JSON.stringify(entry));

    return entry;
  }

  async read(opts?: { limit?: number; category?: string }): Promise<ChronicleEntry[]> {
    const files = await this.storage.listFiles(CHRONICLE_DIR);
    // Sort by filename (YYYY-MM.jsonl sorts chronologically)
    const sorted = files.filter((f) => f.endsWith(".jsonl")).sort();

    // Read from newest shard backwards — stop early when we have enough
    const needAll = !opts?.limit || opts?.category;
    const entries: ChronicleEntry[] = [];

    const order = needAll ? sorted : [...sorted].reverse();
    for (const file of order) {
      const lines = await this.storage.readLines(`${CHRONICLE_DIR}/${file}`);
      const parsed: ChronicleEntry[] = [];
      for (const line of lines) {
        try {
          parsed.push(JSON.parse(line) as ChronicleEntry);
        } catch {
          // Skip malformed lines
        }
      }

      if (needAll) {
        entries.push(...parsed);
      } else {
        // Reading in reverse shard order — prepend to maintain chronological order
        entries.unshift(...parsed);
        if (entries.length >= opts!.limit!) break;
      }
    }

    let result = entries;

    if (opts?.category) {
      result = result.filter((e) => e.category === opts.category);
    }

    if (opts?.limit) {
      result = result.slice(-opts.limit);
    }

    return result;
  }
}
