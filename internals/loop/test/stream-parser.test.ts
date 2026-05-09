import { test, expect, describe } from "bun:test";
import { createStreamParser } from "../src/utils/stream-parser.ts";

describe("createStreamParser", () => {
  test("parses complete JSON lines", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"a":1}\n{"b":2}\n');

    expect(results).toEqual([{ a: 1 }, { b: 2 }]);
  });

  test("buffers incomplete lines across chunks", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"ke');
    expect(results).toEqual([]);

    parser.push('y":"val"}\n');
    expect(results).toEqual([{ key: "val" }]);
  });

  test("skips empty lines", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('\n\n{"x":1}\n\n');

    expect(results).toEqual([{ x: 1 }]);
  });

  test("skips whitespace-only lines", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('   \n{"x":1}\n  \t  \n');

    expect(results).toEqual([{ x: 1 }]);
  });

  test("calls onError for malformed JSON", () => {
    const results: unknown[] = [];
    const errors: { line: string; err: Error }[] = [];
    const parser = createStreamParser(
      (data) => results.push(data),
      (line, err) => errors.push({ line, err }),
    );

    parser.push('not json\n{"ok":true}\n');

    expect(results).toEqual([{ ok: true }]);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe("not json");
    expect(errors[0]!.err).toBeInstanceOf(Error);
  });

  test("silently ignores malformed JSON when no onError", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('bad\n{"ok":true}\n');

    expect(results).toEqual([{ ok: true }]);
  });

  test("flush emits buffered incomplete line", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"final":true}');
    expect(results).toEqual([]);

    parser.flush();
    expect(results).toEqual([{ final: true }]);
  });

  test("flush is a no-op when buffer is empty", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.flush();
    expect(results).toEqual([]);
  });

  test("flush is a no-op when buffer is whitespace-only", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push("  \t  ");
    parser.flush();
    expect(results).toEqual([]);
  });

  test("flush calls onError for invalid buffered content", () => {
    const errors: string[] = [];
    const parser = createStreamParser(
      () => {},
      (line) => errors.push(line),
    );

    parser.push("invalid json");
    parser.flush();
    expect(errors).toEqual(["invalid json"]);
  });

  test("flush resets buffer so subsequent flush is a no-op", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"a":1}');
    parser.flush();
    parser.flush();
    expect(results).toEqual([{ a: 1 }]);
  });

  test("handles multiple chunks building one line", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push("{");
    parser.push('"x"');
    parser.push(":");
    parser.push("42");
    parser.push("}\n");

    expect(results).toEqual([{ x: 42 }]);
  });

  test("handles mixed complete and incomplete lines in one chunk", () => {
    const results: unknown[] = [];
    const parser = createStreamParser((data) => results.push(data));

    parser.push('{"a":1}\n{"b":2}\n{"c":');
    expect(results).toEqual([{ a: 1 }, { b: 2 }]);

    parser.push("3}\n");
    expect(results).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }]);
  });

  test("preserves typed generic", () => {
    interface Event {
      type: string;
      text: string;
    }
    const results: Event[] = [];
    const parser = createStreamParser<Event>((data) => results.push(data));

    parser.push('{"type":"text","text":"hello"}\n');

    expect(results[0]!.type).toBe("text");
    expect(results[0]!.text).toBe("hello");
  });
});
