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

  test("send posts message to channel", async () => {
    const msg = await workspace.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hello team!",
    });

    expect(msg.id).toBeTruthy();
    expect(msg.content).toBe("Hello team!");

    const messages = await workspace.contextProvider.channels.read("general");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe("Hello team!");
  });

  test("send rejects messages exceeding the length limit", async () => {
    const longContent = "x".repeat(2000);
    await expect(
      workspace.contextProvider.send({ channel: "general", from: "alice", content: longContent }),
    ).rejects.toThrow("Message too long");
  });

  test("message routing to inbox on @mention", async () => {
    // Alice sends a message mentioning bob
    await workspace.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hey @bob please review",
    });

    // Bob should have an inbox entry
    const bobInbox = await workspace.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("normal");
  });

  test("message not self-delivered", async () => {
    await workspace.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hey @alice talking to myself",
    });

    const aliceInbox = await workspace.contextProvider.inbox.peek("alice");
    expect(aliceInbox).toHaveLength(0);
  });

  test("DM routing with immediate priority", async () => {
    await workspace.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Private note",
      to: "bob",
    });

    const bobInbox = await workspace.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("immediate");
  });

  test("channel broadcast with background priority", async () => {
    // No @mentions, just a broadcast to the channel
    await workspace.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "General announcement",
    });

    const bobInbox = await workspace.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("background");
  });

  describe("on_demand agent routing", () => {
    let wsWithOnDemand: Workspace;

    beforeEach(async () => {
      wsWithOnDemand = await createWorkspace({
        name: "on-demand-test",
        agents: ["alice", "bot"],
        onDemandAgents: ["bot"],
        storage: new MemoryStorage(),
      });
    });

    test("broadcast does not reach on_demand agent", async () => {
      await wsWithOnDemand.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "Hello everyone",
      });

      const botInbox = await wsWithOnDemand.contextProvider.inbox.peek("bot");
      expect(botInbox).toHaveLength(0);
    });

    test("@mention wakes on_demand agent", async () => {
      await wsWithOnDemand.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "Hey @bot please help",
      });

      const botInbox = await wsWithOnDemand.contextProvider.inbox.peek("bot");
      expect(botInbox).toHaveLength(1);
      expect(botInbox[0]!.priority).toBe("normal");
    });

    test("DM reaches on_demand agent", async () => {
      await wsWithOnDemand.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "Private message",
        to: "bot",
      });

      const botInbox = await wsWithOnDemand.contextProvider.inbox.peek("bot");
      expect(botInbox).toHaveLength(1);
      expect(botInbox[0]!.priority).toBe("immediate");
    });

    test("non-on_demand agent still receives broadcasts", async () => {
      const ws = await createWorkspace({
        name: "mixed",
        agents: ["alice", "bob", "bot"],
        onDemandAgents: ["bot"],
        storage: new MemoryStorage(),
      });

      await ws.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "General announcement",
      });

      const bobInbox = await ws.contextProvider.inbox.peek("bob");
      expect(bobInbox).toHaveLength(1);

      const botInbox = await ws.contextProvider.inbox.peek("bot");
      expect(botInbox).toHaveLength(0);
    });
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

    await ws1.contextProvider.send({ channel: "general", from: "alice", content: "msg in pr-123" });
    await ws2.contextProvider.send({ channel: "general", from: "alice", content: "msg in pr-456" });

    const msgs1 = await ws1.contextProvider.channels.read("general");
    const msgs2 = await ws2.contextProvider.channels.read("general");

    expect(msgs1).toHaveLength(1);
    expect(msgs1[0]!.content).toBe("msg in pr-123");
    expect(msgs2).toHaveLength(1);
    expect(msgs2[0]!.content).toBe("msg in pr-456");
  });

  test("reuses persisted status and inbox state on restart", async () => {
    const storage = new MemoryStorage();
    const ws1 = await createWorkspace({
      name: "recoverable",
      agents: ["alice"],
      storage,
    });

    await ws1.contextProvider.status.set("alice", "paused", "waiting for quota");
    await ws1.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice please continue",
    });
    await ws1.contextProvider.inbox.markSeen("alice", (await ws1.contextProvider.inbox.peek("alice"))[0]!.messageId);
    await ws1.shutdown();

    const ws2 = await createWorkspace({
      name: "recoverable",
      agents: ["alice"],
      storage,
    });

    const aliceStatus = await ws2.contextProvider.status.get("alice");
    expect(aliceStatus?.status).toBe("paused");
    expect(aliceStatus?.currentTask).toBe("waiting for quota");

    await ws2.contextProvider.inbox.markRunStart("alice");
    const inbox = await ws2.contextProvider.inbox.peek("alice");
    expect(inbox).toHaveLength(1);
    expect(inbox[0]!.from).toBe("user");
  });

  test("snapshotState returns a unified workspace view", async () => {
    await workspace.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice inspect this workspace",
    });
    await workspace.contextProvider.status.set("alice", "running", "Inspecting state");
    await workspace.contextProvider.chronicle.append({
      author: "alice",
      category: "plan",
      content: "Collect current workspace state",
    });
    workspace.instructionQueue.enqueue({
      id: "instr-1",
      agentName: "alice",
      messageId: "msg-1",
      channel: "general",
      content: "Inspect current state",
      priority: "normal",
      enqueuedAt: new Date().toISOString(),
    });

    const snapshot = await workspace.snapshotState();

    expect(snapshot.name).toBe("test-workspace");
    expect(snapshot.channels).toContain("general");
    expect(snapshot.queuedInstructions).toHaveLength(1);
    expect(snapshot.chronicle).toHaveLength(1);
    expect(snapshot.agents).toHaveLength(2);
    const alice = snapshot.agents.find((agent) => agent.name === "alice");
    expect(alice?.status).toBe("running");
    expect(alice?.currentTask).toBe("Inspecting state");
    expect(alice?.inbox).toHaveLength(1);
    expect(alice?.recentActivity).toEqual([]);
  });

  test("snapshotState includes seen and deferred inbox entries without mutating them", async () => {
    await workspace.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice first task",
    });
    await workspace.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice second task",
    });

    const pending = await workspace.contextProvider.inbox.peek("alice");
    await workspace.contextProvider.inbox.markSeen("alice", pending[0]!.messageId);
    await workspace.contextProvider.inbox.defer(
      "alice",
      pending[1]!.messageId,
      new Date(Date.now() + 60_000).toISOString(),
    );

    const snapshot = await workspace.snapshotState();
    const alice = snapshot.agents.find((agent) => agent.name === "alice");

    expect(alice?.inbox.map((entry) => entry.state)).toEqual(["seen", "deferred"]);
    expect(await workspace.contextProvider.inbox.peek("alice")).toHaveLength(0);
  });
});
