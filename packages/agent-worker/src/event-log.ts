import { join } from "node:path";
import type { DaemonEvent } from "./types.ts";

/**
 * Daemon-level JSONL event log.
 * Append-only with byte-offset based cursor for incremental reads.
 */
export class DaemonEventLog {
  private byteOffset = 0;
  readonly path: string;

  constructor(dataDir: string) {
    this.path = join(dataDir, "events.jsonl");
  }

  async init(): Promise<void> {
    await Bun.write(this.path, "");
    this.byteOffset = 0;
  }

  append(type: string, data?: Record<string, unknown>): void {
    const entry: DaemonEvent = { ts: Date.now(), type, ...data };
    const line = JSON.stringify(entry) + "\n";
    const bytes = new TextEncoder().encode(line);
    this.byteOffset += bytes.length;
    // Fire-and-forget append
    const path = this.path;
    Bun.file(path)
      .arrayBuffer()
      .then((existing) => {
        Bun.write(path, Buffer.concat([Buffer.from(existing), Buffer.from(bytes)]));
      });
  }

  /** Read entries from a byte offset. Returns new cursor position. */
  async read(cursor = 0): Promise<{ entries: DaemonEvent[]; cursor: number }> {
    const file = Bun.file(this.path);
    const size = file.size;
    if (cursor >= size) return { entries: [], cursor: size };
    const data = await file.slice(cursor, size).text();
    const entries = data
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as DaemonEvent);
    return { entries, cursor: size };
  }

  get offset(): number {
    return this.byteOffset;
  }
}
