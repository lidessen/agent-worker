import { test, expect, describe, afterEach } from "bun:test";
import { Daemon } from "../src/daemon.ts";
import { AwClient } from "../src/client.ts";

const CHAT_YAML = `
name: test-ws
agents:
  alice:
    runtime: mock
    instructions: You are Alice.
  bob:
    runtime: mock
    instructions: You are Bob.
channels:
  - general
  - design
storage: memory
kickoff: "@alice Hello from kickoff"
`;

const TASK_YAML = `
name: task-ws
agents:
  alice:
    runtime: mock
    instructions: You are Alice.
channels:
  - general
storage: memory
kickoff: "@alice Finish the task"
`;

describe("Unified daemon (workspace routes)", () => {
  let daemon: Daemon | null = null;
  let client: AwClient;

  async function setup() {
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { mkdirSync } = await import("node:fs");
    const dataDir = join(
      tmpdir(),
      `aw-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(dataDir, { recursive: true });
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();
    client = AwClient.fromInfo(info);
    return info;
  }

  afterEach(async () => {
    if (daemon) {
      await daemon.shutdown();
      daemon = null;
    }
  });

  test("creates workspace and shows status", async () => {
    await setup();
    const wsInfo = await client.createWorkspace(CHAT_YAML);
    expect(wsInfo.name).toBe("test-ws");
    expect(wsInfo.agents).toHaveLength(2);
    expect(wsInfo.agents.sort()).toEqual(["alice", "bob"]);

    const status = await client.getWorkspaceStatus("test-ws");
    expect(status.name).toBe("test-ws");
    expect((status.agents as string[]).sort()).toEqual(["alice", "bob"]);
    expect(
      (status.agent_details as { name: string; runtime: string }[]).map((a) => a.name).sort(),
    ).toEqual(["alice", "bob"]);
    expect(status.channels as string[]).toContain("general");
    expect(status.channels as string[]).toContain("design");
  });

  test("sends and reads messages", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    // Send a message
    const sendResult = await client.sendToWorkspace("test-ws", {
      channel: "general",
      from: "user",
      content: "@alice Please review",
    });
    expect(sendResult.sent).toBe(true);

    // Read channel
    const chData = await client.readChannel("test-ws", "general");
    expect(chData.channel).toBe("general");
    // At least the kickoff message + our message
    expect(chData.messages.length).toBeGreaterThanOrEqual(2);

    const userMsg = chData.messages.find((m) => m.content.includes("Please review"));
    expect(userMsg).toBeTruthy();
    expect(userMsg!.from).toBe("user");
  });

  test("sends DM via agent field", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    await client.sendToWorkspace("test-ws", {
      from: "user",
      content: "Secret message for alice",
      agent: "alice",
    });

    // Check alice inbox
    const entries = await client.peekInbox("test-ws", "alice");
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  test("doc CRUD operations", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    // List docs (empty)
    const docs1 = await client.listDocs("test-ws");
    expect(docs1).toEqual([]);

    // Write a doc
    await client.writeDoc("test-ws", "spec.md", "# Spec v1");

    // Read it back
    const content = await client.readDoc("test-ws", "spec.md");
    expect(content).toBe("# Spec v1");

    // Append
    await client.appendDoc("test-ws", "spec.md", "\n## Section 2");

    const content2 = await client.readDoc("test-ws", "spec.md");
    expect(content2).toBe("# Spec v1\n## Section 2");

    // List docs (should have 1)
    const docs2 = await client.listDocs("test-ws");
    expect(docs2.map((d) => d.name)).toContain("spec.md");
  });

  test("lists channels", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    const channels = await client.listChannels("test-ws");
    expect(channels).toContain("general");
    expect(channels).toContain("design");
  });

  test("listWorkspaceTasks surfaces the kickoff-created draft task", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    // Poll briefly since kickoff + task creation is async.
    let result = await client.listWorkspaceTasks("test-ws");
    for (let i = 0; i < 20 && result.tasks.length === 0; i++) {
      await Bun.sleep(50);
      result = await client.listWorkspaceTasks("test-ws");
    }

    expect(result.tasks.length).toBeGreaterThanOrEqual(1);
    const first = result.tasks[0] as {
      id: string;
      status: string;
      title: string;
      sourceRefs: { kind: string }[];
    };
    expect(first.status).toBe("draft");
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.sourceRefs.some((r) => r.kind === "kickoff")).toBe(true);

    // getWorkspaceTask returns the task plus empty lifecycle lists at this point.
    const detailed = await client.getWorkspaceTask("test-ws", first.id);
    expect(detailed.task).toMatchObject({ id: first.id });
    expect(detailed.attempts).toEqual([]);
    expect(detailed.handoffs).toEqual([]);
    expect(detailed.artifacts).toEqual([]);
  });

  test("listWorkspaceTasks accepts a status filter", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    // Wait for the kickoff task to appear.
    let drafts = await client.listWorkspaceTasks("test-ws", { status: "draft" });
    for (let i = 0; i < 20 && drafts.tasks.length === 0; i++) {
      await Bun.sleep(50);
      drafts = await client.listWorkspaceTasks("test-ws", { status: "draft" });
    }
    expect(drafts.tasks.length).toBeGreaterThanOrEqual(1);

    // No open tasks yet.
    const open = await client.listWorkspaceTasks("test-ws", { status: "open" });
    expect(open.tasks).toEqual([]);
  });

  test("listWorkspaceTasks rejects unknown status values with 400", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    // Hit the raw endpoint since the client passes through any string.
    await expect(client.listWorkspaceTasks("test-ws", { status: "garbage" })).rejects.toThrow();
  });

  test("create, update, and dispatch a task through HTTP POST endpoints", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    const created = await client.createWorkspaceTask("test-ws", {
      title: "Wire auth middleware",
      goal: "Protect /api/admin with the new JWT check",
      acceptanceCriteria: "All admin endpoints return 401 without a token",
    });
    const task = created.task as { id: string; status: string; title: string };
    expect(task.status).toBe("draft");
    expect(task.title).toBe("Wire auth middleware");

    const updated = await client.updateWorkspaceTask("test-ws", task.id, {
      status: "open",
    });
    expect((updated.task as { status: string }).status).toBe("open");

    const dispatched = await client.dispatchWorkspaceTask("test-ws", task.id, {
      worker: "alice",
    });
    const taskAfter = dispatched.task as { status: string; activeAttemptId?: string };
    const attempt = dispatched.attempt as { id: string; agentName: string };
    expect(taskAfter.status).toBe("in_progress");
    expect(taskAfter.activeAttemptId).toBe(attempt.id);
    expect(attempt.agentName).toBe("alice");

    // getWorkspaceTask should now show the attempt alongside the task.
    const detail = await client.getWorkspaceTask("test-ws", task.id);
    expect(detail.attempts).toHaveLength(1);
    const loaded = detail.attempts[0] as { id: string; status: string };
    expect(loaded.id).toBe(attempt.id);
    expect(loaded.status).toBe("running");
  });

  test("dispatching a task that already has an active attempt fails with 409", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    const created = await client.createWorkspaceTask("test-ws", {
      title: "t",
      goal: "g",
    });
    const taskId = (created.task as { id: string }).id;
    await client.updateWorkspaceTask("test-ws", taskId, { status: "open" });
    await client.dispatchWorkspaceTask("test-ws", taskId, { worker: "alice" });

    await expect(
      client.dispatchWorkspaceTask("test-ws", taskId, { worker: "bob" }),
    ).rejects.toThrow();
  });

  test("createWorkspaceTask rejects an invalid status with 400", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    await expect(
      client.createWorkspaceTask("test-ws", {
        title: "t",
        goal: "g",
        status: "nope",
      }),
    ).rejects.toThrow();
  });

  test("completeWorkspaceTask finalizes the active attempt and records a handoff", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    const created = await client.createWorkspaceTask("test-ws", {
      title: "Wire audit log",
      goal: "Log user-driven admin actions",
    });
    const taskId = (created.task as { id: string }).id;

    await client.updateWorkspaceTask("test-ws", taskId, { status: "open" });
    const dispatched = await client.dispatchWorkspaceTask("test-ws", taskId, {
      worker: "alice",
    });
    const attemptId = (dispatched.attempt as { id: string }).id;

    const closed = await client.completeWorkspaceTask("test-ws", taskId, {
      summary: "Shipped audit log with tests",
    });

    const t = closed.task as { status: string; activeAttemptId?: string };
    expect(t.status).toBe("completed");
    expect(t.activeAttemptId).toBeUndefined();

    const attempts = closed.attempts as Array<{ id: string; status: string; endedAt?: number }>;
    const closedAttempt = attempts.find((a) => a.id === attemptId);
    expect(closedAttempt?.status).toBe("completed");
    expect(closedAttempt?.endedAt).toBeGreaterThan(0);

    const handoffs = closed.handoffs as Array<{
      kind: string;
      summary: string;
      createdBy: string;
    }>;
    const handoff = handoffs.find((h) => h.kind === "completed");
    expect(handoff).toBeDefined();
    expect(handoff?.summary).toBe("Shipped audit log with tests");
    expect(handoff?.createdBy).toBe("user");
  });

  test("abortWorkspaceTask cancels the active attempt and records an aborted handoff", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    const created = await client.createWorkspaceTask("test-ws", {
      title: "Obsolete request",
      goal: "Will be canceled",
    });
    const taskId = (created.task as { id: string }).id;
    await client.updateWorkspaceTask("test-ws", taskId, { status: "open" });
    await client.dispatchWorkspaceTask("test-ws", taskId, { worker: "alice" });

    const closed = await client.abortWorkspaceTask("test-ws", taskId, {
      reason: "Requirements changed",
    });
    expect((closed.task as { status: string }).status).toBe("aborted");

    const attempts = closed.attempts as Array<{ status: string }>;
    expect(attempts[0]?.status).toBe("cancelled");

    const handoffs = closed.handoffs as Array<{ kind: string; summary: string }>;
    const handoff = handoffs.find((h) => h.kind === "aborted");
    expect(handoff).toBeDefined();
    expect(handoff?.summary).toBe("Requirements changed");
  });

  test("completeWorkspaceTask works even without an active attempt", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    const created = await client.createWorkspaceTask("test-ws", {
      title: "Quick note",
      goal: "Just a reminder",
    });
    const taskId = (created.task as { id: string }).id;

    // Skip dispatch entirely — directly complete a draft task.
    const closed = await client.completeWorkspaceTask("test-ws", taskId);
    expect((closed.task as { status: string }).status).toBe("completed");
    // No attempts means no handoff is written — that's deliberate.
    expect(closed.handoffs).toEqual([]);
  });

  test("closing an already-terminal task returns 409", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    const created = await client.createWorkspaceTask("test-ws", {
      title: "Done",
      goal: "g",
    });
    const taskId = (created.task as { id: string }).id;
    await client.completeWorkspaceTask("test-ws", taskId);

    await expect(client.completeWorkspaceTask("test-ws", taskId)).rejects.toThrow();
  });

  test("reads workspace events", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    // Poll until events appear (up to 2s)
    let result = await client.readWorkspaceEvents("test-ws", 0);
    for (let i = 0; i < 20 && result.entries.length === 0; i++) {
      await Bun.sleep(100);
      result = await client.readWorkspaceEvents("test-ws", 0);
    }
    // Should have workspace.created, workspace.kickoff events
    expect(result.entries.length).toBeGreaterThan(0);
    const types = result.entries.map((entry) => entry.type);
    expect(types).toContain("workspace.created");
    expect(types).toContain("workspace.kickoff");
    expect(types).not.toContain("workspace.agent_prompt_ready");
    expect(types).not.toContain("workspace.agent_tools");
  });

  test("shutdown via HTTP", async () => {
    await setup();
    await client.createWorkspace(CHAT_YAML);

    await client.stopWorkspace("test-ws");

    // Workspace should be removed
    const workspaces = await client.listWorkspaces();
    expect(workspaces.find((w) => w.name === "test-ws")).toBeUndefined();
  });

  test("task workspace wait completes after work drains", async () => {
    await setup();
    const wsInfo = await client.createWorkspace(TASK_YAML, { mode: "task" });
    expect(wsInfo.mode).toBe("task");

    const result = await client.waitWorkspace("task-ws", "5s");
    expect(result.status).toBe("completed");
  });
});
