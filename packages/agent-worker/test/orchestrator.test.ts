import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";
import type { Workspace } from "@agent-worker/workspace";
import { createOrchestrator, WorkspaceOrchestrator } from "../src/orchestrator.ts";

describe("WorkspaceOrchestrator pause/resume", () => {
  let workspace: Workspace;
  let orch: WorkspaceOrchestrator;
  let instructionCount: number;

  beforeEach(async () => {
    instructionCount = 0;
    workspace = await createWorkspace({
      name: "pause-test",
      channels: ["general"],
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    orch = createOrchestrator({
      name: "alice",
      provider: workspace.contextProvider,
      queue: workspace.instructionQueue,
      eventLog: workspace.eventLog,
      pollInterval: 50,
      onInstruction: async () => {
        instructionCount++;
      },
    });
  });

  afterEach(async () => {
    if (orch.isRunning) await orch.stop();
    await workspace.shutdown();
  });

  test("isPaused defaults to false", () => {
    expect(orch.isPaused).toBe(false);
  });

  test("pause sets isPaused to true", async () => {
    await orch.pause();
    expect(orch.isPaused).toBe(true);
  });

  test("resume sets isPaused to false", async () => {
    await orch.pause();
    await orch.resume();
    expect(orch.isPaused).toBe(false);
  });

  test("paused orchestrator skips tick (does not process instructions)", async () => {
    await orch.start();
    await orch.pause();

    // Enqueue an instruction — it should NOT be processed while paused
    await orch.enqueue("do something", "normal");
    await Bun.sleep(150); // wait several poll intervals

    expect(instructionCount).toBe(0);

    // Resume — instruction should now be processed
    await orch.resume();
    await Bun.sleep(150);

    expect(instructionCount).toBe(1);
  });

  test("pause logs system event", async () => {
    await orch.pause();

    const events = await workspace.contextProvider.timeline.read("alice");
    const pauseEvent = events.find(
      (e) => e.kind === "system" && e.content.includes("paused"),
    );
    expect(pauseEvent).toBeDefined();
  });

  test("resume logs system event", async () => {
    await orch.pause();
    await orch.resume();

    const events = await workspace.contextProvider.timeline.read("alice");
    const resumeEvent = events.find(
      (e) => e.kind === "system" && e.content.includes("resumed"),
    );
    expect(resumeEvent).toBeDefined();
  });

  test("failed instruction is retried and only acked after success", async () => {
    let attempts = 0;
    await orch.stop();
    orch = createOrchestrator({
      name: "alice",
      provider: workspace.contextProvider,
      queue: workspace.instructionQueue,
      eventLog: workspace.eventLog,
      pollInterval: 20,
      onInstruction: async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error("transient failure");
        }
      },
    });

    await workspace.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice please retry this",
    });

    await orch.start();
    await Bun.sleep(200);

    expect(attempts).toBe(2);
    expect(await workspace.contextProvider.inbox.peek("alice")).toHaveLength(0);
  });

  test("pause during instruction is not overwritten back to idle", async () => {
    await orch.stop();
    orch = createOrchestrator({
      name: "alice",
      provider: workspace.contextProvider,
      queue: workspace.instructionQueue,
      eventLog: workspace.eventLog,
      pollInterval: 20,
      onInstruction: async () => {
        await orch.pause();
        throw new Error("pause requested");
      },
    });

    await workspace.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice wait here",
    });

    await orch.start();
    await Bun.sleep(120);

    expect(orch.isPaused).toBe(true);
    expect((await workspace.contextProvider.status.get("alice"))?.status).toBe("paused");
    expect(await workspace.contextProvider.inbox.peek("alice")).toHaveLength(1);
  });

  test("start requeues seen inbox entries from a previous run", async () => {
    const storage = new MemoryStorage();
    const previousWorkspace = await createWorkspace({
      name: "recover-start",
      channels: ["general"],
      agents: ["alice"],
      storage,
    });

    await previousWorkspace.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice resume unfinished work",
    });
    const pending = await previousWorkspace.contextProvider.inbox.peek("alice");
    await previousWorkspace.contextProvider.inbox.markSeen("alice", pending[0]!.messageId);
    await previousWorkspace.shutdown();

    const recoveredWorkspace = await createWorkspace({
      name: "recover-start",
      channels: ["general"],
      agents: ["alice"],
      storage,
    });
    let processed = 0;
    const recoveredOrch = createOrchestrator({
      name: "alice",
      provider: recoveredWorkspace.contextProvider,
      queue: recoveredWorkspace.instructionQueue,
      eventLog: recoveredWorkspace.eventLog,
      pollInterval: 20,
      onInstruction: async () => {
        processed++;
      },
    });

    try {
      await recoveredOrch.start();
      await Bun.sleep(120);

      expect(processed).toBe(1);
      expect(await recoveredWorkspace.contextProvider.inbox.peek("alice")).toHaveLength(0);
    } finally {
      if (recoveredOrch.isRunning) await recoveredOrch.stop();
      await recoveredWorkspace.shutdown();
    }
  });
});
