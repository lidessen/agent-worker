import { test, expect, describe } from "bun:test";
import { nanoid, extractMentions } from "../src/utils.ts";

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
