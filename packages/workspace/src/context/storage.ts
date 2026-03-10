import { join, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { StorageBackend } from "../types.ts";

// ── MemoryStorage ──────────────────────────────────────────────────────────

export class MemoryStorage implements StorageBackend {
  private files = new Map<string, string>();

  async appendLine(path: string, line: string): Promise<void> {
    const existing = this.files.get(path) ?? "";
    this.files.set(path, existing + line + "\n");
  }

  async readLines(path: string): Promise<string[]> {
    const content = this.files.get(path);
    if (!content) return [];
    return content.split("\n").filter((line) => line.length > 0);
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async readFile(path: string): Promise<string | null> {
    return this.files.get(path) ?? null;
  }

  async listFiles(dir: string): Promise<string[]> {
    const prefix = dir.endsWith("/") ? dir : dir + "/";
    const result: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        // Only direct children (no nested /)
        if (!rest.includes("/")) {
          result.push(rest);
        }
      }
    }
    return result;
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  /** Test helper: clear all data. */
  clear(): void {
    this.files.clear();
  }
}

// ── FileStorage ────────────────────────────────────────────────────────────

export class FileStorage implements StorageBackend {
  constructor(private readonly baseDir: string) {}

  private resolve(path: string): string {
    return join(this.baseDir, path);
  }

  async appendLine(path: string, line: string): Promise<void> {
    const fullPath = this.resolve(path);
    await mkdir(dirname(fullPath), { recursive: true });
    const file = Bun.file(fullPath);
    const existing = (await file.exists()) ? await file.text() : "";
    await Bun.write(fullPath, existing + line + "\n");
  }

  async readLines(path: string): Promise<string[]> {
    const fullPath = this.resolve(path);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) return [];
    const content = await file.text();
    return content.split("\n").filter((line) => line.length > 0);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, content);
  }

  async readFile(path: string): Promise<string | null> {
    const fullPath = this.resolve(path);
    const file = Bun.file(fullPath);
    if (!(await file.exists())) return null;
    return file.text();
  }

  async listFiles(dir: string): Promise<string[]> {
    const fullPath = this.resolve(dir);
    try {
      const glob = new Bun.Glob("*");
      const entries: string[] = [];
      for await (const entry of glob.scan({ cwd: fullPath, onlyFiles: true })) {
        entries.push(entry);
      }
      return entries;
    } catch {
      return [];
    }
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolve(path);
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(fullPath);
    } catch {
      // no-op if not found
    }
  }
}
