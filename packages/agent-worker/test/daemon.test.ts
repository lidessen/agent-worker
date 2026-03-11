import { test, expect, describe, afterEach } from "bun:test";
import { Daemon } from "../src/daemon.ts";
import { Agent } from "@agent-worker/agent";
import type { AgentLoop } from "@agent-worker/agent";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";
import { readDaemonInfo, removeDaemonInfo } from "../src/discovery.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/** Create a mock AgentLoop that returns a fixed text response */
function createMockLoop(response = "Hello!"): AgentLoop {
  const mock: AgentLoop & { _status: LoopStatus } = {
    supports: ["directTools"],
    _status: "idle" as LoopStatus,

    get status(): LoopStatus {
      return mock._status;
    },

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
        async *[Symbol.asyncIterator]() {
          yield textEvent;
        },
        result,
      };
    },

    cancel() {
      mock._status = "cancelled";
    },

    setTools() {},
    setPrepareStep() {},
  };
  return mock;
}

function tmpDataDir(): string {
  const dir = join(tmpdir(), `aw-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("Daemon", () => {
  let daemon: Daemon;

  afterEach(async () => {
    if (daemon) {
      await daemon.shutdown();
    }
  });

  test("starts and exposes health endpoint", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    expect(info.port).toBeGreaterThan(0);
    expect(info.pid).toBe(process.pid);

    const res = await fetch(`http://${info.host}:${info.port}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.agents).toBe(0);
    expect(body.workspaces).toBe(0);
  });

  test("writes daemon.json for discovery", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    const discovered = await readDaemonInfo(dataDir);
    expect(discovered).not.toBeNull();
    expect(discovered!.port).toBe(info.port);
    expect(discovered!.token).toBe(info.token);
  });

  test("cleans up daemon.json on shutdown", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    await daemon.start();
    await daemon.shutdown();

    const discovered = await readDaemonInfo(dataDir);
    expect(discovered).toBeNull();
  });

  test("requires auth for non-health endpoints", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    const res = await fetch(`http://${info.host}:${info.port}/agents`);
    expect(res.status).toBe(401);
  });

  test("lists agents (empty)", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    const res = await fetch(`http://${info.host}:${info.port}/agents`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toEqual([]);
  });

  test("registers agent programmatically and runs message", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    // Create agent via programmatic API
    const handle = await daemon.agentRegistry.create({
      name: "test-agent",
      config: {
        name: "test-agent",
        instructions: "You are a test agent.",
        loop: createMockLoop("Test response"),
      },
    });

    expect(handle.name).toBe("test-agent");
    expect(handle.kind).toBe("ephemeral");

    // List agents via HTTP
    const listRes = await fetch(`http://${info.host}:${info.port}/agents`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    const listBody = await listRes.json();
    expect(listBody.agents).toHaveLength(1);
    expect(listBody.agents[0].name).toBe("test-agent");

    // Get agent via HTTP
    const getRes = await fetch(`http://${info.host}:${info.port}/agents/test-agent`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.name).toBe("test-agent");
  });

  test("sends async message via /send", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    await daemon.agentRegistry.create({
      name: "alice",
      config: {
        name: "alice",
        instructions: "You are Alice.",
        loop: createMockLoop("Hi!"),
      },
    });

    const res = await fetch(`http://${info.host}:${info.port}/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${info.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ agent: "alice", message: "Hello" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
  });

  test("removes ephemeral agent via DELETE", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    await daemon.agentRegistry.create({
      name: "temp",
      config: {
        name: "temp",
        instructions: "Temporary",
        loop: createMockLoop(),
      },
    });

    expect(daemon.agentRegistry.size).toBe(1);

    const res = await fetch(`http://${info.host}:${info.port}/agents/temp`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    expect(daemon.agentRegistry.size).toBe(0);
  });

  test("reads events log via /events", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    // Wait a tick for events to flush
    await Bun.sleep(100);

    const res = await fetch(`http://${info.host}:${info.port}/events?cursor=0`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries.length).toBeGreaterThanOrEqual(1);
    // First event should be daemon.started (bus-emitted)
    const startEvent = body.entries.find((e: any) => e.type === "daemon.started");
    expect(startEvent).toBeDefined();
  });

  test("shutdown via POST /shutdown", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, dataDir });
    const info = await daemon.start();

    const res = await fetch(`http://${info.host}:${info.port}/shutdown`, {
      method: "POST",
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.shutting_down).toBe(true);

    // Give time for shutdown to complete
    await Bun.sleep(200);
  });
});
