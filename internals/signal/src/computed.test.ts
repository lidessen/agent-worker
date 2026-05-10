import { describe, it, expect, vi } from "vitest";
import { signal, computed } from "@semajsx/signal";

// Helper to wait for microtasks (signal updates are batched with queueMicrotask)
const waitForUpdate = () => new Promise((resolve) => queueMicrotask(resolve));

describe("computed", () => {
  it("should create computed from single dependency", () => {
    const count = signal(5);
    const doubled = computed([count], (c) => c * 2);

    expect(doubled.value).toBe(10);
  });

  it("should create computed from multiple dependencies", () => {
    const a = signal(2);
    const b = signal(3);
    const sum = computed([a, b], (x, y) => x + y);

    expect(sum.value).toBe(5);
  });

  it("should support single dependency shorthand", () => {
    const count = signal(10);
    const doubled = computed(count, (c) => c * 2);

    expect(doubled.value).toBe(20);
  });

  it("should update when dependency changes", async () => {
    const count = signal(5);
    const doubled = computed([count], (c) => c * 2);

    expect(doubled.value).toBe(10);

    count.value = 10;
    await waitForUpdate();
    expect(doubled.value).toBe(20);
  });

  it("should update when any dependency changes", async () => {
    const a = signal(1);
    const b = signal(2);
    const sum = computed([a, b], (x, y) => x + y);

    expect(sum.value).toBe(3);

    a.value = 5;
    await waitForUpdate();
    expect(sum.value).toBe(7);

    b.value = 10;
    await waitForUpdate();
    expect(sum.value).toBe(15);
  });

  it("should notify subscribers", async () => {
    const count = signal(0);
    const doubled = computed([count], (c) => c * 2);
    const listener = vi.fn();

    doubled.subscribe(listener);
    count.value = 5;

    await waitForUpdate();
    await waitForUpdate(); // Need two waits: one for signal, one for computed
    expect(listener).toHaveBeenCalledWith(10);
  });

  it("should not notify if computed value is same", async () => {
    const count = signal(5);
    const isPositive = computed([count], (c) => c > 0);
    const listener = vi.fn();

    isPositive.subscribe(listener);

    count.value = 10; // Still positive
    await waitForUpdate();
    await waitForUpdate(); // Need two waits: one for signal, one for computed
    expect(listener).not.toHaveBeenCalled();
  });

  it("should support chained computed", async () => {
    const count = signal(2);
    const doubled = computed([count], (c) => c * 2);
    const quadrupled = computed([doubled], (d) => d * 2);

    expect(quadrupled.value).toBe(8);

    count.value = 5;
    await waitForUpdate();
    await waitForUpdate(); // Need two waits: signal -> doubled -> quadrupled
    expect(quadrupled.value).toBe(20);
  });

  it("should handle complex computations", async () => {
    const firstName = signal("John");
    const lastName = signal("Doe");
    const age = signal(30);

    const profile = computed([firstName, lastName, age], (f, l, a) => `${f} ${l}, ${a} years old`);

    expect(profile.value).toBe("John Doe, 30 years old");

    firstName.value = "Jane";
    await waitForUpdate();
    expect(profile.value).toBe("Jane Doe, 30 years old");
  });

  it("should coalesce when dependency changes rapidly", async () => {
    const count = signal(0);
    const doubled = computed(count, (c) => c * 2);
    const listener = vi.fn();
    doubled.subscribe(listener);
    count.value = 1;
    count.value = 2;
    count.value = 3;
    await new Promise((r) => queueMicrotask(r));
    await new Promise((r) => queueMicrotask(r));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(6);
  });

  // ── Lazy activation/deactivation tests ──────────────────────────────

  it("should not subscribe to deps until first subscriber (lazy)", () => {
    const computeFn = vi.fn((c: number) => c * 2);
    const count = signal(5);
    const doubled = computed(count, computeFn);

    // Reading .value without subscribers computes on demand
    expect(doubled.value).toBe(10);
    // compute is called on each .value access when inactive
    expect(doubled.value).toBe(10);
    expect(computeFn).toHaveBeenCalledTimes(2);
  });

  it("should activate on first subscriber and deactivate on last unsubscribe", async () => {
    const count = signal(0);
    const doubled = computed(count, (c) => c * 2);
    const listener = vi.fn();

    // Subscribe → activate
    const unsub = doubled.subscribe(listener);

    count.value = 5;
    await waitForUpdate();
    await waitForUpdate();
    expect(listener).toHaveBeenCalledWith(10);

    // Unsubscribe → deactivate
    unsub();
    listener.mockClear();

    count.value = 10;
    await waitForUpdate();
    await waitForUpdate();
    // No notification after deactivation
    expect(listener).not.toHaveBeenCalled();

    // But .value still works (on-demand compute)
    expect(doubled.value).toBe(20);
  });

  it("should reactivate correctly after deactivation", async () => {
    const count = signal(1);
    const doubled = computed(count, (c) => c * 2);

    // First subscribe/unsubscribe cycle
    const unsub1 = doubled.subscribe(() => {});
    unsub1();

    // Change value while deactivated
    count.value = 5;

    // Re-subscribe — should see current value
    const listener = vi.fn();
    const unsub2 = doubled.subscribe(listener);
    expect(doubled.value).toBe(10);

    // Should react to new changes
    count.value = 7;
    await waitForUpdate();
    await waitForUpdate();
    expect(listener).toHaveBeenCalledWith(14);

    unsub2();
  });

  it("should cascade activation through computed chains", async () => {
    const count = signal(2);
    const doubled = computed(count, (c) => c * 2);
    const quadrupled = computed(doubled, (d) => d * 2);
    const listener = vi.fn();

    // Subscribe to end of chain → cascading activation
    const unsub = quadrupled.subscribe(listener);

    count.value = 3;
    await waitForUpdate();
    await waitForUpdate();
    await waitForUpdate();
    expect(listener).toHaveBeenCalledWith(12);

    // Unsubscribe → cascading deactivation
    unsub();
    listener.mockClear();

    count.value = 5;
    await waitForUpdate();
    await waitForUpdate();
    expect(listener).not.toHaveBeenCalled();

    // On-demand still works through the chain
    expect(quadrupled.value).toBe(20);
  });

  it("should handle multiple subscribers correctly", async () => {
    const count = signal(0);
    const doubled = computed(count, (c) => c * 2);
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    const unsub1 = doubled.subscribe(listener1);
    const unsub2 = doubled.subscribe(listener2);

    count.value = 3;
    await waitForUpdate();
    await waitForUpdate();
    expect(listener1).toHaveBeenCalledWith(6);
    expect(listener2).toHaveBeenCalledWith(6);

    // Remove first subscriber — still active (second remains)
    unsub1();
    listener1.mockClear();
    listener2.mockClear();

    count.value = 5;
    await waitForUpdate();
    await waitForUpdate();
    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).toHaveBeenCalledWith(10);

    // Remove last subscriber → deactivate
    unsub2();
  });
});
