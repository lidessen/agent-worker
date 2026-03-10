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
      const tools = createAgentTools("alice", workspace);
      const result = await tools.channel_send({
        channel: "general",
        content: "Hello!",
      });

      expect(result).toContain("Sent message");

      const messages = await workspace.contextProvider.channels.read("general");
      expect(messages).toHaveLength(1);
    });

    test("channel_read returns messages", async () => {
      await workspace.contextProvider.smartSend("general", "alice", "test msg");

      const tools = createAgentTools("bob", workspace);
      const result = await tools.channel_read({ channel: "general" });
      expect(result).toContain("test msg");
    });

    test("channel_list shows joined channels", async () => {
      const tools = createAgentTools("alice", workspace);
      const result = await tools.channel_list({});
      expect(result).toContain("general");
    });

    test("channel_join adds channel", async () => {
      const tools = createAgentTools("alice", workspace);
      await tools.channel_join({ channel: "design" });

      const result = await tools.channel_list({});
      expect(result).toContain("design");
    });
  });

  describe("Inbox tools", () => {
    test("my_inbox shows pending messages", async () => {
      await workspace.contextProvider.smartSend("general", "alice", "Hey @bob");

      const tools = createAgentTools("bob", workspace);
      const result = await tools.my_inbox({});
      expect(result).toContain("Hey @bob");
    });

    test("my_inbox_ack removes entry", async () => {
      const msg = await workspace.contextProvider.smartSend("general", "alice", "Hey @bob");

      const tools = createAgentTools("bob", workspace);
      await tools.my_inbox_ack({ message_id: msg.id });

      const result = await tools.my_inbox({});
      expect(result).toContain("empty");
    });
  });

  describe("Team tools", () => {
    test("team_members lists all agents", async () => {
      const tools = createAgentTools("alice", workspace);
      const result = await tools.team_members({});
      expect(result).toContain("@alice");
      expect(result).toContain("@bob");
    });

    test("team_doc lifecycle", async () => {
      const tools = createAgentTools("alice", workspace);

      await tools.team_doc_create({ name: "spec.md", content: "# Spec\n" });

      const content = await tools.team_doc_read({ name: "spec.md" });
      expect(content).toBe("# Spec\n");

      await tools.team_doc_append({ name: "spec.md", content: "## Details\n" });

      const updated = await tools.team_doc_read({ name: "spec.md" });
      expect(updated).toBe("# Spec\n## Details\n");

      const list = await tools.team_doc_list({});
      expect(list).toContain("spec.md");
    });
  });

  describe("Resource tools", () => {
    test("resource create and read", async () => {
      const tools = createAgentTools("alice", workspace);

      const createResult = await tools.resource_create({
        content: "large content here",
      });
      expect(createResult).toContain("res_");

      // Extract resource ID from result
      const id = createResult.match(/res_\w+/)![0];

      const readResult = await tools.resource_read({ id });
      expect(readResult).toBe("large content here");
    });

    test("resource_read returns not found", async () => {
      const tools = createAgentTools("alice", workspace);
      const result = await tools.resource_read({ id: "res_nonexistent" });
      expect(result).toContain("not found");
    });
  });
});
