import { join } from "node:path";
import { mkdir, readFile, writeFile, unlink, readdir, access } from "node:fs/promises";
import type { NotesStorage } from "../types.ts";

export class FileNotesStorage implements NotesStorage {
  constructor(private dir: string) {}

  private path(key: string): string {
    // Sanitize key to prevent path traversal
    const safe = key.replace(/[^a-zA-Z0-9_\-.]/g, "_");
    return join(this.dir, `${safe}.md`);
  }

  async read(key: string): Promise<string | null> {
    const filePath = this.path(key);
    try {
      await access(filePath);
    } catch {
      return null;
    }
    return readFile(filePath, "utf-8");
  }

  async write(key: string, content: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(key), content, "utf-8");
  }

  async list(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(this.dir);
    } catch {
      return [];
    }
    return entries
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.replace(/\.md$/, ""));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.path(key));
    } catch {
      // File doesn't exist, that's fine
    }
  }
}
