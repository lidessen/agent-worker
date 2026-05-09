import { describe, expect, test } from "bun:test";
import { AgentRuntime, renderPacket } from "../src/runtime.ts";
import type { AgentLoop, RuntimeBinding } from "../src/index.ts";
import type { LoopEvent, LoopResult, LoopRun, LoopStatus } from "@agent-worker/loop";
import type { ToolSet } from "ai";

function createLoop(response = "done"): AgentLoop & {
  lastInput: unknown;
  tools?: ToolSet;
} {
  const loop: AgentLoop & {
    statusValue: LoopStatus;
    lastInput: unknown;
    tools?: ToolSet;
  } = {
    supports: ["directTools"],
    statusValue: "idle",
    lastInput: undefined,
    get status() {
      return loop.statusValue;
    },
    run(input: string | { system: string; prompt: string }): LoopRun {
      loop.lastInput = input;
      loop.statusValue = "running";
      const textEvent: LoopEvent = { type: "text", text: response };
      const result = Promise.resolve().then(() => {
        loop.statusValue = "completed";
        return {
          events: [textEvent],
          usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 },
          durationMs: 7,
        } satisfies LoopResult;
      });

      return {
        async *[Symbol.asyncIterator]() {
          yield textEvent;
        },
        result,
      };
    },
    cancel() {
      loop.statusValue = "cancelled";
    },
    setTools(tools: ToolSet) {
      loop.tools = tools;
    },
  };
  return loop;
}

function binding(loop: AgentLoop): RuntimeBinding {
  return {
    id: "mock:test",
    runtimeType: "mock",
    loop,
  };
}

describe("AgentRuntime", () => {
  test("renders context packets to loop input", () => {
    expect(
      renderPacket({
        system: "system",
        sections: [{ id: "facts", content: "fact one" }],
        prompt: "do work",
      }),
    ).toEqual({
      system: "system",
      prompt: "## facts\nfact one\n\ndo work",
    });
  });

  test("runs an already selected binding and returns candidate outputs", async () => {
    const loop = createLoop("completed summary");
    const runtime = new AgentRuntime();

    const output = await runtime.run({
      binding: binding(loop),
      packet: {
        system: "system",
        prompt: "do work",
      },
    });

    expect(loop.lastInput).toEqual({ system: "system", prompt: "do work" });
    expect(output.trace.bindingId).toBe("mock:test");
    expect(output.trace.events).toEqual([{ type: "text", text: "completed summary" }]);
    expect(output.result.status).toBe("completed");
    expect(output.result.usage).toEqual({ inputTokens: 2, outputTokens: 3, totalTokens: 5 });
    expect(output.handoffDraft).toEqual({ summary: "completed summary" });
  });

  test("applies run-scoped direct tool capabilities", async () => {
    const loop = createLoop();
    const runtime = new AgentRuntime();
    const tools = {};

    await runtime.run({
      binding: binding(loop),
      packet: { prompt: "do work" },
      capabilities: { directTools: tools },
    });

    expect(loop.tools).toBe(tools);
  });
});
