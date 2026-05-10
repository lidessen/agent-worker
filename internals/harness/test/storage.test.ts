import { test, expect, describe, beforeEach } from "bun:test";
import { MemoryStorage } from "../src/context/storage.ts";

describe("MemoryStorage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  test("appendLine and readLines", async () => {
    await storage.appendLine("test.jsonl", '{"a":1}');
    await storage.appendLine("test.jsonl", '{"a":2}');

    const lines = await storage.readLines("test.jsonl");
    expect(lines).toEqual(['{"a":1}', '{"a":2}']);
  });

  test("readLines returns [] for missing file", async () => {
    const lines = await storage.readLines("nonexistent");
    expect(lines).toEqual([]);
  });

  test("writeFile and readFile", async () => {
    await storage.writeFile("doc.txt", "hello world");
    const content = await storage.readFile("doc.txt");
    expect(content).toBe("hello world");
  });

  test("readFile returns null for missing file", async () => {
    const content = await storage.readFile("nonexistent");
    expect(content).toBeNull();
  });

  test("writeFile overwrites", async () => {
    await storage.writeFile("doc.txt", "v1");
    await storage.writeFile("doc.txt", "v2");
    expect(await storage.readFile("doc.txt")).toBe("v2");
  });

  test("listFiles", async () => {
    await storage.writeFile("dir/a.txt", "a");
    await storage.writeFile("dir/b.txt", "b");
    await storage.writeFile("dir/sub/c.txt", "c");

    const files = await storage.listFiles("dir");
    expect(files.sort()).toEqual(["a.txt", "b.txt"]);
  });

  test("deleteFile", async () => {
    await storage.writeFile("tmp.txt", "data");
    await storage.deleteFile("tmp.txt");
    expect(await storage.readFile("tmp.txt")).toBeNull();
  });

  test("deleteFile is no-op for missing file", async () => {
    await storage.deleteFile("nonexistent");
    // Should not throw
  });

  test("clear removes all data", async () => {
    await storage.writeFile("a", "1");
    await storage.writeFile("b", "2");
    storage.clear();
    expect(await storage.readFile("a")).toBeNull();
    expect(await storage.readFile("b")).toBeNull();
  });
});
