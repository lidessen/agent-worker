import { appendFileSync } from "node:fs";

/** Read a file from a byte offset to end. Returns text and new cursor position. */
export async function readFrom(
  path: string,
  cursor: number,
): Promise<{ data: string; cursor: number }> {
  const file = Bun.file(path);
  const size = file.size;
  if (cursor >= size) return { data: "", cursor: size };
  const buf = await file.slice(cursor, size).text();
  return { data: buf, cursor: size };
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
