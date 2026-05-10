import { test, expect, describe, beforeEach } from "bun:test";
import { createHarness, createAgentTools } from "../src/factory.ts";
import { Harness } from "../src/harness.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import { coordinationRuntime } from "@agent-worker/harness-coordination";

describe("Harness Tools", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness({
      name: "test",
      channels: ["general", "design"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });
  });

  describe("Channel tools", () => {
    test("channel_send posts message", async () => {
      const { tools } = createAgentTools("alice", harness);
      const result = await tools.channel_send!({
        channel: "general",
        content: "Hello!",
      });

      expect(result).toContain("Sent message");

      const messages = await harness.contextProvider.channels.read("general");
      expect(messages).toHaveLength(1);
    });

    test("channel_read returns messages", async () => {
      await harness.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "test msg",
      });

      const { tools } = createAgentTools("bob", harness);
      const result = await tools.channel_read!({ channel: "general" });
      expect(result).toContain("test msg");
    });

    test("channel_list shows joined channels", async () => {
      const { tools } = createAgentTools("alice", harness);
      const result = await tools.channel_list!({});
      expect(result).toContain("general");
    });

    test("channel_join adds channel", async () => {
      const { tools } = createAgentTools("alice", harness);
      await tools.channel_join!({ channel: "design" });

      const result = await tools.channel_list!({});
      expect(result).toContain("design");
    });

    test("channel_send warns when channel has new messages since last read", async () => {
      const aliceTools = createAgentTools("alice", harness).tools;
      const bobTools = createAgentTools("bob", harness).tools;

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
      const messages = await harness.contextProvider.channels.read("general");
      const aliceMessages = messages.filter((m) => m.from === "alice");
      expect(aliceMessages).toHaveLength(0);
    });

    test("channel_send with force=true bypasses guard", async () => {
      const aliceTools = createAgentTools("alice", harness).tools;
      const bobTools = createAgentTools("bob", harness).tools;

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
      const aliceTools = createAgentTools("alice", harness).tools;

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
      await harness.contextProvider.send({
        channel: "general",
        from: "bob",
        content: "existing message",
      });

      const aliceTools = createAgentTools("alice", harness).tools;
      // Alice never read the channel — no cursor, so send goes through
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hello!",
      });
      expect(result).toContain("Sent message");
    });

    test("channel_send blocks send and warns when mentioned agent is not in the channel", async () => {
      // Register coder in #design only (not #general)
      await coordinationRuntime(harness).registerAgent("coder", ["design"]);

      const aliceTools = createAgentTools("alice", harness).tools;
      // Alice mentions @coder in #general — should be blocked with a warning
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hey @coder, can you review this?",
      });

      // Message was NOT sent
      expect(result).not.toContain("Sent message");
      const messages = await harness.contextProvider.channels.read("general");
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
      await coordinationRuntime(harness).registerAgent("coder", ["design"]);

      const aliceTools = createAgentTools("alice", harness).tools;
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hey @coder, can you review this?",
        force: true,
      });

      // Message was sent
      expect(result).toContain("Sent message");
      const messages = await harness.contextProvider.channels.read("general");
      expect(messages.some((m) => m.from === "alice")).toBe(true);
    });

    test("channel_send does not warn when mentioned agent is in the channel", async () => {
      const aliceTools = createAgentTools("alice", harness).tools;
      // bob is in #general by default
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "Hey @bob!",
      });

      expect(result).toContain("Sent message");
      expect(result).not.toContain("⚠");
    });

    test("channel_send does not warn for unknown @mentions (non-agent names)", async () => {
      const aliceTools = createAgentTools("alice", harness).tools;
      const result = await aliceTools.channel_send!({
        channel: "general",
        content: "See @everyone for details",
      });

      expect(result).toContain("Sent message");
      expect(result).not.toContain("⚠");
    });

    test("channel_read updates cursor so subsequent send sees no new messages", async () => {
      const aliceTools = createAgentTools("alice", harness).tools;
      const bobTools = createAgentTools("bob", harness).tools;

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
    test("my_inbox shows pending notifications", async () => {
      await harness.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "Hey @bob",
      });

      const { tools } = createAgentTools("bob", harness);
      const result = await tools.my_inbox!({});
      expect(result).toContain("#general");
      expect(result).toContain("from:@alice");
      expect(result).toContain("channel_read");
    });

    test("my_inbox_ack removes entry", async () => {
      const msg = await harness.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "Hey @bob",
      });

      const { tools } = createAgentTools("bob", harness);
      await tools.my_inbox_ack!({ message_id: msg.id });

      const result = await tools.my_inbox!({});
      expect(result).toContain("empty");
    });
  });

  describe("Team tools", () => {
    test("team_members lists all agents", async () => {
      const { tools } = createAgentTools("alice", harness);
      const result = await tools.team_members!({});
      expect(result).toContain("@alice");
      expect(result).toContain("@bob");
    });

    test("team_doc lifecycle", async () => {
      const { tools } = createAgentTools("alice", harness);

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
      const { tools } = createAgentTools("alice", harness);

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
      const { tools } = createAgentTools("alice", harness);
      const result = await tools.resource_read!({ id: "res_nonexistent" });
      expect(result).toContain("not found");
    });
  });
});
