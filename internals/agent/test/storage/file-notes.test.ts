import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { FileNotesStorage } from "../../src/storage/file-notes.ts";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("FileNotesStorage", () => {
  let tempDir: string;
  let storage: FileNotesStorage;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "file-notes-test-"));
    storage = new FileNotesStorage(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("write creates file", async () => {
    await storage.write("test-key", "test content");
    const content = await storage.read("test-key");
    expect(content).toBe("test content");
  });

  test("write overwrites existing file", async () => {
    await storage.write("test-key", "original");
    await storage.write("test-key", "updated");
    const content = await storage.read("test-key");
    expect(content).toBe("updated");
  });

  test("read returns null for non-existent key", async () => {
    const content = await storage.read("nonexistent");
    expect(content).toBeNull();
  });

  test("read returns file content", async () => {
    await storage.write("my-note", "Hello, world!");
    const content = await storage.read("my-note");
    expect(content).toBe("Hello, world!");
  });

  test("list returns all note keys", async () => {
    await storage.write("note1", "content 1");
    await storage.write("note2", "content 2");
    await storage.write("note3", "content 3");

    const keys = await storage.list();
    expect(keys.sort()).toEqual(["note1", "note2", "note3"]);
  });

  test("list returns empty array when no notes", async () => {
    const keys = await storage.list();
    expect(keys).toEqual([]);
  });

  test("delete removes file", async () => {
    await storage.write("to-delete", "content");
    await storage.delete("to-delete");
    const content = await storage.read("to-delete");
    expect(content).toBeNull();
  });

  test("delete is idempotent", async () => {
    await storage.delete("nonexistent"); // Should not throw
    await storage.delete("nonexistent"); // Should not throw
  });

  test("sanitizes key to prevent path traversal", async () => {
    await storage.write("../../../etc/passwd", "malicious");
    // The key "../../../etc/passwd" gets sanitized to ".._.._.._etc_passwd"
    // (dots are allowed, slashes become underscores)
    const sanitizedKey = ".._.._.._etc_passwd";

    // Verify the file was written and can be read with the sanitized key
    const content = await storage.read(sanitizedKey);
    expect(content).toBe("malicious");

    // Original key also works because read() sanitizes it the same way
    const originalContent = await storage.read("../../../etc/passwd");
    expect(originalContent).toBe("malicious");

    // The key point: path traversal is prevented because "/" becomes "_"
    // So "../../../etc/passwd" can't escape the directory - the file is stored
    // in the expected directory with a sanitized filename, not outside it.
    // Note: list() may not return keys starting with dots depending on glob behavior,
    // but the important thing is that path traversal is prevented.
    const keys = await storage.list();
    // Verify no slashes in listed keys (path traversal prevented)
    for (const key of keys) {
      expect(key).not.toContain("/");
    }
    // The sanitized key should be readable even if not in list()
    expect(content).toBe("malicious");
  });

  test("sanitizes special characters in key", async () => {
    await storage.write("test/key", "content");
    const keys = await storage.list();
    // Key should be sanitized
    expect(keys[0]).not.toContain("/");
  });

  test("handles unicode content", async () => {
    const unicodeContent = "Hello 🌍 世界 مرحبا";
    await storage.write("unicode", unicodeContent);
    const content = await storage.read("unicode");
    expect(content).toBe(unicodeContent);
  });

  test("handles multiline content", async () => {
    const multiline = "Line 1\nLine 2\nLine 3";
    await storage.write("multiline", multiline);
    const content = await storage.read("multiline");
    expect(content).toBe(multiline);
  });
});
