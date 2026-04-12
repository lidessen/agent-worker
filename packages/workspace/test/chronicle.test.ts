import { test, expect } from "bun:test";
import { ChronicleStore } from "../src/context/stores/chronicle.ts";
import { MemoryStorage } from "../src/context/storage.ts";

function createStore() {
  const storage = new MemoryStorage();
  return new ChronicleStore(storage);
}

test("append and read entries in order", async () => {
  const store = createStore();

  const e1 = await store.append({
    author: "alice",
    category: "decision",
    content: "Use JSONL format",
  });
  const e2 = await store.append({ author: "bob", category: "plan", content: "Implement phase 1" });
  const e3 = await store.append({
    author: "alice",
    category: "milestone",
    content: "Phase 1 complete",
  });

  expect(e1.id).toBeTruthy();
  expect(e1.timestamp).toBeTruthy();
  expect(e1.author).toBe("alice");
  expect(e1.category).toBe("decision");
  expect(e1.content).toBe("Use JSONL format");

  const all = await store.read();
  expect(all).toHaveLength(3);
  expect(all[0]!.id).toBe(e1.id);
  expect(all[1]!.id).toBe(e2.id);
  expect(all[2]!.id).toBe(e3.id);
});

test("read with category filter", async () => {
  const store = createStore();

  await store.append({ author: "alice", category: "decision", content: "Decision 1" });
  await store.append({ author: "bob", category: "plan", content: "Plan 1" });
  await store.append({ author: "alice", category: "decision", content: "Decision 2" });

  const decisions = await store.read({ category: "decision" });
  expect(decisions).toHaveLength(2);
  expect(decisions[0]!.content).toBe("Decision 1");
  expect(decisions[1]!.content).toBe("Decision 2");

  const plans = await store.read({ category: "plan" });
  expect(plans).toHaveLength(1);
  expect(plans[0]!.content).toBe("Plan 1");
});

test("read with limit", async () => {
  const store = createStore();

  await store.append({ author: "alice", category: "insight", content: "First" });
  await store.append({ author: "bob", category: "insight", content: "Second" });
  await store.append({ author: "alice", category: "insight", content: "Third" });

  const limited = await store.read({ limit: 2 });
  expect(limited).toHaveLength(2);
  expect(limited[0]!.content).toBe("Second");
  expect(limited[1]!.content).toBe("Third");
});
