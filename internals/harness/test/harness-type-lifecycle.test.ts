// Lifecycle wire-up of HarnessType protocol on the Harness class:
// - contributeRuntime is invoked at construction; the value is held on
//   `harness.typeRuntime`.
// - onInit fires from Harness.init after substrate work, with the
//   stashed runtime visible.
// - onShutdown fires from Harness.shutdown before substrate teardown,
//   with the same runtime visible.
// - onShutdown errors are caught (logged, not thrown) so a failing type
//   does not block substrate cleanup.

import { test, expect } from "bun:test";
import { Harness } from "../src/harness.ts";
import { MemoryStorage } from "../src/context/storage.ts";
import {
  createHarnessTypeRegistry,
  type HarnessType,
} from "../src/type/index.ts";

test("contributeRuntime fires at construction; runtime is held on the harness", () => {
  const registry = createHarnessTypeRegistry();
  const built: { harness: unknown; config: unknown }[] = [];
  const t: HarnessType = {
    id: "lifecycle-runtime",
    contributeRuntime: (input) => {
      built.push(input);
      return { tag: "runtime-built" };
    },
  };
  registry.register(t);

  const harness = new Harness(
    {
      name: "wf",
      storage: new MemoryStorage(),
      harnessTypeId: "lifecycle-runtime",
    },
    registry,
  );

  expect(built).toHaveLength(1);
  expect(built[0]!.harness).toBe(harness);
  expect(harness.typeRuntime).toEqual({ tag: "runtime-built" });
});

test("absent contributeRuntime leaves typeRuntime undefined", () => {
  const registry = createHarnessTypeRegistry();
  registry.register({ id: "no-runtime" });

  const harness = new Harness(
    {
      name: "wf",
      storage: new MemoryStorage(),
      harnessTypeId: "no-runtime",
    },
    registry,
  );

  expect(harness.typeRuntime).toBeUndefined();
});

test("onInit fires after substrate init with the contributed runtime", async () => {
  const registry = createHarnessTypeRegistry();
  const seen: { runtime: unknown }[] = [];
  registry.register({
    id: "lifecycle-init",
    contributeRuntime: () => ({ stage: "construct" }),
    onInit: ({ runtime }) => {
      seen.push({ runtime });
    },
  });

  const harness = new Harness(
    {
      name: "wf",
      storage: new MemoryStorage(),
      harnessTypeId: "lifecycle-init",
    },
    registry,
  );
  await harness.init();

  expect(seen).toHaveLength(1);
  expect(seen[0]!.runtime).toEqual({ stage: "construct" });
});

test("onShutdown fires on shutdown with the contributed runtime", async () => {
  const registry = createHarnessTypeRegistry();
  const calls: string[] = [];
  registry.register({
    id: "lifecycle-shutdown",
    contributeRuntime: () => ({ id: "rt" }),
    onInit: () => {
      calls.push("init");
    },
    onShutdown: ({ runtime }) => {
      calls.push(`shutdown:${(runtime as { id?: string } | undefined)?.id ?? ""}`);
    },
  });

  const harness = new Harness(
    {
      name: "wf",
      storage: new MemoryStorage(),
      harnessTypeId: "lifecycle-shutdown",
    },
    registry,
  );
  await harness.init();
  await harness.shutdown();

  expect(calls).toEqual(["init", "shutdown:rt"]);
});

test("onShutdown errors are swallowed so substrate teardown still runs", async () => {
  const registry = createHarnessTypeRegistry();
  registry.register({
    id: "lifecycle-throws",
    onShutdown: () => {
      throw new Error("boom");
    },
  });

  const harness = new Harness(
    {
      name: "wf",
      storage: new MemoryStorage(),
      harnessTypeId: "lifecycle-throws",
    },
    registry,
  );
  await harness.init();

  // Suppress the expected error log to keep test output clean.
  const originalError = console.error;
  const captured: unknown[] = [];
  console.error = (...args) => {
    captured.push(args);
  };
  try {
    await expect(harness.shutdown()).resolves.toBeUndefined();
  } finally {
    console.error = originalError;
  }

  expect(captured.some((args) => Array.isArray(args) && String(args[0]).includes("onShutdown failed"))).toBe(true);
});

test("init is idempotent — onInit only fires once", async () => {
  const registry = createHarnessTypeRegistry();
  let calls = 0;
  registry.register({
    id: "lifecycle-once",
    onInit: () => {
      calls++;
    },
  });

  const harness = new Harness(
    {
      name: "wf",
      storage: new MemoryStorage(),
      harnessTypeId: "lifecycle-once",
    },
    registry,
  );
  await harness.init();
  await harness.init();
  await harness.init();
  expect(calls).toBe(1);
});
