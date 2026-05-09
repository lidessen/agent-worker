import { describe, it, expect } from "vitest";
import { signal, isSignal, unwrap } from "@semajsx/signal";

describe("signal utils", () => {
  describe("isSignal", () => {
    it("should return true for signals", () => {
      const s = signal(0);
      expect(isSignal(s)).toBe(true);
    });

    it("should return false for non-signals", () => {
      expect(isSignal(42)).toBe(false);
      expect(isSignal("hello")).toBe(false);
      expect(isSignal(null)).toBe(false);
      expect(isSignal(undefined)).toBe(false);
      expect(isSignal({})).toBe(false);
      expect(isSignal([])).toBe(false);
    });
  });

  describe("unwrap", () => {
    it("should unwrap signal value", () => {
      const s = signal(42);
      expect(unwrap(s)).toBe(42);
    });

    it("should return non-signal as-is", () => {
      expect(unwrap(42)).toBe(42);
      expect(unwrap("hello")).toBe("hello");
      expect(unwrap(null)).toBe(null);
    });
  });
});
