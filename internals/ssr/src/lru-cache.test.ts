import { describe, expect, it } from "vitest";
import { LRUCache } from "../src/lru-cache";

describe("LRUCache", () => {
  describe("basic operations", () => {
    it("should set and get values", () => {
      const cache = new LRUCache<string, number>();
      cache.set("a", 1);
      cache.set("b", 2);

      expect(cache.get("a")).toBe(1);
      expect(cache.get("b")).toBe(2);
    });

    it("should return undefined for missing keys", () => {
      const cache = new LRUCache<string, number>();
      expect(cache.get("missing")).toBeUndefined();
    });

    it("should check if key exists", () => {
      const cache = new LRUCache<string, number>();
      cache.set("exists", 1);

      expect(cache.has("exists")).toBe(true);
      expect(cache.has("missing")).toBe(false);
    });

    it("should delete keys", () => {
      const cache = new LRUCache<string, number>();
      cache.set("key", 1);

      expect(cache.delete("key")).toBe(true);
      expect(cache.has("key")).toBe(false);
      expect(cache.delete("missing")).toBe(false);
    });

    it("should clear all entries", () => {
      const cache = new LRUCache<string, number>();
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.has("a")).toBe(false);
    });

    it("should return correct size", () => {
      const cache = new LRUCache<string, number>();
      expect(cache.size).toBe(0);

      cache.set("a", 1);
      expect(cache.size).toBe(1);

      cache.set("b", 2);
      expect(cache.size).toBe(2);

      cache.delete("a");
      expect(cache.size).toBe(1);
    });
  });

  describe("LRU eviction", () => {
    it("should evict oldest entry when over capacity", () => {
      const cache = new LRUCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      expect(cache.size).toBe(3);

      cache.set("d", 4);

      expect(cache.size).toBe(3);
      expect(cache.has("a")).toBe(false); // oldest evicted
      expect(cache.has("b")).toBe(true);
      expect(cache.has("c")).toBe(true);
      expect(cache.has("d")).toBe(true);
    });

    it("should update LRU order on get", () => {
      const cache = new LRUCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Access 'a' to make it recently used
      cache.get("a");

      // Add new entry, 'b' should be evicted (oldest)
      cache.set("d", 4);

      expect(cache.has("a")).toBe(true); // still present
      expect(cache.has("b")).toBe(false); // evicted
      expect(cache.has("c")).toBe(true);
      expect(cache.has("d")).toBe(true);
    });

    it("should update LRU order on set for existing key", () => {
      const cache = new LRUCache<string, number>(3);
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      // Update 'a' to make it recently used
      cache.set("a", 10);

      // Add new entry, 'b' should be evicted
      cache.set("d", 4);

      expect(cache.has("a")).toBe(true);
      expect(cache.get("a")).toBe(10);
      expect(cache.has("b")).toBe(false);
    });

    it("should handle capacity of 1", () => {
      const cache = new LRUCache<string, number>(1);
      cache.set("a", 1);
      expect(cache.size).toBe(1);

      cache.set("b", 2);
      expect(cache.size).toBe(1);
      expect(cache.has("a")).toBe(false);
      expect(cache.has("b")).toBe(true);
    });
  });

  describe("iterators", () => {
    it("should return all keys", () => {
      const cache = new LRUCache<string, number>();
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      const keys = Array.from(cache.keys());
      expect(keys).toHaveLength(3);
      expect(keys).toContain("a");
      expect(keys).toContain("b");
      expect(keys).toContain("c");
    });

    it("should return all values", () => {
      const cache = new LRUCache<string, number>();
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      const values = Array.from(cache.values());
      expect(values).toHaveLength(3);
      expect(values).toContain(1);
      expect(values).toContain(2);
      expect(values).toContain(3);
    });

    it("should preserve insertion order for keys", () => {
      const cache = new LRUCache<string, number>();
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      const keys = Array.from(cache.keys());
      expect(keys).toEqual(["a", "b", "c"]);
    });
  });

  describe("default capacity", () => {
    it("should use default capacity of 1000", () => {
      const cache = new LRUCache<number, number>();

      // Add 1001 items
      for (let i = 0; i < 1001; i++) {
        cache.set(i, i);
      }

      expect(cache.size).toBe(1000);
      expect(cache.has(0)).toBe(false); // first evicted
      expect(cache.has(1)).toBe(true);
      expect(cache.has(1000)).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined values", () => {
      const cache = new LRUCache<string, number | undefined>();
      cache.set("key", undefined);

      // Note: get returns undefined both for missing keys and undefined values
      expect(cache.has("key")).toBe(true);
    });

    it("should handle numeric keys", () => {
      const cache = new LRUCache<number, string>();
      cache.set(1, "one");
      cache.set(2, "two");

      expect(cache.get(1)).toBe("one");
      expect(cache.get(2)).toBe("two");
    });

    it("should handle object values", () => {
      const cache = new LRUCache<string, { name: string }>();
      const obj = { name: "test" };
      cache.set("key", obj);

      expect(cache.get("key")).toBe(obj);
    });

    it("should not evict when updating existing key at capacity", () => {
      const cache = new LRUCache<string, number>(2);
      cache.set("a", 1);
      cache.set("b", 2);

      // Update existing key
      cache.set("a", 10);

      expect(cache.size).toBe(2);
      expect(cache.has("a")).toBe(true);
      expect(cache.has("b")).toBe(true);
      expect(cache.get("a")).toBe(10);
    });
  });
});
