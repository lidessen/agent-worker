import { join } from "node:path";
import { appendFileSync, writeFileSync } from "node:fs";
import { readFrom, parseJsonl } from "@agent-worker/shared";
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
    writeFileSync(this.path, "");
    this.byteOffset = 0;
  }

  append(type: string, data?: Record<string, unknown>): void {
    const entry: DaemonEvent = { ts: Date.now(), type, ...data };
    const line = JSON.stringify(entry) + "\n";
    const bytes = new TextEncoder().encode(line);
    this.byteOffset += bytes.length;
    appendFileSync(this.path, line);
  }

  /** Read entries from a byte offset. Returns new cursor position. */
  async read(cursor = 0): Promise<{ entries: DaemonEvent[]; cursor: number }> {
    const result = await readFrom(this.path, cursor);
    if (!result.data) return { entries: [], cursor: result.cursor };
    const entries = parseJsonl<DaemonEvent>(result.data);
    return { entries, cursor: result.cursor };
  }

  get offset(): number {
    return this.byteOffset;
  }
}
