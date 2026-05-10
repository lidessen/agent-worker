import { describe, it, expect, vi } from "vitest";
import { batch, scheduleUpdate } from "../src/batch";
import { signal } from "../src/signal";

// Helper to wait for microtasks
const waitForUpdate = () => new Promise((resolve) => queueMicrotask(resolve));

describe("batch", () => {
  describe("scheduleUpdate()", () => {
    it("should schedule updates for next microtask", async () => {
      const callback = vi.fn();
      scheduleUpdate(callback);

      expect(callback).not.toHaveBeenCalled();

      await waitForUpdate();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should batch multiple updates into single microtask", async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      scheduleUpdate(callback1);
      scheduleUpdate(callback2);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();

      await waitForUpdate();
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate same callback", async () => {
      const callback = vi.fn();

      scheduleUpdate(callback);
      scheduleUpdate(callback);
      scheduleUpdate(callback);

      await waitForUpdate();
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("batch()", () => {
    it("should return the result of the function", () => {
      const result = batch(() => 42);
      expect(result).toBe(42);
    });

    it("should batch signal updates", async () => {
      const s = signal(0);
      const listener = vi.fn();
      s.subscribe(listener);

      batch(() => {
        s.value = 1;
        s.value = 2;
        s.value = 3;
      });

      // Each value change creates a new update callback, but they all read final value
      expect(listener).toHaveBeenCalledWith(3);
    });

    it("should flush updates synchronously after batch", () => {
      const s = signal(0);
      const listener = vi.fn();
      s.subscribe(listener);

      batch(() => {
        s.value = 10;
      });

      // Updates should be flushed synchronously after batch
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(10);
    });

    it("should handle nested batches", () => {
      const s = signal(0);
      const listener = vi.fn();
      s.subscribe(listener);

      batch(() => {
        s.value = 1;
        batch(() => {
          s.value = 2;
        });
        s.value = 3;
      });

      // Updates are flushed at end of outer batch with final value
      expect(listener).toHaveBeenCalledWith(3);
    });

    it("should handle errors in batch function", () => {
      const s = signal(0);
      const listener = vi.fn();
      s.subscribe(listener);

      expect(() => {
        batch(() => {
          s.value = 1;
          throw new Error("Test error");
        });
      }).toThrow("Test error");

      // Updates before error should still be flushed
      expect(listener).toHaveBeenCalledWith(1);
    });

    it("should work with multiple signals", () => {
      const s1 = signal(0);
      const s2 = signal(0);
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      s1.subscribe(listener1);
      s2.subscribe(listener2);

      batch(() => {
        s1.value = 1;
        s2.value = 2;
      });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener1).toHaveBeenCalledWith(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledWith(2);
    });

    it("should handle computed signals in batch", async () => {
      const { computed } = await import("../src/computed");
      const s = signal(1);
      const doubled = computed([s], (v) => v * 2);

      const listener = vi.fn();
      doubled.subscribe(listener);

      batch(() => {
        s.value = 2;
        s.value = 3;
        s.value = 4;
      });

      // Wait for microtask to process updates
      await waitForUpdate();

      // Computed should update with final value
      expect(listener).toHaveBeenCalledWith(8);
    });
  });
});
