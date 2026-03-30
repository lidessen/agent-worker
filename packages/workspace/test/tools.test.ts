import { test, expect, describe, beforeEach } from "bun:test";
import { createWorkspace, createAgentTools } from "../src/factory.ts";
import { Workspace } from "../src/workspace.ts";
import { MemoryStorage } from "../src/context/storage.ts";

describe("Workspace Tools", () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await createWorkspace({
      name: "test",
      channels: ["general", "design"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });
  });

  describe("Channel tools", () => {
    test("channel_send posts message", async () => {
      const { tools } = createAgentTools("alice", workspace);
      const result = await tools.channel_send!({
        channel: "general",
        content: "Hello!",
      });

      expect(result).toContain("Sent message");

      const messages = await workspace.contextProvider.channels.read("general");
      expect(messages).toHaveLength(1);
    });

    test("channel_read returns messages", async () => {
      await workspace.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "test msg",
      });

      const { tools } = createAgentTools("bob", workspace);
      const result = await tools.channel_read!({ channel: "general" });
      expect(result).toContain("test msg");
    });

    test("channel_list shows joined channels", async () => {
      const { tools } = createAgentTools("alice", workspace);
      const result = await tools.channel_list!({});
      expect(result).toContain("general");
    });

    test("channel_join adds channel", async () => {
      const { tools } = createAgentTools("alice", workspace);
      await tools.channel_join!({ channel: "design" });

      const result = await tools.channel_list!({});
      expect(result).toContain("design");
    });

    test("channel_send warns when channel has new messages since last read", async () => {
      const aliceTools = createAgentTools("alice", workspace).tools;
      const bobTools = createAgentTools("bob", workspace).tools;

      // Alice reads the channel (sets cursor)
      await aliceTools.channel_read!({ channel: "general" });

      // Bob posts a message after Alice's read
      await bobTools.channel_send!({ channel: "general", content: "Hey everyone!", force: true });

      // Alice tries to send — should be warned about Bob's message
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "My response",
      });
      expect(result).toContain("new message");
      expect(result).toContain("@bob");
      expect(result).toContain("Hey everyone!");

      // Verify message was NOT sent (guard blocked it)
      const messages = await workspace.contextProvider.channels.read("general");
      const aliceMessages = messages.filter((m) => m.from === "alice");
      expect(aliceMessages).toHaveLength(0);
    });

    test("channel_send with force=true bypasses guard", async () => {
      const aliceTools = createAgentTools("alice", workspace).tools;
      const bobTools = createAgentTools("bob", workspace).tools;

      // Alice reads, Bob posts
      await aliceTools.channel_read!({ channel: "general" });
      await bobTools.channel_send!({ channel: "general", content: "Hey!", force: true });

      // Alice sends with force=true — should succeed
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "My forced response",
        force: true,
      });
      expect(result).toContain("Sent message");
    });

    test("channel_send ignores own messages in guard check", async () => {
      const aliceTools = createAgentTools("alice", workspace).tools;

      // Alice reads, then sends (setting cursor)
      await aliceTools.channel_read!({ channel: "general" });
      const result1 = await aliceTools.channel_send!({
        channel: "general",
        content: "First message",
      });
      expect(result1).toContain("Sent message");

      // Alice sends again — her own previous message shouldn't trigger the guard
      const result2 = await aliceTools.channel_send!({
        channel: "general",
        content: "Second message",
      });
      expect(result2).toContain("Sent message");
    });

    test("channel_send without prior read sends immediately (no cursor)", async () => {
      // Post some messages first
      await workspace.contextProvider.send({
        channel: "general",
        from: "bob",
        content: "existing message",
      });

      const aliceTools = createAgentTools("alice", workspace).tools;
      // Alice never read the channel — no cursor, so send goes through
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hello!",
      });
      expect(result).toContain("Sent message");
    });

    test("channel_send blocks send and warns when mentioned agent is not in the channel", async () => {
      // Register coder in #design only (not #general)
      await workspace.registerAgent("coder", ["design"]);

      const aliceTools = createAgentTools("alice", workspace).tools;
      // Alice mentions @coder in #general — should be blocked with a warning
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hey @coder, can you review this?",
      });

      // Message was NOT sent
      expect(result).not.toContain("Sent message");
      const messages = await workspace.contextProvider.channels.read("general");
      expect(messages.some((m) => m.from === "alice")).toBe(false);

      // Warning includes agent name, channel info, and force hint
      expect(result).toContain("⚠");
      expect(result).toContain("@coder");
      expect(result).toContain("not subscribed to #general");
      expect(result).toContain("force=true");
      // Lists the channels coder is actually in
      expect(result).toContain("#design");
    });

    test("channel_send with force=true bypasses mention guard and sends", async () => {
      await workspace.registerAgent("coder", ["design"]);

      const aliceTools = createAgentTools("alice", workspace).tools;
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hey @coder, can you review this?",
        force: true,
      });

      // Message was sent
      expect(result).toContain("Sent message");
      const messages = await workspace.contextProvider.channels.read("general");
      expect(messages.some((m) => m.from === "alice")).toBe(true);
    });

    test("channel_send does not warn when mentioned agent is in the channel", async () => {
      const aliceTools = createAgentTools("alice", workspace).tools;
      // bob is in #general by default
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hey @bob!",
      });

      expect(result).toContain("Sent message");
      expect(result).not.toContain("⚠");
    });

    test("channel_send does not warn when on_demand agent is in the target channel", async () => {
      // on_demand agent registered with explicit channels including #design
      const wsWithOnDemand = await createWorkspace({
        name: "on-demand-test",
        channels: ["general", "design"],
        agents: ["alice", "bot"],
        agentChannels: { bot: ["design"] },
        onDemandAgents: ["bot"],
        storage: new MemoryStorage(),
      });

      const aliceTools = createAgentTools("alice", wsWithOnDemand).tools;
      // Alice sends @bot in #design — bot is registered there, guard should not fire
      const result = await aliceTools.channel_send!({
        channel: "design",
        content: "Hey @bot, please review",
      });

      expect(result).toContain("Sent message");
      expect(result).not.toContain("⚠");
    });

    test("channel_send warns when on_demand agent is not in the target channel", async () => {
      // on_demand agent registered with only #design
      const wsWithOnDemand = await createWorkspace({
        name: "on-demand-test2",
        channels: ["general", "design"],
        agents: ["alice", "bot"],
        agentChannels: { bot: ["design"] },
        onDemandAgents: ["bot"],
        storage: new MemoryStorage(),
      });

      const aliceTools = createAgentTools("alice", wsWithOnDemand).tools;
      // Alice sends @bot in #general — bot is only in #design, guard should fire
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hey @bot, please review",
      });

      expect(result).not.toContain("Sent message");
      expect(result).toContain("⚠");
      expect(result).toContain("@bot");
      expect(result).toContain("not subscribed to #general");
      expect(result).toContain("#design");
    });

    test("channel_send does not warn for unknown @mentions (non-agent names)", async () => {
      const aliceTools = createAgentTools("alice", workspace).tools;
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "See @everyone for details",
      });

      expect(result).toContain("Sent message");
      expect(result).not.toContain("⚠");
    });

    test("channel_read updates cursor so subsequent send sees no new messages", async () => {
      const aliceTools = createAgentTools("alice", workspace).tools;
      const bobTools = createAgentTools("bob", workspace).tools;

      // Bob posts, Alice reads (cursor moves to Bob's message)
      await bobTools.channel_send!({ channel: "general", content: "Hey!", force: true });
      await aliceTools.channel_read!({ channel: "general" });

      // Alice sends — no new messages since read, should succeed
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Reply",
      });
      expect(result).toContain("Sent message");
    });
  });

  describe("Inbox tools", () => {
    test("my_inbox shows pending messages", async () => {
      await workspace.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "Hey @bob",
      });

      const { tools } = createAgentTools("bob", workspace);
      const result = await tools.my_inbox!({});
      expect(result).toContain("Hey @bob");
    });

    test("my_inbox_ack removes entry", async () => {
      const msg = await workspace.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "Hey @bob",
      });

      const { tools } = createAgentTools("bob", workspace);
      await tools.my_inbox_ack!({ message_id: msg.id });

      const result = await tools.my_inbox!({});
      expect(result).toContain("empty");
    });
  });

  describe("Team tools", () => {
    test("team_members lists all agents", async () => {
      const { tools } = createAgentTools("alice", workspace);
      const result = await tools.team_members!({});
      expect(result).toContain("@alice");
      expect(result).toContain("@bob");
    });

    test("team_doc lifecycle", async () => {
      const { tools } = createAgentTools("alice", workspace);

      await tools.team_doc_create!({ name: "spec.md", content: "# Spec\n" });

      const content = await tools.team_doc_read!({ name: "spec.md" });
      expect(content).toBe("# Spec\n");

      await tools.team_doc_append!({ name: "spec.md", content: "## Details\n" });

      const updated = await tools.team_doc_read!({ name: "spec.md" });
      expect(updated).toBe("# Spec\n## Details\n");

      const list = await tools.team_doc_list!({});
      expect(list).toContain("spec.md");
    });
  });

  describe("Resource tools", () => {
    test("resource create and read", async () => {
      const { tools } = createAgentTools("alice", workspace);

      const createResult = await tools.resource_create!({
        content: "large content here",
      });
      expect(createResult).toContain("res_");

      // Extract resource ID from result
      const id = createResult.match(/res_\w+/)![0];

      const readResult = await tools.resource_read!({ id });
      expect(readResult).toBe("large content here");
    });

    test("resource_read returns not found", async () => {
      const { tools } = createAgentTools("alice", workspace);
      const result = await tools.resource_read!({ id: "res_nonexistent" });
      expect(result).toContain("not found");
    });
  });
});
