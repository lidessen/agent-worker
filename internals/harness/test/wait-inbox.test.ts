import { test, expect, describe, beforeEach } from "bun:test";
import { InboxStore } from "../src/context/stores/inbox.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import type { InboxEntry } from "../src/types.ts";

describe("wait_inbox / onNewEntry", () => {
  let storage: MemoryStorage;
  let store: InboxStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new InboxStore(storage);
  });

  function makeEntry(messageId: string, overrides?: Partial<InboxEntry>): InboxEntry {
    return {
      messageId,
      channel: "general",
      from: "alice",
      preview: "test message",
      priority: "normal",
      state: "pending",
      enqueuedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  test("onNewEntry resolves when a message is enqueued", async () => {
    const waiting = store.onNewEntry("alice");

    // Enqueue in parallel
    setTimeout(() => store.enqueue("alice", makeEntry("msg1")), 10);

    await waiting;

    const entries = await store.peek("alice");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.messageId).toBe("msg1");
  });

  test("onNewEntry does not resolve for a different agent", async () => {
    let resolved = false;
    const waiting = store.onNewEntry("alice").then(() => {
      resolved = true;
    });

    // Enqueue for bob, not alice
    await store.enqueue("bob", makeEntry("msg1"));

    // Give it a tick
    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // Now enqueue for alice to clean up
    await store.enqueue("alice", makeEntry("msg2"));
    await waiting;
    expect(resolved).toBe(true);
  });

  test("onNewEntry with timeout expires correctly", async () => {
    const result = await Promise.race([
      store.onNewEntry("alice").then(() => "received"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ]);

    expect(result).toBe("timeout");
  });

  test("onNewEntry with timeout resolves before timeout when message arrives", async () => {
    const start = Date.now();

    setTimeout(() => store.enqueue("alice", makeEntry("msg1")), 10);

    const result = await Promise.race([
      store.onNewEntry("alice").then(() => "received"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 5000)),
    ]);

    const elapsed = Date.now() - start;
    expect(result).toBe("received");
    expect(elapsed).toBeLessThan(1000);
  });

  test("multiple listeners are all notified", async () => {
    const p1 = store.onNewEntry("alice");
    const p2 = store.onNewEntry("alice");

    await store.enqueue("alice", makeEntry("msg1"));

    // Both should resolve
    await Promise.all([p1, p2]);
  });
});
