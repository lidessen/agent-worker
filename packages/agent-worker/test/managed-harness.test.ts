import { describe, expect, test } from "bun:test";
import { createHarness, MemoryStorage } from "@agent-worker/harness";
import type { ResolvedHarness } from "@agent-worker/harness";
import { ManagedHarness } from "../src/managed-harness.ts";
import type { HarnessOrchestrator } from "../src/orchestrator.ts";

describe("ManagedHarness", () => {
  test("deferred inbox entries keep task harnesss running", async () => {
    const harness = await createHarness({
      name: "task-deferred",
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    await harness.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice finish this later",
    });

    const pending = await harness.contextProvider.inbox.peek("alice");
    await harness.contextProvider.inbox.defer(
      "alice",
      pending[0]!.messageId,
      new Date(Date.now() + 60_000).toISOString(),
    );

    const handle = new ManagedHarness({
      harness,
      resolved: {
        def: { name: "task-deferred", agents: { alice: { runtime: "mock" } } },
        agents: [{ name: "alice", instructions: "", runtime: "mock" }],
      } as unknown as ResolvedHarness,
      loops: [{ name: "alice", isFailed: false } as HarnessOrchestrator],
      mode: "task",
    });

    try {
      expect(await handle.checkCompletion()).toBe("running");
    } finally {
      await harness.shutdown();
    }
  });
});
