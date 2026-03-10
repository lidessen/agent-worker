import { test, expect, describe, beforeEach } from "bun:test";
import { InstructionQueue } from "../src/loop/priority-queue.ts";
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
    const oldDate = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10min ago
    const bgInstr = makeInstruction("alice", "background");
    bgInstr.enqueuedAt = oldDate;

    queue.enqueue(bgInstr);

    // Dequeue should promote this to normal (waited > maxBackgroundWait)
    const result = queue.dequeue("alice");
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

  test("peek does not remove instruction", () => {
    queue.enqueue(makeInstruction("alice", "normal", "n1"));
    const peeked = queue.peek("alice");
    expect(peeked!.id).toBe("n1");
    // Still there
    const dequeued = queue.dequeue("alice");
    expect(dequeued!.id).toBe("n1");
  });
});
