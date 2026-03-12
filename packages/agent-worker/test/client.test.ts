import { test, expect, describe, afterEach } from "bun:test";
import { Daemon } from "../src/daemon.ts";
import { AwClient } from "../src/client.ts";
import type { AgentLoop } from "@agent-worker/agent";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

function createMockLoop(response = "Hello!"): AgentLoop {
  const mock: AgentLoop & { _status: LoopStatus } = {
    supports: ["directTools"],
    _status: "idle" as LoopStatus,
    get status(): LoopStatus { return mock._status; },
    run(_prompt: string): LoopRun {
      mock._status = "running";
      const textEvent: LoopEvent = { type: "text", text: response };
      const loopResult: LoopResult = {
        events: [textEvent],
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        durationMs: 10,
      };
      const result = Promise.resolve().then(() => {
        mock._status = "completed";
        return loopResult;
      });
      return {
        async *[Symbol.asyncIterator]() { yield textEvent; },
        result,
      };
    },
    cancel() { mock._status = "cancelled"; },
    setTools() {},
    setPrepareStep() {},
  };
  return mock;
}

function tmpDataDir(): string {
  const dir = join(tmpdir(), `aw-client-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("AwClient", () => {
  let daemon: Daemon;
  let client: AwClient;

  afterEach(async () => {
    if (daemon) await daemon.shutdown();
  });

  async function setup() {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();
    client = AwClient.fromInfo(info);
    return { info, dataDir };
  }

  test("health()", async () => {
    await setup();
    const health = await client.health();
    expect(health.status).toBe("ok");
    expect(health.agents).toBe(0);
  });

  test("listAgents() empty", async () => {
    await setup();
    const agents = await client.listAgents();
    expect(agents).toEqual([]);
  });

  test("createAgent via HTTP with mock runtime", async () => {
    await setup();
    const info = await client.createAgent("test", { type: "mock", mockResponse: "hi" });
    expect(info.name).toBe("test");
    expect(info.kind).toBe("ephemeral");
  });

  test("sendToAgent + readResponses", async () => {
    await setup();
    // Create agent programmatically (mock loop)
    await daemon.agentRegistry.create({
      name: "bob",
      config: { name: "bob", instructions: "be bob", loop: createMockLoop("Bob says hi"), inbox: { debounceMs: 0 } },
    });

    await client.sendToAgent("bob", [{ content: "hello" }]);
    await Bun.sleep(200);

    const result = await client.readResponses("bob", { cursor: 0 });
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.some((e: any) => e.type === "text" && e.text === "Bob says hi")).toBe(true);
  });

  test("getAgentState", async () => {
    await setup();
    await daemon.agentRegistry.create({
      name: "eve",
      config: { name: "eve", instructions: "be eve", loop: createMockLoop() },
    });

    const state = await client.getAgentState("eve");
    expect(state.state).toBeDefined();
    expect(Array.isArray(state.inbox)).toBe(true);
    expect(typeof state.history).toBe("number");
  });

  test("removeAgent", async () => {
    await setup();
    await daemon.agentRegistry.create({
      name: "temp",
      config: { name: "temp", instructions: "", loop: createMockLoop() },
    });

    await client.removeAgent("temp");
    const agents = await client.listAgents();
    expect(agents).toEqual([]);
  });

  test("listWorkspaces empty", async () => {
    await setup();
    const ws = await client.listWorkspaces();
    expect(ws).toEqual([]);
  });

  test("readEvents returns daemon events", async () => {
    await setup();
    await Bun.sleep(100);
    const result = await client.readEvents(0);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.some((e: any) => e.type === "daemon.started")).toBe(true);
  });
});
