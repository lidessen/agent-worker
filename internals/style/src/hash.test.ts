import { describe, it, expect } from "vitest";
import { hashString, uniqueId } from "./hash";

describe("hashString", () => {
  it("should return a string hash", () => {
    const hash = hashString("test");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("should be deterministic", () => {
    const hash1 = hashString("hello");
    const hash2 = hashString("hello");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different inputs", () => {
    const hash1 = hashString("hello");
    const hash2 = hashString("world");
    expect(hash1).not.toBe(hash2);
  });

  it("should handle empty string", () => {
    const hash = hashString("");
    expect(typeof hash).toBe("string");
  });

  it("should handle long strings", () => {
    const longString = "a".repeat(1000);
    const hash = hashString(longString);
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeLessThanOrEqual(5);
  });
});

describe("uniqueId", () => {
  it("should return a string", () => {
    const id = uniqueId();
    expect(typeof id).toBe("string");
  });

  it("should generate unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(uniqueId());
    }
    expect(ids.size).toBe(100);
  });
});
