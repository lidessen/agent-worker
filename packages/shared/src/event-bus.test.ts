import { test, expect, beforeEach } from "bun:test";
import { EventBus } from "./event-bus.ts";
import type { BusEvent } from "./event-bus.ts";

let bus: EventBus;

beforeEach(() => {
  bus = new EventBus();
});

// ── on / emit ──────────────────────────────────────────────────────────────

test("on() receives emitted events", () => {
  const received: BusEvent[] = [];
  bus.on((e) => received.push(e));

  bus.emit({ type: "test.hello", source: "agent" });

  expect(received).toHaveLength(1);
  expect(received[0]!.type).toBe("test.hello");
  expect(received[0]!.source).toBe("agent");
  expect(received[0]!.level).toBe("info"); // default level
  expect(received[0]!.ts).toBeGreaterThan(0);
});

test("on() returns an unsubscribe function", () => {
  const received: BusEvent[] = [];
  const unsub = bus.on((e) => received.push(e));

  bus.emit({ type: "a", source: "agent" });
  unsub();
  bus.emit({ type: "b", source: "agent" });

  expect(received).toHaveLength(1);
  expect(received[0]!.type).toBe("a");
});

test("off() removes a specific listener", () => {
  const received: BusEvent[] = [];
  const fn = (e: BusEvent) => received.push(e);
  bus.on(fn);
  bus.off(fn);

  bus.emit({ type: "test", source: "agent" });
  expect(received).toHaveLength(0);
});

test("multiple listeners all receive events", () => {
  const a: string[] = [];
  const b: string[] = [];
  bus.on((e) => a.push(e.type));
  bus.on((e) => b.push(e.type));

  bus.emit({ type: "x", source: "daemon" });

  expect(a).toEqual(["x"]);
  expect(b).toEqual(["x"]);
});

test("listener errors are silently caught", () => {
  const received: string[] = [];
  bus.on(() => {
    throw new Error("boom");
  });
  bus.on((e) => received.push(e.type));

  // Should not throw
  bus.emit({ type: "safe", source: "agent" });
  expect(received).toEqual(["safe"]);
});

test("ts is auto-filled when not provided", () => {
  const received: BusEvent[] = [];
  bus.on((e) => received.push(e));

  const before = Date.now();
  bus.emit({ type: "t", source: "agent" });
  const after = Date.now();

  expect(received[0]!.ts).toBeGreaterThanOrEqual(before);
  expect(received[0]!.ts).toBeLessThanOrEqual(after);
});

test("ts is preserved when explicitly provided", () => {
  const received: BusEvent[] = [];
  bus.on((e) => received.push(e));

  bus.emit({ type: "t", source: "agent", ts: 12345 });
  expect(received[0]!.ts).toBe(12345);
});

test("extra fields are passed through", () => {
  const received: BusEvent[] = [];
  bus.on((e) => received.push(e));

  bus.emit({ type: "agent.run_start", source: "agent", runId: "abc", agent: "coder" });

  expect(received[0]!.runId).toBe("abc");
  expect(received[0]!.agent).toBe("coder");
});

// ── size / clear ───────────────────────────────────────────────────────────

test("size reflects listener count", () => {
  expect(bus.size).toBe(0);
  const unsub = bus.on(() => {});
  expect(bus.size).toBe(1);
  unsub();
  expect(bus.size).toBe(0);
});

test("clear() removes all listeners", () => {
  bus.on(() => {});
  bus.on(() => {});
  expect(bus.size).toBe(2);
  bus.clear();
  expect(bus.size).toBe(0);
});

// ── subscribe ──────────────────────────────────────────────────────────────

test("subscribe() yields events as async iterable", async () => {
  const sub = bus.subscribe();

  bus.emit({ type: "a", source: "agent" });
  bus.emit({ type: "b", source: "daemon" });

  // Read two events then cancel
  const events: BusEvent[] = [];
  let count = 0;
  for await (const event of sub) {
    events.push(event);
    count++;
    if (count >= 2) {
      sub.cancel();
    }
  }

  expect(events).toHaveLength(2);
  expect(events[0]!.type).toBe("a");
  expect(events[1]!.type).toBe("b");
});

test("subscribe() with filter only yields matching events", async () => {
  const sub = bus.subscribe((e) => e.source === "agent");

  bus.emit({ type: "agent-event", source: "agent" });
  bus.emit({ type: "daemon-event", source: "daemon" });
  bus.emit({ type: "agent-event-2", source: "agent" });

  const events: BusEvent[] = [];
  let count = 0;
  for await (const event of sub) {
    events.push(event);
    count++;
    if (count >= 2) sub.cancel();
  }

  expect(events).toHaveLength(2);
  expect(events.every((e) => e.source === "agent")).toBe(true);
});

test("subscribe() cancel cleans up listener", () => {
  const sub = bus.subscribe();
  expect(bus.size).toBe(1);
  sub.cancel();
  expect(bus.size).toBe(0);
});

test("subscribe() works with events emitted after await", async () => {
  const sub = bus.subscribe();

  // Emit after a short delay to test the awaiting path
  setTimeout(() => {
    bus.emit({ type: "delayed", source: "loop" });
    sub.cancel();
  }, 10);

  const events: BusEvent[] = [];
  for await (const event of sub) {
    events.push(event);
  }

  expect(events).toHaveLength(1);
  expect(events[0]!.type).toBe("delayed");
});
