import { test, expect, describe } from "bun:test";
import { assemblePrompt, soulSection, inboxSection } from "../src/loop/prompt.tsx";
import { MemoryStorage } from "../src/context/storage.ts";
import { createHarness } from "../src/factory.ts";
import type { InboxEntry } from "../src/types.ts";
import { renderPromptDocument } from "../src/loop/prompt-ui.tsx";
import type { PromptSectionNode } from "../src/loop/prompt-ui.tsx";

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

function renderSectionResult(
  result: PromptSectionNode | PromptSectionNode[] | null,
): string | null {
  if (!result) return null;
  return renderPromptDocument(Array.isArray(result) ? result : [result]);
}

describe("Prompt assembly", () => {
  test("soulSection returns instructions", async () => {
    const harness = await createHarness({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });

    const result = await soulSection({
      agentName: "alice",
      instructions: "You are a helpful assistant.",
      provider: harness.contextProvider,
      inboxEntries: [],
    });

    const text = renderSectionResult(result);
    expect(text).toContain("[Instructions]");
    expect(text).toContain("You are a helpful assistant.");
  });

  test("soulSection returns null without instructions", async () => {
    const harness = await createHarness({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });

    const result = await soulSection({
      agentName: "alice",
      provider: harness.contextProvider,
      inboxEntries: [],
    });

    expect(result).toBeNull();
  });

  test("inboxSection shows grouped notification summaries", async () => {
    const harness = await createHarness({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });

    const result = await inboxSection({
      agentName: "bob",
      provider: harness.contextProvider,
      inboxEntries: [
        makeInboxEntry({ messageId: "msg-1", from: "alice", preview: "Hey @bob review this" }),
        makeInboxEntry({ messageId: "msg-2", from: "carol", preview: "Second heads-up for @bob" }),
        makeInboxEntry({ messageId: "msg-3", from: "dave", preview: "Third note for @bob" }),
      ],
    });

    const text = renderSectionResult(result);
    expect(text).toContain("[Pending Inbox (3)]");
    expect(text).toContain("#general (3 new)");
    expect(text).toContain('@carol: "Second heads-up for @bob"');
    expect(text).toContain('@dave: "Third note for @bob"');
    expect(text).toContain("+1 more");
    expect(text).toContain("channel_read");
  });

  test("inboxSection excludes the current message from pending summaries", async () => {
    const harness = await createHarness({
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
      provider: harness.contextProvider,
      inboxEntries: entries,
      currentMessageId: "msg-1",
    });

    const text = renderSectionResult(result);
    expect(text).toBeTruthy();
    expect(text!).not.toContain("Current task for @bob");
    expect(text).toContain("#general");
    expect(text).toContain('@carol: "Another task for @bob"');
    expect(text).toContain("channel_read");
  });

  test("assemblePrompt joins sections with dividers", async () => {
    const harness = await createHarness({
      name: "test",
      channels: ["general"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });

    await harness.contextProvider.send({
      channel: "general",
      from: "bob",
      content: "Need @alice on this",
    });

    const result = await assemblePrompt([soulSection, inboxSection], {
      agentName: "alice",
      instructions: "Be helpful.",
      provider: harness.contextProvider,
      inboxEntries: await harness.contextProvider.inbox.peek("alice"),
    });

    expect(result).toContain("Be helpful.");
    expect(result).toContain("[Pending Inbox");
    expect(result).toContain("---");
  });
});

describe("taskLedgerSection", () => {
  test("only renders for the lead role", async () => {
    const { taskLedgerSection } = await import("../src/context/mcp/prompts.tsx");
    const { InMemoryHarnessStateStore } = await import("../src/state/index.ts");
    const harness = await createHarness({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });
    const store = new InMemoryHarnessStateStore();
    await store.createTask({ harnessId: "test", title: "Ship it", goal: "g" });

    const leadResult = await taskLedgerSection({
      agentName: "lead",
      provider: harness.contextProvider,
      inboxEntries: [],
      stateStore: store,
      role: "lead",
      harnessName: "test",
    });
    const workerResult = await taskLedgerSection({
      agentName: "worker",
      provider: harness.contextProvider,
      inboxEntries: [],
      stateStore: store,
      role: "worker",
      harnessName: "test",
    });

    expect(leadResult).not.toBeNull();
    expect(workerResult).toBeNull();
  });

  test("is hidden when no active tasks exist", async () => {
    const { taskLedgerSection } = await import("../src/context/mcp/prompts.tsx");
    const { InMemoryHarnessStateStore } = await import("../src/state/index.ts");
    const harness = await createHarness({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });
    const store = new InMemoryHarnessStateStore();

    const result = await taskLedgerSection({
      agentName: "lead",
      provider: harness.contextProvider,
      inboxEntries: [],
      stateStore: store,
      role: "lead",
      harnessName: "test",
    });

    expect(result).toBeNull();
  });

  test("harnessPromptSection shows ledger workflow to the lead when state store is wired", async () => {
    const { harnessPromptSection } = await import("../src/context/mcp/prompts.tsx");
    const { InMemoryHarnessStateStore } = await import("../src/state/index.ts");
    const harness = await createHarness({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
      lead: "lead",
    });
    const store = new InMemoryHarnessStateStore();

    const leadResult = await harnessPromptSection({
      agentName: "lead",
      provider: harness.contextProvider,
      inboxEntries: [],
      stateStore: store,
      role: "lead",
      harnessName: "test",
    });
    const leadText = renderSectionResult(leadResult);
    expect(leadText).toContain("Task ledger workflow");
    expect(leadText).toContain("task_create");
    expect(leadText).toContain("task_dispatch");

    const workerResult = await harnessPromptSection({
      agentName: "worker",
      provider: harness.contextProvider,
      inboxEntries: [],
      stateStore: store,
      role: "worker",
      harnessName: "test",
    });
    const workerText = renderSectionResult(workerResult);
    expect(workerText).not.toContain("Task ledger workflow");
    expect(workerText).toContain("task-scoped worker");
    expect(workerText).toContain("handoff_create");
    expect(workerText).toContain("wake_update");
  });

  test("groups active tasks by status with counts in the header", async () => {
    const { taskLedgerSection } = await import("../src/context/mcp/prompts.tsx");
    const { InMemoryHarnessStateStore } = await import("../src/state/index.ts");
    const harness = await createHarness({
      name: "test",
      agents: [],
      storage: new MemoryStorage(),
    });
    const store = new InMemoryHarnessStateStore();
    await store.createTask({ harnessId: "test", title: "a", goal: "g" });
    await store.createTask({
      harnessId: "test",
      title: "b",
      goal: "g",
      status: "in_progress",
    });

    const result = await taskLedgerSection({
      agentName: "lead",
      provider: harness.contextProvider,
      inboxEntries: [],
      stateStore: store,
      role: "lead",
      harnessName: "test",
    });
    const text = renderSectionResult(result);

    expect(text).toContain("Task Ledger (2 active)");
    expect(text).toContain("draft (1)");
    expect(text).toContain("in_progress (1)");
    expect(text).toContain("a");
    expect(text).toContain("b");
  });
});
