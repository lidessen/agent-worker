import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { FileMemoryStorage } from "../../src/storage/file-memory.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("FileMemoryStorage", () => {
  let tempDir: string;
  let storage: FileMemoryStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "file-memory-test-"));
    storage = new FileMemoryStorage(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("add creates entry with generated id", async () => {
    const id = await storage.add({ text: "test memory", timestamp: Date.now(), source: "test" });
    expect(id).toMatch(/^mem_\d+$/);
  });

  test("add persists entry to file", async () => {
    const id = await storage.add({ text: "test memory", timestamp: Date.now(), source: "test" });
    const entries = await storage.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.id).toBe(id);
    expect(entries[0]!.text).toBe("test memory");
  });

  test("list returns entries in order", async () => {
    await storage.add({ text: "first", timestamp: 1000, source: "test" });
    await storage.add({ text: "second", timestamp: 2000, source: "test" });
    const entries = await storage.list();
    expect(entries).toHaveLength(2);
    expect(entries[0]!.text).toBe("first");
    expect(entries[1]!.text).toBe("second");
  });

  test("list respects limit", async () => {
    for (let i = 0; i < 10; i++) {
      await storage.add({ text: `memory ${i}`, timestamp: Date.now(), source: "test" });
    }
    const entries = await storage.list(5);
    expect(entries).toHaveLength(5);
  });

  test("search finds entries by keyword", async () => {
    await storage.add({ text: "apple pie recipe", timestamp: Date.now(), source: "test" });
    await storage.add({ text: "banana bread recipe", timestamp: Date.now(), source: "test" });
    await storage.add({ text: "chocolate cake", timestamp: Date.now(), source: "test" });

    const results = await storage.search("recipe");
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.text)).toContain("apple pie recipe");
    expect(results.map((r) => r.text)).toContain("banana bread recipe");
  });

  test("search is case insensitive", async () => {
    await storage.add({ text: "Apple Pie", timestamp: Date.now(), source: "test" });
    const results = await storage.search("apple");
    expect(results).toHaveLength(1);
  });

  test("search scores by multiple keywords", async () => {
    await storage.add({ text: "apple pie recipe", timestamp: Date.now(), source: "test" });
    await storage.add({ text: "apple cake", timestamp: Date.now(), source: "test" });
    await storage.add({ text: "banana pie", timestamp: Date.now(), source: "test" });

    const results = await storage.search("apple pie");
    // All entries match at least one keyword: "apple pie recipe" (2), "apple cake" (1), "banana pie" (1)
    expect(results.length).toBeGreaterThanOrEqual(2);
    // "apple pie recipe" should rank highest (2 keywords match)
    expect(results[0]!.text).toBe("apple pie recipe");
  });

  test("search respects limit", async () => {
    for (let i = 0; i < 10; i++) {
      await storage.add({ text: `test memory ${i}`, timestamp: Date.now(), source: "test" });
    }
    const results = await storage.search("test", 3);
    expect(results).toHaveLength(3);
  });

  test("search returns empty array when no matches", async () => {
    await storage.add({ text: "apple", timestamp: Date.now(), source: "test" });
    const results = await storage.search("banana");
    expect(results).toHaveLength(0);
  });

  test("remove deletes entry", async () => {
    const id = await storage.add({ text: "test", timestamp: Date.now(), source: "test" });
    await storage.remove(id);
    const entries = await storage.list();
    expect(entries).toHaveLength(0);
  });

  test("remove is idempotent", async () => {
    const id = await storage.add({ text: "test", timestamp: Date.now(), source: "test" });
    await storage.remove(id);
    await storage.remove(id); // Should not throw
    const entries = await storage.list();
    expect(entries).toHaveLength(0);
  });

  test("loads existing entries from file", async () => {
    const id1 = await storage.add({ text: "first", timestamp: 1000, source: "test" });
    const id2 = await storage.add({ text: "second", timestamp: 2000, source: "test" });

    // Create new instance to test file loading
    const storage2 = new FileMemoryStorage(tempDir);
    const entries = await storage2.list();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.id)).toContain(id1);
    expect(entries.map((e) => e.id)).toContain(id2);
  });
});
