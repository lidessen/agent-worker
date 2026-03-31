import { test, expect, describe, beforeEach } from "bun:test";
import { InboxStore } from "../src/context/stores/inbox.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import type { InboxEntry } from "../src/types.ts";

describe("wait_inbox / waitForMessage (InboxStore)", () => {
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
      priority: "normal",
      state: "pending",
      enqueuedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  test("waitForMessage resolves when a message is enqueued", async () => {
    const waiting = store.waitForMessage("alice");

    // Enqueue in parallel
    setTimeout(() => store.enqueue("alice", makeEntry("msg1")), 10);

    await waiting;

    const entries = await store.peek("alice");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.messageId).toBe("msg1");
  });

  test("waitForMessage does not resolve for a different agent", async () => {
    let resolved = false;
    const waiting = store.waitForMessage("alice").then(() => {
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

  test("waitForMessage with timeout expires correctly", async () => {
    const result = await Promise.race([
      store.waitForMessage("alice").then(() => "received"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 100)),
    ]);

    expect(result).toBe("timeout");
  });

  test("waitForMessage with timeout resolves before timeout when message arrives", async () => {
    const start = Date.now();

    setTimeout(() => store.enqueue("alice", makeEntry("msg1")), 10);

    const result = await Promise.race([
      store.waitForMessage("alice").then(() => "received"),
      new Promise<string>((resolve) => setTimeout(() => resolve("timeout"), 5000)),
    ]);

    const elapsed = Date.now() - start;
    expect(result).toBe("received");
    expect(elapsed).toBeLessThan(1000);
  });

  test("multiple listeners are all notified", async () => {
    const p1 = store.waitForMessage("alice");
    const p2 = store.waitForMessage("alice");

    await store.enqueue("alice", makeEntry("msg1"));

    // Both should resolve
    await Promise.all([p1, p2]);
  });
});
