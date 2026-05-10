import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { createHarness } from "../src/factory.ts";
import { Harness } from "../src/harness.ts";
import { MemoryStorage } from "../src/context/storage.ts";

describe("Harness", () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await createHarness({
      name: "test-harness",
      channels: ["general", "design"],
      agents: ["alice", "bob"],
      storage: new MemoryStorage(),
    });
  });

  test("creates harness with correct name", () => {
    expect(harness.name).toBe("test-harness");
  });

  test("has default channel", () => {
    expect(harness.defaultChannel).toBe("general");
  });

  test("registers agents with idle status", async () => {
    const aliceStatus = await harness.contextProvider.status.get("alice");
    expect(aliceStatus).not.toBeNull();
    expect(aliceStatus!.status).toBe("idle");
  });

  test("agents auto-join default channel", () => {
    const aliceChannels = harness.getAgentChannels("alice");
    expect(aliceChannels.has("general")).toBe(true);
  });

  test("send posts message to channel", async () => {
    const msg = await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hello team!",
    });

    expect(msg.id).toBeTruthy();
    expect(msg.content).toBe("Hello team!");

    const messages = await harness.contextProvider.channels.read("general");
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content).toBe("Hello team!");
  });

  test("send rejects messages exceeding the length limit", async () => {
    const longContent = "x".repeat(2000);
    await expect(
      harness.contextProvider.send({ channel: "general", from: "alice", content: longContent }),
    ).rejects.toThrow("Message too long");
  });

  test("message routing to inbox on @mention", async () => {
    // Alice sends a message mentioning bob
    await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hey @bob please review",
    });

    // Bob should have an inbox entry
    const bobInbox = await harness.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("normal");
  });

  test("message not self-delivered", async () => {
    await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Hey @alice talking to myself",
    });

    const aliceInbox = await harness.contextProvider.inbox.peek("alice");
    expect(aliceInbox).toHaveLength(0);
  });

  test("DM routing with immediate priority", async () => {
    await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "Private note",
      to: "bob",
    });

    const bobInbox = await harness.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("immediate");
  });

  test("channel broadcast with background priority", async () => {
    // No @mentions, just a broadcast to the channel
    await harness.contextProvider.send({
      channel: "general",
      from: "alice",
      content: "General announcement",
    });

    const bobInbox = await harness.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("background");
  });

  test("body references do not wake non-addressed agents", async () => {
    // Regression for the maintainer/implementer race: leading @bob
    // addresses bob, but the in-body @alice reference should not
    // enqueue an inbox entry for alice (she can still see it via
    // channel_read).
    await harness.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@bob please dispatch task_xxx to @alice and verify on completion",
    });

    const bobInbox = await harness.contextProvider.inbox.peek("bob");
    expect(bobInbox).toHaveLength(1);
    expect(bobInbox[0]!.priority).toBe("normal");

    const aliceInbox = await harness.contextProvider.inbox.peek("alice");
    expect(aliceInbox).toHaveLength(0);
  });

  test("multiple leading mentions all wake", async () => {
    await harness.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice @bob joint review please",
    });
    // Routing runs from an async listener on channelStore; give it a
    // microtask to drain before asserting.
    await new Promise((r) => setTimeout(r, 10));

    expect(await harness.contextProvider.inbox.peek("alice")).toHaveLength(1);
    expect(await harness.contextProvider.inbox.peek("bob")).toHaveLength(1);
  });

  describe("on_demand agent routing", () => {
    let wsWithOnDemand: Harness;

    beforeEach(async () => {
      wsWithOnDemand = await createHarness({
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
      const ws = await createHarness({
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
    await harness.shutdown();
  });

  test("event log records system events", async () => {
    await harness.eventLog.log("alice", "system", "Test event");

    const events = await harness.contextProvider.timeline.read("alice");
    expect(events).toHaveLength(1);
    expect(events[0]!.content).toBe("Test event");
    expect(events[0]!.kind).toBe("system");
  });

  test("event log rejects message kind", async () => {
    expect(harness.eventLog.log("alice", "message", "Bad")).rejects.toThrow();
  });

  test("instance tag isolation", async () => {
    const ws1 = await createHarness({
      name: "test",
      tag: "pr-123",
      agents: ["alice"],
      storage: new MemoryStorage(),
    });
    const ws2 = await createHarness({
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

  describe("orphan attempt recovery on restart", () => {
    let storageDir: string;

    beforeEach(() => {
      storageDir = mkdtempSync(join(tmpdir(), "aw-orphan-recovery-"));
    });

    afterEach(() => {
      try {
        rmSync(storageDir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    });

    test("marks running attempts as failed and clears the task's active pointer", async () => {
      // Round 1: create a harness with a file-backed state store,
      // create a running attempt, then "crash" (drop the reference).
      const ws1 = await createHarness({
        name: "recoverable",
        agents: ["alice"],
        storageDir,
      });

      const task = await ws1.stateStore.createTask({
        harnessId: ws1.name,
        title: "t",
        goal: "g",
        status: "in_progress",
      });
      const attempt = await ws1.stateStore.createWake({
        taskId: task.id,
        agentName: "alice",
        role: "worker",
      });
      await ws1.stateStore.updateTask(task.id, { activeWakeId: attempt.id });

      // Sanity check: still "running" before restart.
      const before = await ws1.stateStore.getWake(attempt.id);
      expect(before?.status).toBe("running");

      await ws1.shutdown();

      // Round 2: new harness pointed at the same storageDir. The
      // file-backed store replays tasks.jsonl + attempts.jsonl, and
      // init() now runs recoverOrphanedAttempts which should mark our
      // stale attempt as failed.
      const ws2 = await createHarness({
        name: "recoverable",
        agents: ["alice"],
        storageDir,
      });

      const recoveredAttempt = await ws2.stateStore.getWake(attempt.id);
      expect(recoveredAttempt?.status).toBe("failed");
      expect(recoveredAttempt?.endedAt).toBeGreaterThan(0);
      expect(recoveredAttempt?.resultSummary).toContain("orphaned");

      const recoveredTask = await ws2.stateStore.getTask(task.id);
      expect(recoveredTask?.activeWakeId).toBeUndefined();

      // A system-authored aborted handoff should have been created so
      // the timeline shows why the attempt ended.
      const handoffs = await ws2.stateStore.listHandoffs(task.id);
      expect(handoffs).toHaveLength(1);
      expect(handoffs[0]?.kind).toBe("aborted");
      expect(handoffs[0]?.createdBy).toBe("system");
      expect(handoffs[0]?.closingWakeId).toBe(attempt.id);

      // Chronicle should have a "recovery" category entry.
      const chronicle = await ws2.contextProvider.chronicle.read({ category: "recovery" });
      expect(chronicle.length).toBeGreaterThanOrEqual(1);
      expect(chronicle[0]?.content).toContain(attempt.id);

      await ws2.shutdown();
    });

    test("leaves already-terminal attempts alone", async () => {
      const ws1 = await createHarness({
        name: "terminal-ok",
        agents: ["alice"],
        storageDir,
      });

      const task = await ws1.stateStore.createTask({
        harnessId: ws1.name,
        title: "t",
        goal: "g",
      });
      const attempt = await ws1.stateStore.createWake({
        taskId: task.id,
        agentName: "alice",
        role: "worker",
      });
      // Transition to a terminal state before restart.
      await ws1.stateStore.updateWake(attempt.id, {
        status: "completed",
        endedAt: Date.now(),
        resultSummary: "done",
      });
      await ws1.shutdown();

      const ws2 = await createHarness({
        name: "terminal-ok",
        agents: ["alice"],
        storageDir,
      });

      const recovered = await ws2.stateStore.getWake(attempt.id);
      expect(recovered?.status).toBe("completed");
      // No aborted handoff was created — recovery skipped this attempt.
      const handoffs = await ws2.stateStore.listHandoffs(task.id);
      expect(handoffs).toHaveLength(0);

      await ws2.shutdown();
    });

    test("recovers multiple orphans in a single harness", async () => {
      const ws1 = await createHarness({
        name: "multi",
        agents: ["alice"],
        storageDir,
      });

      const taskA = await ws1.stateStore.createTask({
        harnessId: ws1.name,
        title: "a",
        goal: "g",
      });
      const taskB = await ws1.stateStore.createTask({
        harnessId: ws1.name,
        title: "b",
        goal: "g",
      });
      const attemptA = await ws1.stateStore.createWake({
        taskId: taskA.id,
        agentName: "alice",
        role: "worker",
      });
      const attemptB = await ws1.stateStore.createWake({
        taskId: taskB.id,
        agentName: "alice",
        role: "worker",
      });
      await ws1.stateStore.updateTask(taskA.id, { activeWakeId: attemptA.id });
      await ws1.stateStore.updateTask(taskB.id, { activeWakeId: attemptB.id });
      await ws1.shutdown();

      const ws2 = await createHarness({
        name: "multi",
        agents: ["alice"],
        storageDir,
      });

      const recoveredA = await ws2.stateStore.getWake(attemptA.id);
      const recoveredB = await ws2.stateStore.getWake(attemptB.id);
      expect(recoveredA?.status).toBe("failed");
      expect(recoveredB?.status).toBe("failed");

      const chronicle = await ws2.contextProvider.chronicle.read({ category: "recovery" });
      expect(chronicle).toHaveLength(1);
      // Single entry summarising both recoveries rather than one per Wake.
      expect(chronicle[0]?.content).toContain("2 orphaned Wake");
      expect(chronicle[0]?.content).toContain(attemptA.id);
      expect(chronicle[0]?.content).toContain(attemptB.id);

      await ws2.shutdown();
    });
  });

  test("reuses persisted status and inbox state on restart", async () => {
    const storage = new MemoryStorage();
    const ws1 = await createHarness({
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
    await ws1.contextProvider.inbox.markSeen(
      "alice",
      (await ws1.contextProvider.inbox.peek("alice"))[0]!.messageId,
    );
    await ws1.shutdown();

    const ws2 = await createHarness({
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

  test("snapshotState returns a unified harness view", async () => {
    await harness.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice inspect this harness",
    });
    await harness.contextProvider.status.set("alice", "running", "Inspecting state");
    await harness.contextProvider.chronicle.append({
      author: "alice",
      category: "plan",
      content: "Collect current harness state",
    });
    harness.instructionQueue.enqueue({
      id: "instr-1",
      agentName: "alice",
      messageId: "msg-1",
      channel: "general",
      content: "Inspect current state",
      priority: "normal",
      enqueuedAt: new Date().toISOString(),
    });

    const snapshot = await harness.snapshotState();

    expect(snapshot.name).toBe("test-harness");
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
    await harness.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice first task",
    });
    await harness.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice second task",
    });

    const pending = await harness.contextProvider.inbox.peek("alice");
    await harness.contextProvider.inbox.markSeen("alice", pending[0]!.messageId);
    await harness.contextProvider.inbox.defer(
      "alice",
      pending[1]!.messageId,
      new Date(Date.now() + 60_000).toISOString(),
    );

    const snapshot = await harness.snapshotState();
    const alice = snapshot.agents.find((agent) => agent.name === "alice");

    expect(alice?.inbox.map((entry) => entry.state)).toEqual(["seen", "deferred"]);
    expect(await harness.contextProvider.inbox.peek("alice")).toHaveLength(0);
  });
});
