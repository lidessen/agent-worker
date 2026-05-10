import { describe, it, expect, vi } from "vitest";
import { signal } from "@semajsx/signal";

// Helper to wait for microtasks (signal updates are batched with queueMicrotask)
const waitForUpdate = () => new Promise((resolve) => queueMicrotask(resolve));

describe("signal", () => {
  it("should create a signal with initial value", () => {
    const s = signal(42);
    expect(s.value).toBe(42);
  });

  it("should update value", () => {
    const s = signal(0);
    s.value = 10;
    expect(s.value).toBe(10);
  });

  it("should use set() method", () => {
    const s = signal(0);
    s.set(20);
    expect(s.value).toBe(20);
  });

  it("should use update() method", () => {
    const s = signal(5);
    s.update((v) => v * 2);
    expect(s.value).toBe(10);
  });

  it("should notify subscribers on change", async () => {
    const s = signal(0);
    const listener = vi.fn();

    s.subscribe(listener);
    s.value = 1;

    await waitForUpdate();
    expect(listener).toHaveBeenCalledWith(1);
  });

  it("should not notify if value is same", async () => {
    const s = signal(5);
    const listener = vi.fn();

    s.subscribe(listener);
    s.value = 5;

    await waitForUpdate();
    expect(listener).not.toHaveBeenCalled();
  });

  it("should unsubscribe", async () => {
    const s = signal(0);
    const listener = vi.fn();

    const unsubscribe = s.subscribe(listener);
    unsubscribe();

    s.value = 1;
    await waitForUpdate();
    expect(listener).not.toHaveBeenCalled();
  });

  it("should handle multiple subscribers", async () => {
    const s = signal(0);
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    s.subscribe(listener1);
    s.subscribe(listener2);

    s.value = 1;

    await waitForUpdate();
    expect(listener1).toHaveBeenCalledWith(1);
    expect(listener2).toHaveBeenCalledWith(1);
  });

  it("should work with objects", async () => {
    const s = signal({ count: 0 });
    const listener = vi.fn();

    s.subscribe(listener);
    s.value = { count: 1 };

    await waitForUpdate();
    expect(listener).toHaveBeenCalledWith({ count: 1 });
    expect(s.value).toEqual({ count: 1 });
  });

  it("should work with arrays", async () => {
    const s = signal([1, 2, 3]);
    const listener = vi.fn();

    s.subscribe(listener);
    s.value = [4, 5, 6];

    await waitForUpdate();
    expect(listener).toHaveBeenCalledWith([4, 5, 6]);
    expect(s.value).toEqual([4, 5, 6]);
  });

  it("should coalesce rapid updates into single notification", async () => {
    const s = signal(0);
    const listener = vi.fn();
    s.subscribe(listener);
    s.value = 1;
    s.value = 2;
    s.value = 3;
    await new Promise((r) => queueMicrotask(r));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(3);
  });
});
