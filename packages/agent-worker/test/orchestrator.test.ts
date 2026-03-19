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
});
