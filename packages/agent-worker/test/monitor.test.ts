import { afterEach, describe, expect, test } from "bun:test";
import { EventBus } from "@agent-worker/shared";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HarnessRegistry } from "../src/harness-registry.ts";
import { Monitor } from "../src/monitor/index.ts";

let dataDir: string | null = null;

function tmpDataDir(): string {
  dataDir = mkdtempSync(join(tmpdir(), "aw-monitor-test-"));
  return dataDir;
}

afterEach(() => {
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
    dataDir = null;
  }
});

describe("Monitor authorization tracking", () => {
  test("counts authorization pauses as pending-on-auth samples", async () => {
    const registry = new HarnessRegistry(tmpDataDir());
    const bus = new EventBus();
    const monitor = new Monitor(registry, bus, { tickMs: 5 });

    monitor.start();
    try {
      bus.emit({
        type: "harness.authorization_required",
        source: "harness",
        harness: "dev",
        agent: "codex",
        reason: "authentication failed",
      });

      await Bun.sleep(20);
      const pending = monitor.snapshot();
      expect(pending.c1.current.pendingOnAuth).toBe(1);
      expect(pending.c1.current.activeRequirements).toBe(1);
      expect(pending.c3?.totals.authorization).toBe(1);
      expect(pending.c4?.windowSamples).toBeGreaterThan(0);

      bus.emit({
        type: "harness.authorization_resolved",
        source: "harness",
        harness: "dev",
        agent: "codex",
        reason: "agent resumed",
      });

      await Bun.sleep(20);
      expect(monitor.snapshot().c1.current.pendingOnAuth).toBe(0);
    } finally {
      monitor.stop();
    }
  });

  test("clears a pending authorization when the same agent runs again", async () => {
    const registry = new HarnessRegistry(tmpDataDir());
    const bus = new EventBus();
    const monitor = new Monitor(registry, bus, { tickMs: 5 });

    monitor.start();
    try {
      bus.emit({
        type: "harness.authorization_required",
        source: "harness",
        harness: "dev",
        agent: "codex",
      });
      bus.emit({
        type: "harness.agent_run_start",
        source: "harness",
        harness: "dev",
        agent: "codex",
      });

      await Bun.sleep(20);
      expect(monitor.snapshot().c1.current.pendingOnAuth).toBe(0);
    } finally {
      monitor.stop();
    }
  });
});
