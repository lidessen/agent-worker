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

describe("Unified daemon (workspace routes)", () => {
  let daemon: Daemon | null = null;
  let client: AwClient;

  async function setup() {
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { mkdirSync } = await import("node:fs");
    const dataDir = join(tmpdir(), `aw-cli-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dataDir, { recursive: true });
    daemon = new Daemon({ port: 0, dataDir });
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
    const wsInfo = await client.startWorkspace(CHAT_YAML);
    expect(wsInfo.name).toBe("test-ws");
    expect(wsInfo.agents).toHaveLength(2);
    expect(wsInfo.agents.sort()).toEqual(["alice", "bob"]);

    const status = await client.getWorkspaceStatus("test-ws");
    expect(status.name).toBe("test-ws");
    expect((status.agents as any[]).map((a: any) => a.name).sort()).toEqual(["alice", "bob"]);
    expect((status.channels as string[])).toContain("general");
    expect((status.channels as string[])).toContain("design");
  });

  test("sends and reads messages", async () => {
    await setup();
    await client.startWorkspace(CHAT_YAML);

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
    await client.startWorkspace(CHAT_YAML);

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
    await client.startWorkspace(CHAT_YAML);

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
    await client.startWorkspace(CHAT_YAML);

    const channels = await client.listChannels("test-ws");
    expect(channels).toContain("general");
    expect(channels).toContain("design");
  });

  test("reads workspace events", async () => {
    await setup();
    await client.startWorkspace(CHAT_YAML);

    // Wait for events to flush
    await Bun.sleep(500);

    const result = await client.readWorkspaceEvents("test-ws", 0);
    // Should have workspace.created, workspace.kickoff events
    expect(result.entries.length).toBeGreaterThan(0);
  });

  test("shutdown via HTTP", async () => {
    await setup();
    await client.startWorkspace(CHAT_YAML);

    await client.stopWorkspace("test-ws");

    // Workspace should be removed
    const workspaces = await client.listWorkspaces();
    expect(workspaces.find((w) => w.name === "test-ws")).toBeUndefined();
  });
});
