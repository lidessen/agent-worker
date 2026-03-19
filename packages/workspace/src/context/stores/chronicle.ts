import { nanoid } from "../../utils.ts";
import type { ChronicleEntry, StorageBackend, ChronicleStoreInterface } from "../../types.ts";

const CHRONICLE_PATH = "global/chronicle.jsonl";

export class ChronicleStore implements ChronicleStoreInterface {
  constructor(private readonly storage: StorageBackend) {}

  async append(partial: Omit<ChronicleEntry, "id" | "timestamp">): Promise<ChronicleEntry> {
    const entry: ChronicleEntry = {
      ...partial,
      id: nanoid(),
      timestamp: new Date().toISOString(),
    };

    await this.storage.appendLine(CHRONICLE_PATH, JSON.stringify(entry));

    return entry;
  }

  async read(opts?: { limit?: number; category?: string }): Promise<ChronicleEntry[]> {
    const lines = await this.storage.readLines(CHRONICLE_PATH);
    let entries = lines.map((line) => JSON.parse(line) as ChronicleEntry);

    if (opts?.category) {
      entries = entries.filter((e) => e.category === opts.category);
    }

    if (opts?.limit) {
      entries = entries.slice(-opts.limit);
    }

    return entries;
  }
}
