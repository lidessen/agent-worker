import { test, expect, describe, beforeEach } from "bun:test";
import { ChannelStore } from "../src/context/stores/channel.ts";
import { MemoryStorage } from "../src/context/storage.ts";

describe("ChannelStore", () => {
  let storage: MemoryStorage;
  let store: ChannelStore;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new ChannelStore(storage, ["general", "design"]);
  });

  test("listChannels returns initial channels", () => {
    expect(store.listChannels().sort()).toEqual(["design", "general"]);
  });

  test("createChannel adds new channel", () => {
    store.createChannel("ops");
    expect(store.listChannels()).toContain("ops");
  });

  test("append creates message with id and timestamp", async () => {
    const msg = await store.append("general", {
      from: "alice",
      channel: "general",
      content: "hello",
      mentions: [],
    });

    expect(msg.id).toBeTruthy();
    expect(msg.timestamp).toBeTruthy();
    expect(msg.from).toBe("alice");
    expect(msg.content).toBe("hello");
    expect(msg.channel).toBe("general");
  });

  test("read returns messages in order", async () => {
    await store.append("general", {
      from: "alice",
      channel: "general",
      content: "first",
      mentions: [],
    });
    await store.append("general", {
      from: "bob",
      channel: "general",
      content: "second",
      mentions: [],
    });

    const messages = await store.read("general");
    expect(messages).toHaveLength(2);
    expect(messages[0]!.content).toBe("first");
    expect(messages[1]!.content).toBe("second");
  });

  test("read with limit returns last N messages", async () => {
    for (let i = 0; i < 5; i++) {
      await store.append("general", {
        from: "alice",
        channel: "general",
        content: `msg-${i}`,
        mentions: [],
      });
    }

    const messages = await store.read("general", { limit: 2 });
    expect(messages).toHaveLength(2);
    expect(messages[0]!.content).toBe("msg-3");
    expect(messages[1]!.content).toBe("msg-4");
  });

  test("getMessage finds specific message", async () => {
    const msg = await store.append("general", {
      from: "alice",
      channel: "general",
      content: "target",
      mentions: [],
    });

    const found = await store.getMessage("general", msg.id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe("target");
  });

  test("getMessage returns null for unknown id", async () => {
    const found = await store.getMessage("general", "unknown");
    expect(found).toBeNull();
  });

  test("emits message event on append", async () => {
    const received: any[] = [];
    store.on("message", (msg) => received.push(msg));

    await store.append("general", {
      from: "alice",
      channel: "general",
      content: "hello",
      mentions: [],
    });

    expect(received).toHaveLength(1);
    expect(received[0].content).toBe("hello");
  });

  test("off removes listener", async () => {
    const received: any[] = [];
    const listener = (msg: any) => received.push(msg);
    store.on("message", listener);
    store.off("message", listener);

    await store.append("general", {
      from: "alice",
      channel: "general",
      content: "hello",
      mentions: [],
    });

    expect(received).toHaveLength(0);
  });

  test("findMessage searches across channels", async () => {
    const msg = await store.append("design", {
      from: "bob",
      channel: "design",
      content: "design note",
      mentions: [],
    });

    const found = await store.findMessage(msg.id);
    expect(found).not.toBeNull();
    expect(found!.content).toBe("design note");
  });

  test("channels are isolated", async () => {
    await store.append("general", {
      from: "alice",
      channel: "general",
      content: "general msg",
      mentions: [],
    });
    await store.append("design", {
      from: "bob",
      channel: "design",
      content: "design msg",
      mentions: [],
    });

    const general = await store.read("general");
    const design = await store.read("design");

    expect(general).toHaveLength(1);
    expect(design).toHaveLength(1);
    expect(general[0]!.content).toBe("general msg");
    expect(design[0]!.content).toBe("design msg");
  });
});
