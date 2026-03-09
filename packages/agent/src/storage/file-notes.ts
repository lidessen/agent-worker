import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import type { NotesStorage } from "../types.ts";

export class FileNotesStorage implements NotesStorage {
  constructor(private dir: string) {}

  private path(key: string): string {
    // Sanitize key to prevent path traversal
    const safe = key.replace(/[^a-zA-Z0-9_\-\.]/g, "_");
    return join(this.dir, `${safe}.md`);
  }

  async read(key: string): Promise<string | null> {
    const file = Bun.file(this.path(key));
    if (!(await file.exists())) return null;
    return file.text();
  }

  async write(key: string, content: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await Bun.write(this.path(key), content);
  }

  async list(): Promise<string[]> {
    const glob = new Bun.Glob("*.md");
    const keys: string[] = [];
    for await (const path of glob.scan({ cwd: this.dir })) {
      keys.push(path.replace(/\.md$/, ""));
    }
    return keys;
  }

  async delete(key: string): Promise<void> {
    const { unlink } = await import("node:fs/promises");
    try {
      await unlink(this.path(key));
    } catch {
      // File doesn't exist, that's fine
    }
  }
}
