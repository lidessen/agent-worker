import { test, expect, describe, beforeEach } from "bun:test";
import { InboxStore } from "../src/context/stores/inbox.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import type { InboxEntry } from "../src/types.ts";

describe("InboxStore", () => {
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

  test("enqueue and peek", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.enqueue("alice", makeEntry("msg2"));

    const entries = await store.peek("alice");
    expect(entries).toHaveLength(2);
    expect(entries[0]!.messageId).toBe("msg1");
    expect(entries[1]!.messageId).toBe("msg2");
  });

  test("no duplicate delivery (invariant #7)", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.enqueue("alice", makeEntry("msg1"));

    const entries = await store.peek("alice");
    expect(entries).toHaveLength(1);
  });

  test("ack removes entry", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.ack("alice", "msg1");

    const entries = await store.peek("alice");
    expect(entries).toHaveLength(0);
  });

  test("defer changes state", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    const future = new Date(Date.now() + 60000).toISOString();
    await store.defer("alice", "msg1", future);

    // Should not appear in peek (deferred until future)
    const entries = await store.peek("alice");
    expect(entries).toHaveLength(0);
  });

  test("deferred without expiry returns to pending on next peek", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.defer("alice", "msg1");

    const entries = await store.peek("alice");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.state).toBe("pending");
  });

  test("markSeen transitions pending to seen", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.markSeen("alice", "msg1");

    // Seen entries don't appear in peek (only pending)
    const entries = await store.peek("alice");
    expect(entries).toHaveLength(0);
  });

  test("markRunStart requeues seen entries instead of clearing the inbox", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.enqueue("alice", makeEntry("msg2", { state: "deferred" }));
    await store.markSeen("alice", "msg1");
    await store.markRunStart("alice");

    const entries = await store.peek("alice");
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.messageId)).toEqual(["msg1", "msg2"]);
    expect(entries.every((entry) => entry.state === "pending")).toBe(true);
  });

  test("markSeen persists so recovery can retry unacked work", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.markSeen("alice", "msg1");

    const recovered = new InboxStore(storage);
    await recovered.load("alice");
    await recovered.markRunStart("alice");

    const entries = await recovered.peek("alice");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.messageId).toBe("msg1");
  });

  test("inspect is non-mutating and includes seen/deferred entries", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.enqueue("alice", makeEntry("msg2"));
    await store.markSeen("alice", "msg1");
    await store.defer("alice", "msg2", new Date(Date.now() + 60_000).toISOString());

    const snapshot = await store.inspect("alice");
    expect(snapshot).toHaveLength(2);
    expect(snapshot.map((entry) => entry.state)).toEqual(["seen", "deferred"]);

    const peeked = await store.peek("alice");
    expect(peeked).toHaveLength(0);
  });

  test("hasEntry checks existence", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    expect(await store.hasEntry("alice", "msg1")).toBe(true);
    expect(await store.hasEntry("alice", "msg2")).toBe(false);
  });

  test("agents have independent inboxes", async () => {
    await store.enqueue("alice", makeEntry("msg1"));
    await store.enqueue("bob", makeEntry("msg2"));

    const aliceEntries = await store.peek("alice");
    const bobEntries = await store.peek("bob");

    expect(aliceEntries).toHaveLength(1);
    expect(aliceEntries[0]!.messageId).toBe("msg1");
    expect(bobEntries).toHaveLength(1);
    expect(bobEntries[0]!.messageId).toBe("msg2");
  });
});
