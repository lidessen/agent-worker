import { test, expect, describe, beforeEach } from "bun:test";
import { createWorkspace } from "../src/factory.ts";
import { Workspace } from "../src/workspace.ts";
import { MemoryStorage } from "../src/context/storage.ts";

describe("Workspace", () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await createWorkspace({
      name: "test-workspace",
      channels: ["general", "design"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });
  });

  test("creates workspace with correct name", () => {
    expect(workspace.name).toBe("test-workspace");
  });

  test("has default channel", () => {
    expect(workspace.defaultChannel).toBe("general");
  });

  test("registers agents with idle status", async () => {
    const aliceStatus = await workspace.contextProvider.status.get("alice");
    expect(aliceStatus).not.toBeNull();
    expect(aliceStatus!.status).toBe("idle");
  });

  test("agents auto-join default channel", () => {
    const aliceChannels = workspace.getAgentChannels("alice");
    expect(aliceChannels.has("general")).toBe(true);
  });

  test("smartSend posts message to channel", async () => {
    const msg = await workspace.contextProvider.smartSend("general", "alice", "Hello team!");

    expect(msg.id).toBeTruthy();
    expect(msg.content).toBe("Hello team!");

    const messages = await workspace.contextProvider.channels.read("general");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe("Hello team!");
  });

  test("smartSend rejects messages exceeding the length limit", async () => {
    const longContent = "x".repeat(2000);
    await expect(
      workspace.contextProvider.smartSend("general", "alice", longContent),
    ).rejects.toThrow("Message too long");
  });

  test("message routing to inbox on @mention", async () => {
    // Alice sends a message mentioning bob
    await workspace.contextProvider.smartSend("general", "alice", "Hey @bob please review");

    // Bob should have an inbox entry
    const bobInbox = await workspace.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("normal");
  });

  test("message not self-delivered", async () => {
    await workspace.contextProvider.smartSend("general", "alice", "Hey @alice talking to myself");

    const aliceInbox = await workspace.contextProvider.inbox.peek("alice");
    expect(aliceInbox).toHaveLength(0);
  });

  test("DM routing with immediate priority", async () => {
    await workspace.contextProvider.smartSend("general", "alice", "Private note", {
      to: "bob",
    });

    const bobInbox = await workspace.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("immediate");
  });

  test("channel broadcast with background priority", async () => {
    // No @mentions, just a broadcast to the channel
    await workspace.contextProvider.smartSend("general", "alice", "General announcement");

    const bobInbox = await workspace.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("background");
  });

  test("shutdown completes without error", async () => {
    await workspace.shutdown();
  });

  test("event log records system events", async () => {
    await workspace.eventLog.log("alice", "system", "Test event");

    const events = await workspace.contextProvider.timeline.read("alice");
    expect(events).toHaveLength(1);
    expect(events[0]!.content).toBe("Test event");
    expect(events[0]!.kind).toBe("system");
  });

  test("event log rejects message kind", async () => {
    expect(workspace.eventLog.log("alice", "message", "Bad")).rejects.toThrow();
  });

  test("instance tag isolation", async () => {
    const ws1 = await createWorkspace({
      name: "test",
      tag: "pr-123",
      agents: ["alice"],
      storage: new MemoryStorage(),
    });
    const ws2 = await createWorkspace({
      name: "test",
      tag: "pr-456",
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    await ws1.contextProvider.smartSend("general", "alice", "msg in pr-123");
    await ws2.contextProvider.smartSend("general", "alice", "msg in pr-456");

    const msgs1 = await ws1.contextProvider.channels.read("general");
    const msgs2 = await ws2.contextProvider.channels.read("general");

    expect(msgs1).toHaveLength(1);
    expect(msgs1[0]!.content).toBe("msg in pr-123");
    expect(msgs2).toHaveLength(1);
    expect(msgs2[0]!.content).toBe("msg in pr-456");
  });
});
