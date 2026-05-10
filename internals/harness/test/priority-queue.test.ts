import { test, expect, describe, beforeEach } from "bun:test";
import { InstructionQueue } from "@agent-worker/harness-coordination";
import type { Instruction } from "../src/types.ts";

describe("InstructionQueue", () => {
  let queue: InstructionQueue;

  function makeInstruction(
    agentName: string,
    priority: "immediate" | "normal" | "background",
    id?: string,
  ): Instruction {
    return {
      id: id ?? `instr_${Math.random().toString(36).slice(2)}`,
      agentName,
      messageId: "",
      channel: "",
      content: `${priority} task`,
      priority,
      enqueuedAt: new Date().toISOString(),
    };
  }

  beforeEach(() => {
    queue = new InstructionQueue();
  });

  test("dequeue returns null on empty queue", () => {
    expect(queue.dequeue("alice")).toBeNull();
  });

  test("dequeue returns higher priority first", () => {
    queue.enqueue(makeInstruction("alice", "background"));
    queue.enqueue(makeInstruction("alice", "immediate"));
    queue.enqueue(makeInstruction("alice", "normal"));

    const first = queue.dequeue("alice");
    expect(first!.priority).toBe("immediate");

    const second = queue.dequeue("alice");
    expect(second!.priority).toBe("normal");

    const third = queue.dequeue("alice");
    expect(third!.priority).toBe("background");
  });

  test("FIFO within same priority", () => {
    queue.enqueue(makeInstruction("alice", "normal", "n1"));
    queue.enqueue(makeInstruction("alice", "normal", "n2"));
    queue.enqueue(makeInstruction("alice", "normal", "n3"));

    expect(queue.dequeue("alice")!.id).toBe("n1");
    expect(queue.dequeue("alice")!.id).toBe("n2");
    expect(queue.dequeue("alice")!.id).toBe("n3");
  });

  test("agent isolation", () => {
    queue.enqueue(makeInstruction("alice", "normal", "a1"));
    queue.enqueue(makeInstruction("bob", "normal", "b1"));

    expect(queue.dequeue("alice")!.id).toBe("a1");
    expect(queue.dequeue("alice")).toBeNull();
    expect(queue.dequeue("bob")!.id).toBe("b1");
  });

  test("shouldYield returns true when immediate instruction is pending", () => {
    queue.enqueue(makeInstruction("alice", "immediate"));
    expect(queue.shouldYield("alice")).toBe(true);
    expect(queue.shouldYield("bob")).toBe(false);
  });

  test("size tracks total instructions", () => {
    expect(queue.size).toBe(0);
    queue.enqueue(makeInstruction("alice", "normal"));
    queue.enqueue(makeInstruction("bob", "immediate"));
    expect(queue.size).toBe(2);
    queue.dequeue("alice");
    expect(queue.size).toBe(1);
  });

  test("starvation protection promotes background tasks", () => {
    // Use a longer backgroundTtl so TTL pruning doesn't remove the item before promotion
    const q = new InstructionQueue({ backgroundTtl: 15 * 60 * 1000 });
    const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10min ago
    const bgInstr = makeInstruction("alice", "background");
    bgInstr.enqueuedAt = oldDate;

    q.enqueue(bgInstr);

    // Dequeue should promote this to normal (waited > maxBackgroundWait)
    const result = q.dequeue("alice");
    expect(result).not.toBeNull();
    expect(result!.priority).toBe("normal"); // promoted
  });

  test("bandwidth policy: forces normal after immediate quota", () => {
    // Custom queue with immediateQuota=2
    const q = new InstructionQueue({ immediateQuota: 2 });

    q.enqueue(makeInstruction("alice", "immediate", "i1"));
    q.enqueue(makeInstruction("alice", "immediate", "i2"));
    q.enqueue(makeInstruction("alice", "immediate", "i3"));
    q.enqueue(makeInstruction("alice", "normal", "n1"));

    expect(q.dequeue("alice")!.id).toBe("i1");
    expect(q.dequeue("alice")!.id).toBe("i2");
    // After 2 immediate, should force normal
    expect(q.dequeue("alice")!.id).toBe("n1");
    // Then back to immediate
    expect(q.dequeue("alice")!.id).toBe("i3");
  });

  // ── TTL pruning ──────────────────────────────────────────────────────

  test("TTL pruning removes expired background items on dequeue", () => {
    const q = new InstructionQueue({ backgroundTtl: 1000 }); // 1s TTL

    const expired = makeInstruction("alice", "background", "bg1");
    expired.enqueuedAt = new Date(Date.now() - 2000).toISOString(); // 2s ago

    const fresh = makeInstruction("alice", "background", "bg2");
    // fresh.enqueuedAt is now — within TTL

    q.enqueue(expired);
    q.enqueue(fresh);

    const result = q.dequeue("alice");
    expect(result).not.toBeNull();
    expect(result!.id).toBe("bg2"); // expired one was pruned
    expect(q.size).toBe(0);
  });

  test("TTL pruning does NOT remove immediate or normal items", () => {
    const q = new InstructionQueue({ backgroundTtl: 1000 });

    const oldImmediate = makeInstruction("alice", "immediate", "i1");
    oldImmediate.enqueuedAt = new Date(Date.now() - 5000).toISOString();

    const oldNormal = makeInstruction("alice", "normal", "n1");
    oldNormal.enqueuedAt = new Date(Date.now() - 5000).toISOString();

    q.enqueue(oldImmediate);
    q.enqueue(oldNormal);

    expect(q.dequeue("alice")!.id).toBe("i1");
    expect(q.dequeue("alice")!.id).toBe("n1");
  });

  // ── Max size cap ────────────────────────────────────────────────────

  test("maxSize drops oldest background item when full", () => {
    const q = new InstructionQueue({ maxSize: 3 });

    q.enqueue(makeInstruction("alice", "normal", "n1"));
    q.enqueue(makeInstruction("alice", "background", "bg1"));
    q.enqueue(makeInstruction("alice", "background", "bg2"));
    // Queue is full (3). Next enqueue should drop oldest background (bg1).
    q.enqueue(makeInstruction("alice", "normal", "n2"));

    expect(q.size).toBe(3);
    const all = q.listAll();
    const ids = all.map((i) => i.id);
    expect(ids).toContain("n1");
    expect(ids).toContain("bg2");
    expect(ids).toContain("n2");
    expect(ids).not.toContain("bg1"); // dropped
  });

  test("maxSize rejects new item when no background items to drop", () => {
    const q = new InstructionQueue({ maxSize: 2 });

    q.enqueue(makeInstruction("alice", "immediate", "i1"));
    q.enqueue(makeInstruction("alice", "normal", "n1"));
    // Queue is full with no background items — new item is rejected
    q.enqueue(makeInstruction("alice", "normal", "n2"));

    expect(q.size).toBe(2);
    const ids = q.listAll().map((i) => i.id);
    expect(ids).toContain("i1");
    expect(ids).toContain("n1");
    expect(ids).not.toContain("n2"); // rejected
  });

  test("peek does not remove instruction", () => {
    queue.enqueue(makeInstruction("alice", "normal", "n1"));
    const peeked = queue.peek("alice");
    expect(peeked!.id).toBe("n1");
    // Still there
    const dequeued = queue.dequeue("alice");
    expect(dequeued!.id).toBe("n1");
  });
});
