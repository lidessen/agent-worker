import { test, expect, describe } from "bun:test";
import { assemblePrompt, soulSection, inboxSection } from "../src/loop/prompt.ts";
import { DEFAULT_SECTIONS } from "../src/index.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import { createWorkspace } from "../src/factory.ts";

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

  test("inboxSection shows pending messages", async () => {
    const workspace = await createWorkspace({
      name: "test",
      channels: ["general"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });

    await workspace.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hey @bob review this",
    });

    const entries = await workspace.contextProvider.inbox.peek("bob");

    const result = await inboxSection({
      agentName: "bob",
      provider: workspace.contextProvider,
      inboxEntries: entries,
    });

    expect(result).toContain("#general");
    expect(result).toContain("from @alice");
    expect(result).toContain("channel_read");
  });

  test("assemblePrompt joins sections with dividers", async () => {
    const workspace = await createWorkspace({
      name: "test",
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    const result = await assemblePrompt(DEFAULT_SECTIONS, {
      agentName: "alice",
      instructions: "Be helpful.",
      provider: workspace.contextProvider,
      inboxEntries: [],
      currentInstruction: "Do something",
    });

    expect(result).toContain("Be helpful.");
    expect(result).toContain("Do something");
    expect(result).toContain("---");
  });
});
