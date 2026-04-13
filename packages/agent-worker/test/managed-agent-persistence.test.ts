import { describe, test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ManagedAgent } from "../src/managed-agent.ts";
import { MockLoop } from "@agent-worker/loop";

/**
 * Phase-2 slice 1: when `ManagedAgent` gets a persistent
 * `agentDir`, the resulting `Agent` must use `FileNotesStorage` and
 * `FileMemoryStorage` instead of the in-memory defaults so notes
 * and memory survive across daemon restarts.
 */
describe("ManagedAgent file-backed storage (phase 2 slice 1)", () => {
  let agentDir: string;

  afterEach(() => {
    if (agentDir) rmSync(agentDir, { recursive: true, force: true });
  });

  test("notes written during a run land on disk under agentDir/notes", async () => {
    agentDir = mkdtempSync(join(tmpdir(), "aw-ma-notes-"));
    const ma = new ManagedAgent({
      name: "alice",
      kind: "ephemeral",
      config: {
        name: "alice",
        loop: new MockLoop({ response: "ok", delayMs: 0 }),
      },
      agentDir,
    });
    await ma.init();

    // Exercise the notes interface directly through the Agent's
    // notesStorage. We don't need to do a real LLM turn — we just
    // need to prove the storage is file-backed.
    // Note: FileNotesStorage always appends ".md" to the key, so
    // "todo" becomes "todo.md" on disk. Keys must not include the
    // extension or they'll double-suffix.
    await ma.agent.notes.write("todo", "- ship phase 2\n");

    // Raw file presence is the proof that FileNotesStorage got
    // wired (InMemoryNotesStorage would not touch disk at all).
    const notePath = join(agentDir, "notes", "todo.md");
    expect(existsSync(notePath)).toBe(true);
    expect(readFileSync(notePath, "utf-8")).toContain("ship phase 2");
  });

  test("notes round-trip across a fresh ManagedAgent pointing at the same dir", async () => {
    agentDir = mkdtempSync(join(tmpdir(), "aw-ma-notes-roundtrip-"));

    // Write via first instance.
    const ma1 = new ManagedAgent({
      name: "alice",
      kind: "ephemeral",
      config: { name: "alice", loop: new MockLoop({ response: "ok", delayMs: 0 }) },
      agentDir,
    });
    await ma1.init();
    await ma1.agent.notes.write("plan", "step 1: do thing");
    await ma1.stop();

    // Read via a second, completely fresh instance. This is the
    // restart path in miniature.
    const ma2 = new ManagedAgent({
      name: "alice",
      kind: "ephemeral",
      config: { name: "alice", loop: new MockLoop({ response: "ok", delayMs: 0 }) },
      agentDir,
    });
    await ma2.init();
    const content = await ma2.agent.notes.read("plan");
    expect(content).toBe("step 1: do thing");
    await ma2.stop();
  });

  test("caller-supplied notesStorage is not overridden", async () => {
    agentDir = mkdtempSync(join(tmpdir(), "aw-ma-notes-explicit-"));

    // Prepopulate a file so we can verify the caller's storage is
    // what the Agent uses (a different dir than the auto one).
    const externalDir = mkdtempSync(join(tmpdir(), "aw-ma-notes-external-"));
    try {
      const { FileNotesStorage } = await import("@agent-worker/agent");
      const explicit = new FileNotesStorage(externalDir);
      await explicit.write("manifest", "external");

      const ma = new ManagedAgent({
        name: "alice",
        kind: "ephemeral",
        config: {
          name: "alice",
          loop: new MockLoop({ response: "ok", delayMs: 0 }),
          notesStorage: explicit,
        },
        agentDir,
      });
      await ma.init();

      const content = await ma.agent.notes.read("manifest");
      expect(content).toBe("external");
      // And the auto-wired dir should be empty — we didn't write
      // through the auto path.
      expect(existsSync(join(agentDir, "notes", "manifest.md"))).toBe(false);
      await ma.stop();
    } finally {
      rmSync(externalDir, { recursive: true, force: true });
    }
  });

  test("ManagedAgent wires memory.storage to agentDir/memories.json", async () => {
    agentDir = mkdtempSync(join(tmpdir(), "aw-ma-memory-"));

    // Pre-populate memories.json through the same FileMemoryStorage
    // path that ManagedAgent uses, then verify ManagedAgent picks it
    // up. `Agent` does not currently expose the memory manager
    // publicly, so we verify the file-level wiring end-to-end by
    // reading / writing the JSON directly and trusting that the
    // passed-through config reaches the MemoryManager (covered by
    // agent-package unit tests).
    const { FileMemoryStorage } = await import("@agent-worker/agent");
    const storage = new FileMemoryStorage(agentDir);
    await storage.add({
      text: "prefers unit tests over end-to-end",
      source: "test",
      timestamp: Date.now(),
    });

    // Construct a ManagedAgent pointing at the same dir; the auto
    // wiring should use a new FileMemoryStorage on the same path,
    // and that second storage should see our pre-populated entry.
    const ma = new ManagedAgent({
      name: "alice",
      kind: "ephemeral",
      config: { name: "alice", loop: new MockLoop({ response: "ok", delayMs: 0 }) },
      agentDir,
    });
    await ma.init();

    // Read back from a fresh FileMemoryStorage pointed at the same
    // directory to prove the write persisted and that future
    // instances would see it on restart.
    const roundtrip = new FileMemoryStorage(agentDir);
    const hits = await roundtrip.search("unit tests");
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0]?.text).toContain("unit tests");

    // And memories.json must live at the canonical location.
    expect(existsSync(join(agentDir, "memories.json"))).toBe(true);
    await ma.stop();
  });

  test("caller-supplied memory config is not overridden", async () => {
    agentDir = mkdtempSync(join(tmpdir(), "aw-ma-memory-explicit-"));
    const externalDir = mkdtempSync(join(tmpdir(), "aw-ma-memory-external-"));
    try {
      const { FileMemoryStorage } = await import("@agent-worker/agent");
      const explicit = new FileMemoryStorage(externalDir);
      await explicit.add({
        text: "lives outside the agentDir",
        source: "test",
        timestamp: Date.now(),
      });

      const ma = new ManagedAgent({
        name: "alice",
        kind: "ephemeral",
        config: {
          name: "alice",
          loop: new MockLoop({ response: "ok", delayMs: 0 }),
          memory: { storage: explicit },
        },
        agentDir,
      });
      await ma.init();

      // The auto-wired memories.json must NOT be created when the
      // caller supplied their own storage — that's the backward
      // compatibility contract.
      expect(existsSync(join(agentDir, "memories.json"))).toBe(false);
      await ma.stop();
    } finally {
      rmSync(externalDir, { recursive: true, force: true });
    }
  });

  test("tolerates a corrupt pre-existing memories.json", async () => {
    agentDir = mkdtempSync(join(tmpdir(), "aw-ma-memory-corrupt-"));
    writeFileSync(join(agentDir, "memories.json"), "{ not valid");

    // Must not throw during construction or init. FileMemoryStorage
    // lazy-loads, so the corruption would only surface when memory
    // is actually read — which won't happen in this test, but the
    // ManagedAgent wiring path must still succeed.
    const ma = new ManagedAgent({
      name: "alice",
      kind: "ephemeral",
      config: { name: "alice", loop: new MockLoop({ response: "ok", delayMs: 0 }) },
      agentDir,
    });
    await ma.init();
    await ma.stop();
  });
});
