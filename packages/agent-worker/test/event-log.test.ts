import { test, expect, describe } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync } from "node:fs";
import { DaemonEventLog } from "../src/event-log.ts";

function tmpDataDir(): string {
  const dir = join(tmpdir(), `aw-log-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("DaemonEventLog", () => {
  test("initializes empty", async () => {
    const log = new DaemonEventLog(tmpDataDir());
    await log.init();

    const { entries, cursor } = await log.read(0);
    expect(entries).toEqual([]);
    expect(cursor).toBe(0);
  });

  test("appends and reads events", async () => {
    const log = new DaemonEventLog(tmpDataDir());
    await log.init();

    log.append("daemon_started", { port: 3000 });

    // Wait for async write to complete
    await Bun.sleep(50);

    const { entries, cursor } = await log.read(0);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.type).toBe("daemon_started");
    expect((entries[0] as any).port).toBe(3000);
    expect(cursor).toBeGreaterThan(0);
  });

  test("cursor-based incremental reads", async () => {
    const log = new DaemonEventLog(tmpDataDir());
    await log.init();

    log.append("daemon_started");
    await Bun.sleep(50);

    const first = await log.read(0);
    expect(first.entries).toHaveLength(1);

    log.append("agent_created", { agent: "alice" });
    await Bun.sleep(50);

    const second = await log.read(first.cursor);
    expect(second.entries).toHaveLength(1);
    expect(second.entries[0]!.type).toBe("agent_created");
  });

  test("init preserves existing event history", async () => {
    const dataDir = tmpDataDir();
    const log1 = new DaemonEventLog(dataDir);
    await log1.init();
    log1.append("daemon_started", { port: 3000 });

    const original = readFileSync(log1.path, "utf-8");
    expect(original).toContain("daemon_started");

    const log2 = new DaemonEventLog(dataDir);
    await log2.init();

    const afterRestart = readFileSync(log2.path, "utf-8");
    expect(afterRestart).toBe(original);

    const { entries } = await log2.read(0);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.type).toBe("daemon_started");
  });
});
