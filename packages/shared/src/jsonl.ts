import { appendFileSync, statSync, openSync, readSync, closeSync } from "node:fs";

/** Read a file from a byte offset to end. Returns text and new cursor position. */
export async function readFrom(
  path: string,
  cursor: number,
): Promise<{ data: string; cursor: number }> {
  let size: number;
  try {
    size = statSync(path).size;
  } catch {
    return { data: "", cursor: 0 };
  }
  if (cursor >= size) return { data: "", cursor: size };
  const buf = Buffer.alloc(size - cursor);
  const fd = openSync(path, "r");
  readSync(fd, buf, 0, buf.length, cursor);
  closeSync(fd);
  return { data: buf.toString("utf-8"), cursor: size };
}

/** Parse JSONL text into an array of objects. Skips empty lines. */
export function parseJsonl<T = Record<string, unknown>>(data: string): T[] {
  return data
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

/** Append a timestamped JSON entry to a file. Fire-and-forget. */
export function appendJsonl(path: string, entry: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: Date.now(), ...entry }) + "\n";
  appendFileSync(path, line);
}
