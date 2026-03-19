import { test, expect, describe, afterEach } from "bun:test";
import { Daemon } from "../src/daemon.ts";
import type { AgentLoop } from "@agent-worker/agent";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";
import { readDaemonInfo } from "../src/discovery.ts";
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
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    expect(info.port).toBeGreaterThan(0);
    expect(info.pid).toBe(process.pid);

    const res = await fetch(`http://${info.host}:${info.port}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    // Global agents may be auto-registered from workspace discovery
    expect(typeof body.agents).toBe("number");
    expect(body.workspaces).toBe(1); // global workspace always exists
  });

  test("writes daemon.json for discovery", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    const discovered = await readDaemonInfo(dataDir);
    expect(discovered).not.toBeNull();
    expect(discovered!.port).toBe(info.port);
    expect(discovered!.token).toBe(info.token);
  });

  test("cleans up daemon.json on shutdown", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    await daemon.start();
    await daemon.shutdown();

    const discovered = await readDaemonInfo(dataDir);
    expect(discovered).toBeNull();
  });

  test("requires auth for non-health endpoints", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    const res = await fetch(`http://${info.host}:${info.port}/agents`);
    expect(res.status).toBe(401);
  });

  test("POST /agents resolves ai-sdk default model via resolveRuntime", async () => {
    // Make sure only one provider key is available so auto-detection is deterministic.
    const savedEnv: Record<string, string | undefined> = {};
    const envKeys = [
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY",
      "DEEPSEEK_API_KEY",
      "KIMI_CODE_API_KEY",
      "MINIMAX_API_KEY",
      "AI_GATEWAY_API_KEY",
    ];

    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }

    try {
      process.env.DEEPSEEK_API_KEY = "sk-test";

      const dataDir = tmpDataDir();
      daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
      const info = await daemon.start();

      const res = await fetch(`http://${info.host}:${info.port}/agents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${info.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "ds-agent",
          runtime: {
            type: "ai-sdk",
            instructions: "You are a test agent.",
          },
        }),
      });

      // Without resolveRuntime, ai-sdk would hard-code anthropic and fail
      // when anthropic adapter isn't available/configured.
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.name).toBe("ds-agent");
    } finally {
      for (const key of envKeys) {
        if (savedEnv[key] !== undefined) process.env[key] = savedEnv[key];
        else delete process.env[key];
      }
    }
  });

  test("lists agents (includes auto-discovered global agents)", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    const res = await fetch(`http://${info.host}:${info.port}/agents`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { agents: Array<Record<string, unknown>> };
    expect(Array.isArray(body.agents)).toBe(true);
    // If any global agents were discovered, they should have kind: "config" and workspace: "global"
    for (const agent of body.agents) {
      if (agent.workspace === "global") {
        expect(agent.kind).toBe("config");
      }
    }
  });

  test("registers agent programmatically and runs message", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
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

    // List agents via HTTP — should include test-agent (plus any global agents)
    const listRes = await fetch(`http://${info.host}:${info.port}/agents`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    const listBody = (await listRes.json()) as { agents: Array<Record<string, unknown>> };
    const testAgent = listBody.agents.find((a) => a.name === "test-agent");
    expect(testAgent).toBeDefined();
    expect(testAgent!.name).toBe("test-agent");

    // Get agent via HTTP
    const getRes = await fetch(`http://${info.host}:${info.port}/agents/test-agent`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as Record<string, unknown>;
    expect(getBody.name).toBe("test-agent");
  });

  test("sends async message via /agents/:name/send", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    await daemon.agentRegistry.create({
      name: "alice",
      config: {
        name: "alice",
        instructions: "You are Alice.",
        loop: createMockLoop("Hi!"),
      },
    });

    const res = await fetch(`http://${info.host}:${info.port}/agents/alice/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${info.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ content: "Hello" }] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.sent).toBe(1);
  });

  test("removes ephemeral agent via DELETE", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    await daemon.agentRegistry.create({
      name: "temp",
      config: {
        name: "temp",
        instructions: "Temporary",
        loop: createMockLoop(),
      },
    });

    const sizeBeforeRemove = daemon.agentRegistry.size;
    expect(daemon.agentRegistry.has("temp")).toBe(true);

    const res = await fetch(`http://${info.host}:${info.port}/agents/temp`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    expect(daemon.agentRegistry.size).toBe(sizeBeforeRemove - 1);
    expect(daemon.agentRegistry.has("temp")).toBe(false);
  });

  test("reads events log via /events", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    // Wait a tick for events to flush
    await Bun.sleep(100);

    const res = await fetch(`http://${info.host}:${info.port}/events?cursor=0`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect((body.entries as unknown[]).length).toBeGreaterThanOrEqual(1);
    // First event should be daemon.started (bus-emitted)
    const startEvent = (body.entries as Record<string, unknown>[]).find(
      (e) => e.type === "daemon.started",
    );
    expect(startEvent).toBeDefined();
  });

  test("sends messages via /agents/:name/send", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    await daemon.agentRegistry.create({
      name: "bob",
      config: { name: "bob", instructions: "You are Bob.", loop: createMockLoop("Hey!") },
    });

    const res = await fetch(`http://${info.host}:${info.port}/agents/bob/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${info.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ content: "Hello Bob" }] }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.sent).toBe(1);
  });

  test("reads per-agent responses and events", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    await daemon.agentRegistry.create({
      name: "dave",
      config: {
        name: "dave",
        instructions: "You are Dave.",
        loop: createMockLoop("Dave here"),
        inbox: { debounceMs: 0 },
      },
    });

    // Send a message and wait for processing
    await fetch(`http://${info.host}:${info.port}/agents/dave/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${info.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ content: "Hi Dave" }] }),
    });

    // Wait for agent to process
    await Bun.sleep(200);

    // Read responses
    const respRes = await fetch(`http://${info.host}:${info.port}/agents/dave/responses?cursor=0`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(respRes.status).toBe(200);
    const respBody = (await respRes.json()) as Record<string, unknown>;
    expect((respBody.entries as unknown[]).length).toBeGreaterThan(0);
    expect(
      (respBody.entries as Record<string, unknown>[]).some(
        (e) => e.type === "text" && e.text === "Dave here",
      ),
    ).toBe(true);
    expect(respBody.cursor).toBeGreaterThan(0);

    // Read events
    const evtRes = await fetch(`http://${info.host}:${info.port}/agents/dave/events?cursor=0`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(evtRes.status).toBe(200);
    const evtBody = (await evtRes.json()) as Record<string, unknown>;
    expect((evtBody.entries as unknown[]).length).toBeGreaterThan(0);
    // Should have state_change, message_received, run_start, run_end events
    const types = (evtBody.entries as Record<string, unknown>[]).map((e) => e.type);
    expect(types).toContain("message_received");
    expect(types).toContain("run_start");
    expect(types).toContain("run_end");

    // Incremental read with cursor should return empty
    const incRes = await fetch(
      `http://${info.host}:${info.port}/agents/dave/responses?cursor=${respBody.cursor}`,
      {
        headers: { Authorization: `Bearer ${info.token}` },
      },
    );
    const incBody = (await incRes.json()) as Record<string, unknown>;
    expect(incBody.entries).toEqual([]);
  });

  test("reads agent state via /agents/:name/state", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    await daemon.agentRegistry.create({
      name: "eve",
      config: { name: "eve", instructions: "You are Eve.", loop: createMockLoop("Eve here") },
    });

    const res = await fetch(`http://${info.host}:${info.port}/agents/eve/state`, {
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.state).toBeDefined();
    expect(Array.isArray(body.inbox)).toBe(true);
    expect(Array.isArray(body.todos)).toBe(true);
    expect(typeof body.history).toBe("number");
  });

  test("shutdown via POST /shutdown", async () => {
    const dataDir = tmpDataDir();
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();

    const res = await fetch(`http://${info.host}:${info.port}/shutdown`, {
      method: "POST",
      headers: { Authorization: `Bearer ${info.token}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.shutting_down).toBe(true);

    // Give time for shutdown to complete
    await Bun.sleep(200);
  });
});
