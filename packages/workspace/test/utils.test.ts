import { test, expect, describe } from "bun:test";
import { nanoid, extractMentions, extractAddressedMentions } from "../src/utils.ts";

describe("nanoid", () => {
  test("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(nanoid());
    }
    expect(ids.size).toBe(100);
  });

  test("generates IDs of specified length", () => {
    expect(nanoid(8).length).toBe(8);
    expect(nanoid(16).length).toBe(16);
  });
});

describe("extractMentions", () => {
  test("extracts single mention", () => {
    expect(extractMentions("Hey @alice")).toEqual(["alice"]);
  });

  test("extracts multiple mentions", () => {
    const mentions = extractMentions("@alice and @bob please review");
    expect(mentions).toEqual(["alice", "bob"]);
  });

  test("deduplicates mentions", () => {
    const mentions = extractMentions("@alice @alice @alice");
    expect(mentions).toEqual(["alice"]);
  });

  test("returns empty for no mentions", () => {
    expect(extractMentions("no mentions here")).toEqual([]);
  });

  test("handles mentions at start", () => {
    expect(extractMentions("@bob do this")).toEqual(["bob"]);
  });
});

describe("extractAddressedMentions", () => {
  test("leading mention is the addressee", () => {
    expect(extractAddressedMentions("@alice please review")).toEqual(["alice"]);
  });

  test("multiple leading mentions all addressed", () => {
    expect(extractAddressedMentions("@alice @bob joint review please")).toEqual([
      "alice",
      "bob",
    ]);
  });

  test("body references after leading mention are ignored", () => {
    // Core regression case: maintainer's chronicle message should not
    // wake implementer as a side-effect of quoting the worker name.
    expect(
      extractAddressedMentions(
        "@maintainer — task_xxx dispatched to @implementer (attempt att_yyy)",
      ),
    ).toEqual(["maintainer"]);
  });

  test("body-only mention falls back to legacy extractMentions", () => {
    // "Hey @bob please review" has no leading mention, so we keep
    // legacy behavior and still treat bob as addressed.
    expect(extractAddressedMentions("Hey @bob please review")).toEqual(["bob"]);
  });

  test("no mentions at all returns empty", () => {
    expect(extractAddressedMentions("general announcement")).toEqual([]);
  });

  test("multiple body mentions without leading", () => {
    // Legacy fallback: preserves all mentions when none lead the message.
    expect(extractAddressedMentions("ping @alice and also @bob")).toEqual(["alice", "bob"]);
  });

  test("handles leading whitespace", () => {
    expect(extractAddressedMentions("   @alice hello")).toEqual(["alice"]);
  });

  test("deduplicates in leading run", () => {
    expect(extractAddressedMentions("@alice @alice hello")).toEqual(["alice"]);
  });
});
