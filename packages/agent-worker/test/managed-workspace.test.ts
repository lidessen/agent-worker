import { describe, expect, test } from "bun:test";
import { createWorkspace, MemoryStorage } from "@agent-worker/workspace";
import type { ResolvedWorkspace } from "@agent-worker/workspace";
import { ManagedWorkspace } from "../src/managed-workspace.ts";
import type { WorkspaceOrchestrator } from "../src/orchestrator.ts";

describe("ManagedWorkspace", () => {
  test("deferred inbox entries keep task workspaces running", async () => {
    const workspace = await createWorkspace({
      name: "task-deferred",
      agents: ["alice"],
      storage: new MemoryStorage(),
    });

    await workspace.contextProvider.send({
      channel: "general",
      from: "user",
      content: "@alice finish this later",
    });

    const pending = await workspace.contextProvider.inbox.peek("alice");
    await workspace.contextProvider.inbox.defer(
      "alice",
      pending[0]!.messageId,
      new Date(Date.now() + 60_000).toISOString(),
    );

    const handle = new ManagedWorkspace({
      workspace,
      resolved: {
        def: { name: "task-deferred", agents: { alice: { runtime: "mock" } } },
        agents: [{ name: "alice", instructions: "", runtime: "mock" }],
      } as unknown as ResolvedWorkspace,
      loops: [{ name: "alice", isFailed: false } as WorkspaceOrchestrator],
      mode: "task",
    });

    try {
      expect(await handle.checkCompletion()).toBe("running");
    } finally {
      await workspace.shutdown();
    }
  });
});
