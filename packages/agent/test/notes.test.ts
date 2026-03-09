import { test, expect, describe } from "bun:test";
import { InMemoryNotesStorage } from "../src/notes.ts";

describe("InMemoryNotesStorage", () => {
  test("write and read", async () => {
    const notes = new InMemoryNotesStorage();
    await notes.write("key1", "hello world");
    expect(await notes.read("key1")).toBe("hello world");
  });

  test("read returns null for missing key", async () => {
    const notes = new InMemoryNotesStorage();
    expect(await notes.read("nonexistent")).toBeNull();
  });

  test("list returns all keys", async () => {
    const notes = new InMemoryNotesStorage();
    await notes.write("a", "1");
    await notes.write("b", "2");
    const keys = await notes.list();
    expect(keys).toContain("a");
    expect(keys).toContain("b");
    expect(keys).toHaveLength(2);
  });

  test("delete removes key", async () => {
    const notes = new InMemoryNotesStorage();
    await notes.write("key1", "hello");
    await notes.delete("key1");
    expect(await notes.read("key1")).toBeNull();
    expect(await notes.list()).toHaveLength(0);
  });

  test("write overwrites existing", async () => {
    const notes = new InMemoryNotesStorage();
    await notes.write("key1", "first");
    await notes.write("key1", "second");
    expect(await notes.read("key1")).toBe("second");
    expect(await notes.list()).toHaveLength(1);
  });
});
