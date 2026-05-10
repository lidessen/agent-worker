import { test, expect, describe, afterEach } from "bun:test";
import { Daemon } from "../src/daemon.ts";
import { AwClient } from "../src/client.ts";
import type { AgentLoop } from "@agent-worker/agent";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

function createMockLoop(response: string | string[] = "Hello!"): AgentLoop {
  const mock: AgentLoop & { _status: LoopStatus } = {
    supports: ["directTools"],
    _status: "idle" as LoopStatus,
    get status(): LoopStatus {
      return mock._status;
    },
    run(_prompt: string): LoopRun {
      mock._status = "running";
      const textEvents = (Array.isArray(response) ? response : [response]).map(
        (text): LoopEvent => ({ type: "text", text }),
      );
      const loopResult: LoopResult = {
        events: textEvents,
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        durationMs: 10,
      };
      const result = Promise.resolve().then(() => {
        mock._status = "completed";
        return loopResult;
      });
      return {
        async *[Symbol.asyncIterator]() {
          for (const event of textEvents) yield event;
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
    daemon = new Daemon({ port: 0, mcpPort: 0, dataDir });
    const info = await daemon.start();
    client = AwClient.fromInfo(info);
    return { info, dataDir };
  }

  test("health()", async () => {
    await setup();
    const health = await client.health();
    expect(health.status).toBe("ok");
    // Agent count depends on env (auto-discovered runtimes may register agents)
    expect(health.agents).toBeGreaterThanOrEqual(0);
  });

  test("listAgents() has no ephemeral agents initially", async () => {
    await setup();
    const agents = await client.listAgents();
    // Only config-created agents (from auto-discovery) may exist; no ephemeral ones
    expect(agents.every((a) => a.kind === "config")).toBe(true);
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
      config: {
        name: "bob",
        instructions: "be bob",
        loop: createMockLoop("Bob says hi"),
        inbox: { debounceMs: 0 },
      },
    });

    await client.sendToAgent("bob", [{ content: "hello" }]);
    await Bun.sleep(200);

    const result = await client.readResponses("bob", { cursor: 0 });
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.some((e: any) => e.type === "text" && e.text === "Bob says hi")).toBe(
      true,
    );
  });

  test("readResponses aggregates streamed text into one response entry", async () => {
    await setup();
    await daemon.agentRegistry.create({
      name: "streamy",
      config: {
        name: "streamy",
        instructions: "be streamy",
        loop: createMockLoop(["Hello", " ", "world"]),
        inbox: { debounceMs: 0 },
      },
    });

    await client.sendToAgent("streamy", [{ content: "hello" }]);
    await Bun.sleep(200);

    const result = await client.readResponses("streamy", { cursor: 0 });
    const textEntries = result.entries.filter((e: any) => e.type === "text");
    expect(textEntries).toHaveLength(1);
    expect((textEntries[0] as any).text).toBe("Hello world");
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

  test("readAgentEvents returns runtime_event entries for tools", async () => {
    await setup();
    const loop: AgentLoop = {
      supports: [],
      _status: "idle" as LoopStatus,
      get status(): LoopStatus {
        return this._status;
      },
      run(): LoopRun {
        this._status = "running";
        const events: LoopEvent[] = [
          {
            type: "tool_call_start",
            name: "agent_todo",
            callId: "call_1",
            args: { action: "add", text: "Write tests" },
          },
          {
            type: "tool_call_end",
            name: "agent_todo",
            callId: "call_1",
            result: "ok",
            durationMs: 12,
          },
        ];
        const result = Promise.resolve().then(() => {
          this._status = "completed";
          return {
            events,
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            durationMs: 10,
          } satisfies LoopResult;
        });
        return {
          async *[Symbol.asyncIterator]() {
            for (const event of events) yield event;
          },
          result,
        };
      },
      cancel() {
        this._status = "cancelled";
      },
      setMcpConfig() {},
    } as AgentLoop & { _status: LoopStatus };

    await daemon.agentRegistry.create({
      name: "runtime-events",
      config: {
        name: "runtime-events",
        instructions: "test",
        loop,
        inbox: { debounceMs: 0 },
      },
    });

    await client.sendToAgent("runtime-events", [{ content: "go" }]);
    await Bun.sleep(200);

    const result = await client.readAgentEvents("runtime-events", 0);
    expect(
      result.entries.some(
        (e: any) =>
          e.type === "runtime_event" &&
          e.eventKind === "tool" &&
          e.phase === "start" &&
          e.name === "agent_todo",
      ),
    ).toBe(true);
    expect(
      result.entries.some(
        (e: any) =>
          e.type === "runtime_event" &&
          e.eventKind === "tool" &&
          e.phase === "end" &&
          e.name === "agent_todo" &&
          e.callId === "call_1",
      ),
    ).toBe(true);
  });

  test("removeAgent", async () => {
    await setup();
    await daemon.agentRegistry.create({
      name: "temp",
      config: { name: "temp", instructions: "", loop: createMockLoop() },
    });

    await client.removeAgent("temp");
    const agents = await client.listAgents();
    expect(agents.some((a) => a.name === "temp")).toBe(false);
  });

  test("listHarnesss includes global harness", async () => {
    await setup();
    const ws = await client.listHarnesss();
    expect(ws).toHaveLength(1);
    expect(ws[0]!.name).toBe("global");
    expect(ws[0]!.mode).toBe("service");
    expect(ws[0]!.status).toBe("running");
  });

  test("readEvents returns daemon events", async () => {
    await setup();
    await Bun.sleep(100);
    const result = await client.readEvents(0);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.entries.some((e: any) => e.type === "daemon.started")).toBe(true);
  });
});
