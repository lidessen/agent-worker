import { describe, expect, test } from "bun:test";
import { formatDurationMs } from "./time.ts";

describe("formatDurationMs", () => {
  test("formats seconds from millisecond uptime", () => {
    expect(formatDurationMs(59_900)).toBe("59s");
  });

  test("formats minutes from millisecond uptime", () => {
    expect(formatDurationMs(7 * 60_000 + 25_000)).toBe("7m");
  });

  test("formats hours and minutes from millisecond uptime", () => {
    expect(formatDurationMs(2 * 60 * 60_000 + 7 * 60_000 + 45_000)).toBe("2h 7m");
  });
});
