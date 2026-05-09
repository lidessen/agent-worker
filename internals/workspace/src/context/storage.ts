import { join, dirname } from "node:path";
import { mkdir, readFile, writeFile, appendFile, readdir, unlink, access } from "node:fs/promises";
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
    await appendFile(fullPath, line + "\n", "utf-8");
  }

  async readLines(path: string): Promise<string[]> {
    const fullPath = this.resolve(path);
    try {
      await access(fullPath);
    } catch {
      return [];
    }
    const content = await readFile(fullPath, "utf-8");
    return content.split("\n").filter((line) => line.length > 0);
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }

  async readFile(path: string): Promise<string | null> {
    const fullPath = this.resolve(path);
    try {
      await access(fullPath);
    } catch {
      return null;
    }
    return readFile(fullPath, "utf-8");
  }

  async listFiles(dir: string): Promise<string[]> {
    const fullPath = this.resolve(dir);
    try {
      const entries = await readdir(fullPath, { withFileTypes: true });
      return entries.filter((e) => e.isFile()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = this.resolve(path);
    try {
      await unlink(fullPath);
    } catch {
      // no-op if not found
    }
  }
}
