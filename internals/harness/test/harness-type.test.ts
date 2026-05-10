// Focused tests for the `internals/harness/src/type/` module:
// registry semantics, default-fallback, produce/consume helpers, and
// failure semantics (produce-throw swallowed; consume-throw rethrows
// as HandoffExtensionConsumeError per decision 005).

import { test, expect } from "bun:test";
import {
  createHarnessTypeRegistry,
  defaultHarnessType,
  DEFAULT_HARNESS_TYPE_ID,
  HandoffExtensionConsumeError,
  runConsumeExtension,
  runProduceExtension,
  type HarnessType,
  type ProduceExtensionInput,
} from "../src/index.ts";
import type { ContextPacket } from "@agent-worker/agent";
import type { Handoff, Wake } from "../src/state/types.ts";

const fakeWake: Wake = {
  id: "wk_1",
  taskId: "tk_1",
  agentName: "@worker",
  role: "worker",
  status: "completed",
  startedAt: 0,
};

const baseProduceInput = (): ProduceExtensionInput => ({
  wake: fakeWake,
  events: [],
  workLog: undefined,
  draft: { summary: "done" },
});

const baseHandoff = (overrides: Partial<Handoff> = {}): Handoff => ({
  id: "hnd_1",
  taskId: "tk_1",
  closingWakeId: "wk_1",
  createdAt: 0,
  createdBy: "@worker",
  kind: "progress",
  summary: "done",
  completed: [],
  pending: [],
  blockers: [],
  decisions: [],
  resources: [],
  extensions: {},
  ...overrides,
});

const basePacket = (): ContextPacket => ({ prompt: "hello" });

// ── Registry ────────────────────────────────────────────────────────

test("registry seeds the default type at construction", () => {
  const r = createHarnessTypeRegistry();
  expect(r.get(DEFAULT_HARNESS_TYPE_ID)).toBe(defaultHarnessType);
  expect(r.list()).toEqual([defaultHarnessType]);
});

test("registry.resolve returns the default for undefined / unknown ids", () => {
  const r = createHarnessTypeRegistry();
  expect(r.resolve(undefined)).toBe(defaultHarnessType);
  expect(r.resolve("nope")).toBe(defaultHarnessType);
});

test("registry.register replaces an existing type with the same id", () => {
  const r = createHarnessTypeRegistry();
  const v1: HarnessType = { id: "coding", label: "v1" };
  const v2: HarnessType = { id: "coding", label: "v2" };
  r.register(v1);
  expect(r.get("coding")).toBe(v1);
  r.register(v2);
  expect(r.get("coding")).toBe(v2);
  // List keeps registration order; replacement does not duplicate.
  expect(r.list().filter((t) => t.id === "coding")).toHaveLength(1);
});

test("registry rejects types without an id", () => {
  const r = createHarnessTypeRegistry();
  expect(() => r.register({ id: "" })).toThrow();
});

// ── runProduceExtension ─────────────────────────────────────────────

test("runProduceExtension returns undefined when no hook is registered", async () => {
  const r = createHarnessTypeRegistry();
  const out = await runProduceExtension(r, DEFAULT_HARNESS_TYPE_ID, baseProduceInput());
  expect(out).toBeUndefined();
});

test("runProduceExtension returns {id, payload} when the hook produces a value", async () => {
  const r = createHarnessTypeRegistry();
  r.register({
    id: "coding",
    produceExtension: () => ({ branch: "feature/x" }),
  });
  const out = await runProduceExtension(r, "coding", baseProduceInput());
  expect(out).toEqual({ id: "coding", payload: { branch: "feature/x" } });
});

test("runProduceExtension swallows hook throws and returns undefined", async () => {
  const r = createHarnessTypeRegistry();
  r.register({
    id: "coding",
    produceExtension: () => {
      throw new Error("boom");
    },
  });
  const warnings: string[] = [];
  const out = await runProduceExtension(r, "coding", baseProduceInput(), {
    warn: (msg) => warnings.push(msg),
  });
  expect(out).toBeUndefined();
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain("coding");
});

test("runProduceExtension treats undefined return as no-extension", async () => {
  const r = createHarnessTypeRegistry();
  r.register({
    id: "coding",
    produceExtension: () => undefined,
  });
  const out = await runProduceExtension(r, "coding", baseProduceInput());
  expect(out).toBeUndefined();
});

// ── runConsumeExtension ─────────────────────────────────────────────

test("runConsumeExtension returns the packet unchanged when no hook is registered", async () => {
  const r = createHarnessTypeRegistry();
  const packet = basePacket();
  const out = await runConsumeExtension(
    r,
    baseHandoff({ harnessTypeId: DEFAULT_HARNESS_TYPE_ID }),
    packet,
  );
  expect(out).toBe(packet);
});

test("runConsumeExtension passes payload + priorHandoff to the hook and returns its packet", async () => {
  const r = createHarnessTypeRegistry();
  let captured: unknown = null;
  r.register({
    id: "coding",
    consumeExtension: (input) => {
      captured = input;
      return { ...input.packet, prompt: `${input.packet.prompt} + recap` };
    },
  });
  const handoff = baseHandoff({
    harnessTypeId: "coding",
    extensions: { coding: { branch: "feature/x" } },
  });
  const out = await runConsumeExtension(r, handoff, basePacket());
  expect(out.prompt).toBe("hello + recap");
  expect(captured).not.toBeNull();
  // @ts-expect-error — runtime-checked structure
  expect(captured.extension).toEqual({ branch: "feature/x" });
  // @ts-expect-error — runtime-checked structure
  expect(captured.priorHandoff).toBe(handoff);
});

test("runConsumeExtension calls the hook even with no extension entry (lets type inject content)", async () => {
  const r = createHarnessTypeRegistry();
  let extensionSeen: unknown = "not called";
  r.register({
    id: "coding",
    consumeExtension: (input) => {
      extensionSeen = input.extension;
      return input.packet;
    },
  });
  const handoff = baseHandoff({ harnessTypeId: "coding" }); // empty extensions
  await runConsumeExtension(r, handoff, basePacket());
  expect(extensionSeen).toBeUndefined();
});

test("runConsumeExtension rethrows hook throws as HandoffExtensionConsumeError", async () => {
  const r = createHarnessTypeRegistry();
  r.register({
    id: "coding",
    consumeExtension: () => {
      throw new Error("malformed extension");
    },
  });
  const handoff = baseHandoff({ harnessTypeId: "coding" });

  let caught: unknown = null;
  try {
    await runConsumeExtension(r, handoff, basePacket());
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(HandoffExtensionConsumeError);
  if (caught instanceof HandoffExtensionConsumeError) {
    expect(caught.harnessTypeId).toBe("coding");
    expect(caught.cause).toBeInstanceOf(Error);
  }
});

test("runConsumeExtension falls back to default type when handoff.harnessTypeId is undefined", async () => {
  const r = createHarnessTypeRegistry();
  // Default type has no consumeExtension, so packet passes through.
  const handoff = baseHandoff({ harnessTypeId: undefined });
  const packet = basePacket();
  const out = await runConsumeExtension(r, handoff, packet);
  expect(out).toBe(packet);
});
