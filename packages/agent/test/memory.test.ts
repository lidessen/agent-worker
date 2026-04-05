import { test, expect, describe } from "bun:test";
import { MemoryManager, InMemoryMemoryStorage } from "../src/memory.ts";

describe("InMemoryMemoryStorage", () => {
  test("add and list", async () => {
    const storage = new InMemoryMemoryStorage();
    const id = await storage.add({
      text: "Important fact",
      source: "test",
      timestamp: Date.now(),
    });
    expect(id).toMatch(/^mem_/);
    const entries = await storage.list();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.text).toBe("Important fact");
  });

  test("search by keyword", async () => {
    const storage = new InMemoryMemoryStorage();
    await storage.add({ text: "User prefers dark mode", source: "test", timestamp: Date.now() });
    await storage.add({ text: "Project uses React", source: "test", timestamp: Date.now() });
    await storage.add({ text: "Deploy to staging first", source: "test", timestamp: Date.now() });

    const results = await storage.search("React");
    expect(results).toHaveLength(1);
    expect(results[0]!.text).toContain("React");
  });

  test("search with multiple keywords", async () => {
    const storage = new InMemoryMemoryStorage();
    await storage.add({
      text: "User prefers dark mode theme",
      source: "test",
      timestamp: Date.now(),
    });
    await storage.add({
      text: "Project uses dark background",
      source: "test",
      timestamp: Date.now(),
    });

    const results = await storage.search("dark mode");
    expect(results).toHaveLength(2);
    // First result should have more keyword matches
    expect(results[0]!.text).toContain("dark mode");
  });

  test("remove deletes entry", async () => {
    const storage = new InMemoryMemoryStorage();
    const id = await storage.add({ text: "temp", source: "test", timestamp: Date.now() });
    await storage.remove(id);
    expect(await storage.list()).toHaveLength(0);
  });
});

describe("MemoryManager", () => {
  test("extract with simple extractor", async () => {
    const manager = new MemoryManager({
      extractAt: "checkpoint",
    });

    await manager.extract(
      [
        {
          role: "assistant",
          content:
            "The user wants to refactor the auth module to use JWT tokens. This is a critical security improvement.",
        },
      ],
      "test_run",
    );

    const memories = await manager.storageBackend.list();
    expect(memories.length).toBeGreaterThan(0);
  });

  test("extract with custom function", async () => {
    const manager = new MemoryManager({
      extractMemories: async (turns) => {
        return turns.map((t) => `Extracted: ${t.content.slice(0, 20)}`);
      },
    });

    await manager.extract([{ role: "user", content: "hello world" }], "test");

    const memories = await manager.storageBackend.list();
    expect(memories).toHaveLength(1);
    expect(memories[0]!.text).toContain("Extracted:");
  });

  test("recall finds relevant memories", async () => {
    const manager = new MemoryManager({});

    await manager.storageBackend.add({
      text: "User prefers TypeScript",
      source: "test",
      timestamp: Date.now(),
    });

    const results = await manager.recall("TypeScript");
    expect(results).toHaveLength(1);
  });

  test("shouldExtract respects config", () => {
    const checkpoint = new MemoryManager({ extractAt: "checkpoint" });
    expect(checkpoint.shouldExtract("checkpoint")).toBe(true);
    expect(checkpoint.shouldExtract("event")).toBe(false);
    expect(checkpoint.shouldExtract("idle")).toBe(false);

    const event = new MemoryManager({ extractAt: "event" });
    expect(event.shouldExtract("checkpoint")).toBe(true);
    expect(event.shouldExtract("event")).toBe(true);
    expect(event.shouldExtract("idle")).toBe(false);

    const idle = new MemoryManager({ extractAt: "idle" });
    expect(idle.shouldExtract("checkpoint")).toBe(false);
    expect(idle.shouldExtract("idle")).toBe(true);

    const never = new MemoryManager({ extractAt: "never" });
    expect(never.shouldExtract("checkpoint")).toBe(false);
    expect(never.shouldExtract("idle")).toBe(false);
  });

  test("formatForPrompt returns formatted memories", async () => {
    const manager = new MemoryManager({});
    await manager.storageBackend.add({
      text: "User likes dark mode",
      source: "test",
      timestamp: Date.now(),
    });

    const formatted = await manager.formatForPrompt("dark");
    expect(formatted).toContain("🧠");
    expect(formatted).toContain("dark mode");
  });

  test("formatForPrompt returns empty string when no matches", async () => {
    const manager = new MemoryManager({});
    const formatted = await manager.formatForPrompt("xyz");
    expect(formatted).toBe("");
  });

  test("extract is skipped when extractAt is never", async () => {
    const manager = new MemoryManager({ extractAt: "never" });
    await manager.extract(
      [{ role: "assistant", content: "some important fact here that should be remembered" }],
      "test",
    );
    const memories = await manager.storageBackend.list();
    expect(memories).toHaveLength(0);
  });

  test("simpleExtract ignores user turns", async () => {
    const manager = new MemoryManager({ extractAt: "checkpoint" });
    await manager.extract(
      [
        {
          role: "user",
          content: "This is a user message that should not be extracted as a memory.",
        },
      ],
      "test",
    );
    const memories = await manager.storageBackend.list();
    expect(memories).toHaveLength(0);
  });

  test("simpleExtract ignores short sentences", async () => {
    const manager = new MemoryManager({ extractAt: "checkpoint" });
    await manager.extract([{ role: "assistant", content: "OK. Done. Yes." }], "test");
    const memories = await manager.storageBackend.list();
    expect(memories).toHaveLength(0);
  });

  test("simpleExtract caps at 5 memories", async () => {
    const manager = new MemoryManager({ extractAt: "checkpoint" });
    const longContent = Array.from(
      { length: 20 },
      (_, i) => `This is a sufficiently long sentence number ${i} that should be extracted`,
    ).join(". ");

    await manager.extract([{ role: "assistant", content: longContent }], "test");
    const memories = await manager.storageBackend.list();
    expect(memories.length).toBeLessThanOrEqual(5);
  });

  test("search delegates to storage with custom limit", async () => {
    const manager = new MemoryManager({ maxInjected: 5 });
    for (let i = 0; i < 10; i++) {
      await manager.storageBackend.add({
        text: `memory about topic ${i}`,
        source: "test",
        timestamp: Date.now(),
      });
    }

    const results = await manager.search("topic", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("extract stores source metadata", async () => {
    const manager = new MemoryManager({ extractAt: "checkpoint" });
    await manager.extract(
      [
        {
          role: "assistant",
          content: "The deployment pipeline uses GitHub Actions for continuous integration.",
        },
      ],
      "run_42",
    );
    const memories = await manager.storageBackend.list();
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0]!.source).toBe("run_42");
  });
});
