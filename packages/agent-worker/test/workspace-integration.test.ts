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
