import { test, expect, describe } from "bun:test";
import { createStreamParser } from "../src/utils/stream-parser.ts";
import { createEventChannel } from "../src/types.ts";

describe("createStreamParser", () => {
  test("parses complete JSON lines", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"type":"text","text":"hello"}\n');
    parser.push('{"type":"tool_call","name":"bash"}\n');

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ type: "text", text: "hello" });
    expect(results[1]).toEqual({ type: "tool_call", name: "bash" });
  });

  test("handles partial lines across chunks", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"type":"te');
    parser.push('xt","text":"hello"}\n');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ type: "text", text: "hello" });
  });

  test("flushes remaining buffer", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"done":true}');
    expect(results).toHaveLength(0);

    parser.flush();
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ done: true });
  });

  test("skips empty lines", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('\n\n{"ok":true}\n\n');
    expect(results).toHaveLength(1);
  });

  test("calls onError for invalid JSON", () => {
    const errors: string[] = [];
    const parser = createStreamParser(
      () => {},
      (line) => errors.push(line),
    );

    parser.push("not json\n");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe("not json");
  });
});

describe("createEventChannel", () => {
  test("push and iterate", async () => {
    const channel = createEventChannel<number>();

    channel.push(1);
    channel.push(2);
    channel.push(3);
    channel.end();

    const collected: number[] = [];
    for await (const item of channel.iterable) {
      collected.push(item);
    }

    expect(collected).toEqual([1, 2, 3]);
  });

  test("async push after iterator starts", async () => {
    const channel = createEventChannel<string>();

    const collectPromise = (async () => {
      const items: string[] = [];
      for await (const item of channel.iterable) {
        items.push(item);
      }
      return items;
    })();

    // Push asynchronously
    setTimeout(() => {
      channel.push("a");
      channel.push("b");
      channel.end();
    }, 10);

    const items = await collectPromise;
    expect(items).toEqual(["a", "b"]);
  });

  test("error propagation", async () => {
    const channel = createEventChannel<number>();

    channel.push(1);
    channel.error(new Error("test error"));

    const collected: number[] = [];
    let caughtError: Error | null = null;

    try {
      for await (const item of channel.iterable) {
        collected.push(item);
      }
    } catch (err) {
      caughtError = err as Error;
    }

    expect(collected).toEqual([1]);
    expect(caughtError?.message).toBe("test error");
  });
});
