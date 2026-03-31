import { test, expect, describe } from "bun:test";
import { assemblePrompt, soulSection, inboxSection } from "../src/loop/prompt.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import { createWorkspace } from "../src/factory.ts";
import type { InboxEntry } from "../src/types.ts";

function makeInboxEntry(overrides: Partial<InboxEntry> = {}): InboxEntry {
  return {
    messageId: "msg-1",
    channel: "general",
    from: "alice",
    preview: "Hello world",
    priority: "normal",
    state: "pending",
    enqueuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Prompt assembly", () => {
  test("soulSection returns instructions", async () => {
    const workspace = await createWorkspace({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });

    const result = await soulSection({
      agentName: "alice",
      instructions: "You are a helpful assistant.",
      provider: workspace.contextProvider,
      inboxEntries: [],
    });

    expect(result).toContain("You are a helpful assistant.");
  });

  test("soulSection returns null without instructions", async () => {
    const workspace = await createWorkspace({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });

    const result = await soulSection({
      agentName: "alice",
      provider: workspace.contextProvider,
      inboxEntries: [],
    });

    expect(result).toBeNull();
  });

  test("inboxSection shows grouped notification summaries", async () => {
    const workspace = await createWorkspace({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });

    const result = await inboxSection({
      agentName: "bob",
      provider: workspace.contextProvider,
      inboxEntries: [
        makeInboxEntry({ messageId: "msg-1", from: "alice", preview: "Hey @bob review this" }),
        makeInboxEntry({ messageId: "msg-2", from: "carol", preview: "Second heads-up for @bob" }),
        makeInboxEntry({ messageId: "msg-3", from: "dave", preview: "Third note for @bob" }),
      ],
    });

    expect(result).toContain("## Pending Inbox (3)");
    expect(result).toContain("### #general (3 new)");
    expect(result).toContain('@carol: "Second heads-up for @bob"');
    expect(result).toContain('@dave: "Third note for @bob"');
    expect(result).toContain("+1 more");
    expect(result).toContain("channel_read");
  });

  test("inboxSection excludes the current message from pending summaries", async () => {
    const workspace = await createWorkspace({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });
    const entries = [
      makeInboxEntry({ messageId: "msg-1", from: "alice", preview: "Current task for @bob" }),
      makeInboxEntry({ messageId: "msg-2", from: "carol", preview: "Another task for @bob" }),
    ];

    const result = await inboxSection({
      agentName: "bob",
      provider: workspace.contextProvider,
      inboxEntries: entries,
      currentMessageId: "msg-1",
    });

    expect(result).toBeTruthy();
    expect(result!).not.toContain("Current task for @bob");
    expect(result).toContain("#general");
    expect(result).toContain('@carol: "Another task for @bob"');
    expect(result).toContain("channel_read");
  });

  test("assemblePrompt joins sections with dividers", async () => {
    const workspace = await createWorkspace({
      name: "test",
      channels: ["general"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });

    await workspace.contextProvider.send({
      channel: "general",
      from: "bob",
      content: "Need @alice on this",
    });

    const result = await assemblePrompt([soulSection, inboxSection], {
      agentName: "alice",
      instructions: "Be helpful.",
      provider: workspace.contextProvider,
      inboxEntries: await workspace.contextProvider.inbox.peek("alice"),
    });

    expect(result).toContain("Be helpful.");
    expect(result).toContain("Pending Inbox");
    expect(result).toContain("---");
  });
});
