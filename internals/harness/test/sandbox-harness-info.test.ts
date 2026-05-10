import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { createHarness } from "../src/factory.ts";
import { FileStorage } from "../src/context/storage.ts";
import { HarnessMcpHub } from "../src/mcp-server.ts";
import { HarnessClient } from "@agent-worker/agent";
import type { Harness } from "../src/harness.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("harness_info exposes shared sandbox path", () => {
  let harness: Harness;
  let server: HarnessMcpHub;
  let debug: HarnessClient;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "ws-sandbox-test-"));
    harness = await createHarness({
      name: "sandbox-test",
      channels: ["general"],
      agents: ["alice"],
      storage: new FileStorage(tmpDir),
      storageDir: tmpDir,
    });
    server = new HarnessMcpHub(harness);
    await server.start();
    debug = new HarnessClient({
      agentName: "$supervisor",
      harnessUrl: server.url!,
    });
    await debug.connect();
  });

  afterEach(async () => {
    await debug.disconnect();
    await server.stop();
    await harness.shutdown();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("harness_info includes Shared sandbox path", async () => {
    const result = await debug.callTool("harness_info");
    expect(result).toContain("Shared sandbox:");
    expect(result).toContain(join(tmpDir, "sandbox"));
  });

  test("harness sandbox dir is correct", () => {
    expect(harness.harnessSandboxDir).toBe(join(tmpDir, "sandbox"));
  });

  test("agent sandbox dir is scoped to agent name", () => {
    expect(harness.agentSandboxDir("alice")).toBe(join(tmpDir, "agents", "alice", "sandbox"));
  });
});
