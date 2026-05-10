import { test, expect, describe } from "bun:test";
import { parseTarget, formatTarget } from "../src/cli/target.ts";

describe("parseTarget", () => {
  test("agent only", () => {
    expect(parseTarget("alice")).toEqual({
      agent: "alice",
      harness: undefined,
      channel: undefined,
    });
  });

  test("agent@harness", () => {
    expect(parseTarget("alice@review")).toEqual({
      agent: "alice",
      harness: "review",
      channel: undefined,
    });
  });

  test("agent@harness:tag", () => {
    expect(parseTarget("alice@review:pr-42")).toEqual({
      agent: "alice",
      harness: "review:pr-42",
      channel: undefined,
    });
  });

  test("@harness", () => {
    expect(parseTarget("@review")).toEqual({
      agent: undefined,
      harness: "review",
      channel: undefined,
    });
  });

  test("@harness:tag", () => {
    expect(parseTarget("@review:pr-42")).toEqual({
      agent: undefined,
      harness: "review:pr-42",
      channel: undefined,
    });
  });

  test("@harness#channel", () => {
    expect(parseTarget("@review#design")).toEqual({
      agent: undefined,
      harness: "review",
      channel: "design",
    });
  });

  test("@harness:tag#channel", () => {
    expect(parseTarget("@review:pr-42#design")).toEqual({
      agent: undefined,
      harness: "review:pr-42",
      channel: "design",
    });
  });

  test("agent@harness#channel", () => {
    expect(parseTarget("alice@review#design")).toEqual({
      agent: "alice",
      harness: "review",
      channel: "design",
    });
  });

  test("throws on empty string", () => {
    expect(() => parseTarget("")).toThrow();
  });
});

describe("formatTarget", () => {
  test("agent only", () => {
    expect(formatTarget({ agent: "alice" })).toBe("alice");
  });

  test("agent@harness#channel", () => {
    expect(formatTarget({ agent: "alice", harness: "review", channel: "design" })).toBe(
      "alice@review#design",
    );
  });

  test("@harness:tag", () => {
    expect(formatTarget({ harness: "review:pr-42" })).toBe("@review:pr-42");
  });
});
