import { test, expect, describe } from "bun:test";
import { MockLoop } from "../src/loops/mock.ts";

describe("MockLoop", () => {
  test("returns configured response", async () => {
    const loop = new MockLoop({ response: "hello world" });
    expect(loop.status).toBe("idle");

    const run = loop.run("test prompt");
    const events: any[] = [];
    for await (const event of run) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("text");
    expect(events[0].text).toBe("hello world");
    expect(loop.status).toBe("completed");

    const result = await run.result;
    expect(result.events).toHaveLength(1);
    expect(result.usage.totalTokens).toBe(15);
  });

  test("default response", async () => {
    const loop = new MockLoop();
    const run = loop.run("test");
    const result = await run.result;
    expect(result.events[0]).toEqual({ type: "text", text: "mock response" });
  });

  test("cancel", () => {
    const loop = new MockLoop();
    loop.cancel();
    expect(loop.status).toBe("cancelled");
  });

  test("supports directTools", () => {
    const loop = new MockLoop();
    expect(loop.supports).toContain("directTools");
  });
});
