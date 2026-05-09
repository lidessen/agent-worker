import { describe, it, expect, vi } from "vitest";
import { when, resource, stream } from "../src/helpers";
import { signal } from "@semajsx/signal";
import { h } from "../src/vnode";

// Helper to wait for microtasks
const waitForUpdate = () => new Promise((resolve) => queueMicrotask(resolve));

describe("helpers", () => {
  describe("when()", () => {
    it("should return null when condition is false", () => {
      const condition = signal(false);
      const result = when(condition, h("div", null, "content"));
      expect(result.value).toBeNull();
    });

    it("should return content when condition is true", () => {
      const condition = signal(true);
      const content = h("div", null, "content");
      const result = when(condition, content);
      expect(result.value).toBe(content);
    });

    it("should update when condition changes", async () => {
      const condition = signal(false);
      const content = h("div", null, "content");
      const result = when(condition, content);

      expect(result.value).toBeNull();

      condition.value = true;
      await waitForUpdate();
      expect(result.value).toBe(content);

      condition.value = false;
      await waitForUpdate();
      expect(result.value).toBeNull();
    });

    it("should support lazy evaluation with function", () => {
      const condition = signal(true);
      const factory = vi.fn(() => h("div", null, "lazy"));
      const result = when(condition, factory);

      // Factory is called when .value is accessed (lazy computed)
      expect(result.value?.type).toBe("div");
      expect(factory).toHaveBeenCalled();
    });

    it("should not call factory when condition is false", () => {
      const condition = signal(false);
      const factory = vi.fn(() => h("div", null, "lazy"));
      when(condition, factory);

      expect(factory).not.toHaveBeenCalled();
    });

    it("should call factory each time condition becomes true", async () => {
      const condition = signal(false);
      const factory = vi.fn(() => h("div", null, "lazy"));
      const result = when(condition, factory);

      // Subscribe to mirror real render-layer usage (activates the computed)
      result.subscribe(() => {});

      condition.value = true;
      await waitForUpdate();
      await waitForUpdate();
      expect(factory).toHaveBeenCalledTimes(1);

      condition.value = false;
      await waitForUpdate();
      await waitForUpdate();

      condition.value = true;
      await waitForUpdate();
      await waitForUpdate();
      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe("resource()", () => {
    it("should start with pending content (null by default)", () => {
      const promise = new Promise(() => {}); // Never resolves
      const result = resource(promise);
      expect(result.value).toBeNull();
    });

    it("should use custom pending content", () => {
      const promise = new Promise(() => {});
      const pending = h("div", null, "Loading...");
      const result = resource(promise, pending);
      expect(result.value).toBe(pending);
    });

    it("should update with resolved value", async () => {
      const content = h("div", null, "Loaded");
      const promise = Promise.resolve(content);
      const result = resource(promise);

      await promise;
      await waitForUpdate();
      expect(result.value).toBe(content);
    });

    it("should handle rejected promise", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const error = new Error("Test error");
      const promise = Promise.reject(error);
      const result = resource(promise);

      await waitForUpdate();
      await waitForUpdate();

      expect(consoleSpy).toHaveBeenCalled();
      expect(result.value).toBeNull(); // Stays at pending value
      consoleSpy.mockRestore();
    });
  });

  describe("stream()", () => {
    it("should start with pending content (null by default)", () => {
      async function* gen() {
        yield h("div", null, "first");
      }
      const result = stream(gen());
      expect(result.value).toBeNull();
    });

    it("should use custom pending content", () => {
      async function* gen() {
        yield h("div", null, "first");
      }
      const pending = h("div", null, "Loading...");
      const result = stream(gen(), pending);
      expect(result.value).toBe(pending);
    });

    it("should update with each yielded value", async () => {
      const first = h("div", null, "first");
      const second = h("div", null, "second");

      async function* gen() {
        yield first;
        yield second;
      }

      const result = stream(gen());

      // Wait for async generator to process
      await new Promise((r) => setTimeout(r, 10));

      expect(result.value).toBe(second);
    });

    it("should handle errors in stream", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      async function* gen() {
        yield h("div", null, "first");
        throw new Error("Stream error");
      }

      stream(gen());

      await new Promise((r) => setTimeout(r, 10));

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
