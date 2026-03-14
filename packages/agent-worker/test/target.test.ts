import { test, expect, describe } from "bun:test";
import { parseTarget, formatTarget } from "../src/cli/target.ts";

describe("parseTarget", () => {
  test("agent only", () => {
    expect(parseTarget("alice")).toEqual({
      agent: "alice",
      workspace: undefined,
      channel: undefined,
    });
  });

  test("agent@workspace", () => {
    expect(parseTarget("alice@review")).toEqual({
      agent: "alice",
      workspace: "review",
      channel: undefined,
    });
  });

  test("agent@workspace:tag", () => {
    expect(parseTarget("alice@review:pr-42")).toEqual({
      agent: "alice",
      workspace: "review:pr-42",
      channel: undefined,
    });
  });

  test("@workspace", () => {
    expect(parseTarget("@review")).toEqual({
      agent: undefined,
      workspace: "review",
      channel: undefined,
    });
  });

  test("@workspace:tag", () => {
    expect(parseTarget("@review:pr-42")).toEqual({
      agent: undefined,
      workspace: "review:pr-42",
      channel: undefined,
    });
  });

  test("@workspace#channel", () => {
    expect(parseTarget("@review#design")).toEqual({
      agent: undefined,
      workspace: "review",
      channel: "design",
    });
  });

  test("@workspace:tag#channel", () => {
    expect(parseTarget("@review:pr-42#design")).toEqual({
      agent: undefined,
      workspace: "review:pr-42",
      channel: "design",
    });
  });

  test("agent@workspace#channel", () => {
    expect(parseTarget("alice@review#design")).toEqual({
      agent: "alice",
      workspace: "review",
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

  test("agent@workspace#channel", () => {
    expect(formatTarget({ agent: "alice", workspace: "review", channel: "design" })).toBe(
      "alice@review#design",
    );
  });

  test("@workspace:tag", () => {
    expect(formatTarget({ workspace: "review:pr-42" })).toBe("@review:pr-42");
  });
});
