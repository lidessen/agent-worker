import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createWorkspace } from "../src/factory.ts";
import { FileStorage } from "../src/context/storage.ts";
import { WorkspaceMcpHub } from "../src/mcp-server.ts";
import { WorkspaceClient } from "@agent-worker/agent";
import type { Workspace } from "../src/workspace.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("workspace_info exposes shared sandbox path", () => {
  let workspace: Workspace;
  let server: WorkspaceMcpHub;
  let debug: WorkspaceClient;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "ws-sandbox-test-"));
    workspace = await createWorkspace({
      name: "sandbox-test",
      channels: ["general"],
      agents: ["alice"],
      storage: new FileStorage(tmpDir),
      storageDir: tmpDir,
    });
    server = new WorkspaceMcpHub(workspace);
    await server.start();
    debug = new WorkspaceClient({
      agentName: "$supervisor",
      workspaceUrl: server.url!,
    });
    await debug.connect();
  });

  afterEach(async () => {
    await debug.disconnect();
    await server.stop();
    await workspace.shutdown();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("workspace_info includes Shared sandbox path", async () => {
    const result = await debug.callTool("workspace_info");
    expect(result).toContain("Shared sandbox:");
    expect(result).toContain(join(tmpDir, "sandbox"));
  });

  test("workspace sandbox dir is correct", () => {
    expect(workspace.workspaceSandboxDir).toBe(join(tmpDir, "sandbox"));
  });

  test("agent sandbox dir is scoped to agent name", () => {
    expect(workspace.agentSandboxDir("alice")).toBe(
      join(tmpDir, "agents", "alice", "sandbox"),
    );
  });
});
