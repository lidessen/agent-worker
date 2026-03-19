#!/usr/bin/env bun
/**
 * Workspace A2A test harness.
 *
 * Usage:
 *   bun packages/workspace/test/a2a/workspace-harness.ts [phase1|phase2|phase3|all|T<N>]
 *
 * Phase 1 (T1-T13):  Infrastructure — no LLM needed
 * Phase 2 (T14-T17): Multi-agent — uses mock handlers or LLM
 * Phase 3 (T18-T19): Edge cases & invariants
 */

import {
  createWorkspace,
  createAgentTools,
  InstructionQueue,
  MemoryStorage,
  assemblePrompt,
  DEFAULT_SECTIONS,
  nanoid,
} from "../../src/index.ts";
import { createOrchestrator } from "agent-worker";

// ── Helpers ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
};

function assert(condition: boolean, msg = "assertion failed"): void {
  if (!condition) throw new Error(msg);
}

type TestFn = () => Promise<void>;

const tests = new Map<string, TestFn>();
const results: Array<{ id: string; status: "PASS" | "FAIL"; error?: string; ms: number }> = [];

function test(id: string, fn: TestFn): void {
  tests.set(id, fn);
}

async function run(ids: string[]): Promise<void> {
  for (const id of ids) {
    const fn = tests.get(id);
    if (!fn) {
      console.log(`${c.yellow}SKIP${c.reset} ${id} (not found)`);
      continue;
    }
    const t0 = performance.now();
    try {
      await fn();
      const ms = Math.round(performance.now() - t0);
      results.push({ id, status: "PASS", ms });
      console.log(`${c.green}PASS${c.reset} ${id} ${c.dim}(${ms}ms)${c.reset}`);
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id, status: "FAIL", error: msg, ms });
      console.log(`${c.red}FAIL${c.reset} ${id} ${c.dim}(${ms}ms)${c.reset} — ${msg}`);
    }
  }

  // Summary
  console.log("\n" + "─".repeat(60));
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const total = results.length;
  const color = failed > 0 ? c.red : c.green;
  console.log(
    `${color}${passed}/${total} passed${c.reset}` +
      (failed > 0 ? `, ${c.red}${failed} failed${c.reset}` : ""),
  );

  if (failed > 0) {
    console.log(`\n${c.red}Failed tests:${c.reset}`);
    for (const r of results.filter((r) => r.status === "FAIL")) {
      console.log(`  ${r.id}: ${r.error}`);
    }
    process.exit(1);
  }
}

// ── Phase 1: Infrastructure ──────────────────────────────────────────────

test("T1", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general", "design", "code-review"],
    defaultChannel: "general",
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  const channels = ws.contextProvider.channels.listChannels();
  assert(channels.includes("general"), "missing general channel");
  assert(channels.includes("design"), "missing design channel");
  assert(channels.includes("code-review"), "missing code-review channel");

  const aliceChannels = ws.getAgentChannels("alice");
  const bobChannels = ws.getAgentChannels("bob");
  assert(aliceChannels.has("general"), "alice not in general");
  assert(bobChannels.has("general"), "bob not in general");

  await ws.shutdown();
});

test("T2", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.send({ channel: "general", from: "alice", content: "Hello team!" });
  await ws.contextProvider.send({ channel: "general", from: "bob", content: "Hi alice!" });
  await ws.contextProvider.send({
    channel: "general",
    from: "alice",
    content: "@bob Can you review?",
  });

  const msgs = await ws.contextProvider.channels.read("general");
  assert(msgs.length === 3, `expected 3 messages, got ${msgs.length}`);
  assert(msgs[0]!.from === "alice", "msg[0] from alice");
  assert(msgs[0]!.content === "Hello team!", "msg[0] content");
  assert(msgs[1]!.from === "bob", "msg[1] from bob");
  assert(msgs[2]!.mentions.includes("bob"), "msg[2] mentions bob");
  assert(new Set(msgs.map((m) => m.id)).size === 3, "unique IDs");

  await ws.shutdown();
});

test("T3", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.send({
    channel: "general",
    from: "alice",
    content: "@bob please review the PR",
  });

  const bobInbox = await ws.contextProvider.inbox.peek("bob");
  assert(bobInbox.length === 1, `bob should have 1 entry, got ${bobInbox.length}`);
  assert(bobInbox[0]!.state === "pending", "should be pending");
  assert(bobInbox[0]!.channel === "general", "channel should be general");

  const aliceInbox = await ws.contextProvider.inbox.peek("alice");
  assert(aliceInbox.length === 0, "sender should not self-receive");

  const msg = await ws.contextProvider.channels.getMessage("general", bobInbox[0]!.messageId);
  assert(msg !== null, "message should be resolvable");
  assert(msg!.content.includes("review the PR"), "content matches");

  await ws.shutdown();
});

test("T4", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.send({
    channel: "general",
    from: "alice",
    content: "@bob task 1 — complex",
  });
  await ws.contextProvider.send({
    channel: "general",
    from: "alice",
    content: "@bob task 2 — simple ack",
  });
  await ws.contextProvider.send({
    channel: "general",
    from: "alice",
    content: "@bob task 3 — medium",
  });

  const inbox = await ws.contextProvider.inbox.peek("bob");
  assert(inbox.length === 3, "3 inbox entries");

  const [task1, task2, task3] = inbox;

  // Selective ack: process task2 first (out of order)
  await ws.contextProvider.inbox.ack("bob", task2!.messageId);

  // Defer task1
  const future = new Date(Date.now() + 300_000).toISOString();
  await ws.contextProvider.inbox.defer("bob", task1!.messageId, future);

  const remaining = await ws.contextProvider.inbox.peek("bob");
  assert(remaining.length === 1, `expected 1 remaining, got ${remaining.length}`);
  assert(remaining[0]!.messageId === task3!.messageId, "only task3 pending");
  assert(
    !(await ws.contextProvider.inbox.hasEntry("bob", task2!.messageId)),
    "acked entry removed",
  );

  await ws.shutdown();
});

test("T5", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice"],
    storage: new MemoryStorage(),
    maxMessageLength: 100,
  });

  const longContent = "x".repeat(200);
  let threw = false;
  try {
    await ws.contextProvider.send({ channel: "general", from: "alice", content: longContent });
  } catch (err) {
    threw = true;
    const msg = err instanceof Error ? err.message : String(err);
    assert(msg.includes("too long"), "error should mention too long");
    assert(msg.includes("resource_create"), "error should hint at resource_create");
  }
  assert(threw, "send should throw on oversize message");

  await ws.shutdown();
});

test("T6", async () => {
  const queue = new InstructionQueue();

  queue.enqueue({
    id: nanoid(),
    agentName: "alice",
    messageId: "m1",
    channel: "general",
    content: "bg",
    priority: "background",
    enqueuedAt: new Date().toISOString(),
  });
  queue.enqueue({
    id: nanoid(),
    agentName: "alice",
    messageId: "m2",
    channel: "general",
    content: "normal",
    priority: "normal",
    enqueuedAt: new Date().toISOString(),
  });
  queue.enqueue({
    id: nanoid(),
    agentName: "alice",
    messageId: "m3",
    channel: "general",
    content: "urgent",
    priority: "immediate",
    enqueuedAt: new Date().toISOString(),
  });

  assert(queue.size === 3, "queue size 3");

  const first = queue.dequeue("alice");
  const second = queue.dequeue("alice");
  const third = queue.dequeue("alice");

  assert(first?.priority === "immediate", "immediate first");
  assert(second?.priority === "normal", "normal second");
  assert(third?.priority === "background", "background third");
  assert(queue.dequeue("alice") === null, "queue empty");
});

test("T7", async () => {
  const queue = new InstructionQueue({ immediateQuota: 4, normalQuota: 6 });

  queue.enqueue({
    id: nanoid(),
    agentName: "alice",
    messageId: "bg",
    channel: "general",
    content: "background",
    priority: "background",
    enqueuedAt: new Date().toISOString(),
  });

  for (let i = 0; i < 6; i++) {
    queue.enqueue({
      id: nanoid(),
      agentName: "alice",
      messageId: `imm-${i}`,
      channel: "general",
      content: `immediate-${i}`,
      priority: "immediate",
      enqueuedAt: new Date().toISOString(),
    });
  }

  // Also add some normal tasks so bandwidth policy can kick in
  for (let i = 0; i < 2; i++) {
    queue.enqueue({
      id: nanoid(),
      agentName: "alice",
      messageId: `norm-${i}`,
      channel: "general",
      content: `normal-${i}`,
      priority: "normal",
      enqueuedAt: new Date().toISOString(),
    });
  }

  const order: string[] = [];
  let item;
  while ((item = queue.dequeue("alice")) !== null) {
    order.push(item.priority);
  }

  const bgIdx = order.indexOf("background");
  assert(bgIdx >= 0, "background must be served");
  // With immediateQuota=4, after 4 immediates a normal is forced,
  // then background should appear before all tasks are consumed
  assert(bgIdx < order.length - 1, `background not served last (at ${bgIdx}/${order.length})`);
});

test("T8", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob", "charlie"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.send({
    channel: "general",
    from: "alice",
    content: "Secret message for you",
    to: "bob",
  });

  const bobInbox = await ws.contextProvider.inbox.peek("bob");
  assert(bobInbox.length === 1, "bob should receive DM");
  assert(bobInbox[0]!.priority === "immediate", "DM should be immediate");

  const charlieInbox = await ws.contextProvider.inbox.peek("charlie");
  assert(charlieInbox.length === 0, "charlie should not see DM");

  await ws.shutdown();
});

test("T9", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice"],
    storage: new MemoryStorage(),
  });

  const docs = ws.contextProvider.documents;

  await docs.create("spec.md", "# Spec v1", "alice");
  assert((await docs.read("spec.md")) === "# Spec v1", "create + read");

  await docs.write("spec.md", "# Spec v2", "alice");
  assert((await docs.read("spec.md")) === "# Spec v2", "write overwrites");

  await docs.append("spec.md", "\n## Section 2", "alice");
  assert((await docs.read("spec.md")) === "# Spec v2\n## Section 2", "append works");

  await docs.create("readme.md", "# README", "alice");
  const list = await docs.list();
  assert(list.length === 2, "2 documents");
  assert(list.includes("spec.md"), "has spec.md");
  assert(list.includes("readme.md"), "has readme.md");

  assert((await docs.read("nope.md")) === null, "missing returns null");

  await ws.shutdown();
});

test("T10", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice"],
    storage: new MemoryStorage(),
  });

  await ws.eventLog.log("alice", "tool_call", "called bash", {
    toolCall: { name: "bash", args: { cmd: "ls" }, result: "file.txt" },
  });
  await ws.eventLog.log("alice", "system", "Agent started");
  await ws.eventLog.log("alice", "debug", "Verbose info");

  const timeline = await ws.contextProvider.timeline.read("alice");
  assert(timeline.length === 3, "3 timeline entries");
  assert(timeline[0]!.kind === "tool_call", "tool_call kind");
  assert(timeline[1]!.kind === "system", "system kind");
  assert(timeline[2]!.kind === "debug", "debug kind");

  let threw = false;
  try {
    await ws.eventLog.log("alice", "message", "should fail");
  } catch {
    threw = true;
  }
  assert(threw, "logging 'message' to EventLog must throw");

  await ws.shutdown();
});

test("T11", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.status.set("alice", "running", "Reviewing PR");
  await ws.contextProvider.status.set("bob", "idle");

  const alice = await ws.contextProvider.status.get("alice");
  assert(alice?.status === "running", "alice running");
  assert(alice?.currentTask === "Reviewing PR", "alice task");

  const bob = await ws.contextProvider.status.get("bob");
  assert(bob?.status === "idle", "bob idle");

  const all = await ws.contextProvider.status.getAll();
  assert(all.length === 2, "2 agents");

  await ws.shutdown();
});

test("T12", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  const { tools: aliceTools } = createAgentTools("alice", ws);
  const { tools: bobTools } = createAgentTools("bob", ws);

  const sendResult = await aliceTools.channel_send!({
    channel: "general",
    content: "@bob can you help?",
  });
  assert(sendResult.includes("Sent"), "send confirmed");

  const inboxResult = await bobTools.my_inbox!({});
  assert(inboxResult.includes("can you help"), "inbox shows message");

  const bobInbox = await ws.contextProvider.inbox.peek("bob");
  await bobTools.my_inbox_ack!({ message_id: bobInbox[0]!.messageId });

  const afterAck = await bobTools.my_inbox!({});
  assert(
    afterAck.toLowerCase().includes("empty") || afterAck.includes("0 pending"),
    "inbox empty after ack",
  );

  const listResult = await aliceTools.channel_list!({});
  assert(listResult.includes("general"), "channel listed");

  await ws.shutdown();
});

test("T13", async () => {
  const ws1 = await createWorkspace({
    name: "review",
    tag: "pr-123",
    channels: ["general"],
    agents: ["reviewer"],
    storage: new MemoryStorage(),
  });

  const ws2 = await createWorkspace({
    name: "review",
    tag: "pr-456",
    channels: ["general"],
    agents: ["reviewer"],
    storage: new MemoryStorage(),
  });

  await ws1.contextProvider.send({
    channel: "general",
    from: "user",
    content: "@reviewer check PR-123",
  });

  const inbox1 = await ws1.contextProvider.inbox.peek("reviewer");
  assert(inbox1.length === 1, "ws1 reviewer has message");

  const inbox2 = await ws2.contextProvider.inbox.peek("reviewer");
  assert(inbox2.length === 0, "ws2 reviewer isolated");

  assert(ws1.tag === "pr-123", "ws1 tag");
  assert(ws2.tag === "pr-456", "ws2 tag");

  await ws1.shutdown();
  await ws2.shutdown();
});

// ── Phase 2: Multi-Agent ─────────────────────────────────────────────────

test("T14", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  const processed: string[] = [];

  const aliceLoop = createOrchestrator({
    name: "alice",
    provider: ws.contextProvider,
    queue: ws.instructionQueue,
    eventLog: ws.eventLog,
    pollInterval: 500,
    onInstruction: async (_prompt, instruction) => {
      processed.push(`alice: ${instruction.content.slice(0, 40)}`);
      await ws.contextProvider.send({
        channel: "general",
        from: "alice",
        content: "@bob Got it! Processing.",
      });
    },
  });

  const bobLoop = createOrchestrator({
    name: "bob",
    provider: ws.contextProvider,
    queue: ws.instructionQueue,
    eventLog: ws.eventLog,
    pollInterval: 500,
    onInstruction: async (_prompt, instruction) => {
      processed.push(`bob: ${instruction.content.slice(0, 40)}`);
      // Bob replies but doesn't mention anyone → no loop
    },
  });

  await aliceLoop.start();
  await bobLoop.start();

  // Kickoff
  await ws.contextProvider.send({
    channel: "general",
    from: "user",
    content: "@alice Please coordinate with bob",
  });

  // Wait for processing
  await new Promise((r) => setTimeout(r, 3000));

  await aliceLoop.stop();
  await bobLoop.stop();

  const msgs = await ws.contextProvider.channels.read("general");
  assert(msgs.length >= 2, `expected >= 2 messages, got ${msgs.length}`);
  assert(processed.length >= 1, `at least 1 processed, got ${processed.length}`);

  await ws.shutdown();
});

test("T15", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general", "design", "code-review"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  const { tools: aliceTools } = createAgentTools("alice", ws);
  const { tools: bobTools } = createAgentTools("bob", ws);
  await aliceTools.channel_join!({ channel: "design" });
  await bobTools.channel_join!({ channel: "code-review" });

  await ws.contextProvider.send({
    channel: "design",
    from: "user",
    content: "@alice review the design",
  });
  await ws.contextProvider.send({
    channel: "code-review",
    from: "user",
    content: "@bob review the code",
  });

  const aliceInbox = await ws.contextProvider.inbox.peek("alice");
  const bobInbox = await ws.contextProvider.inbox.peek("bob");

  assert(aliceInbox.length === 1, "alice has 1");
  assert(aliceInbox[0]!.channel === "design", "alice from design");
  assert(bobInbox.length === 1, "bob has 1");
  assert(bobInbox[0]!.channel === "code-review", "bob from code-review");

  await ws.shutdown();
});

test("T16", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice", "bob"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.status.set("alice", "running", "Reviewing PR");
  await ws.contextProvider.status.set("bob", "idle");
  await ws.contextProvider.documents.create("spec.md", "# Project Spec", "alice");
  await ws.contextProvider.send({
    channel: "general",
    from: "bob",
    content: "@alice please check this",
  });

  const inboxEntries = await ws.contextProvider.inbox.peek("alice");

  const prompt = await assemblePrompt(DEFAULT_SECTIONS, {
    agentName: "alice",
    instructions: "You are a code reviewer.",
    provider: ws.contextProvider,
    inboxEntries,
    currentInstruction: "please check this",
  });

  assert(prompt.includes("alice"), "prompt includes agent name");
  assert(prompt.includes("code reviewer"), "prompt includes instructions");
  assert(prompt.includes("bob"), "prompt includes team member");
  assert(prompt.includes("spec.md"), "prompt includes doc");
  assert(prompt.includes("please check this"), "prompt includes instruction");

  await ws.shutdown();
});

test("T17", async () => {
  const queue = new InstructionQueue();

  queue.enqueue({
    id: nanoid(),
    agentName: "alice",
    messageId: "urgent",
    channel: "general",
    content: "urgent fix",
    priority: "immediate",
    enqueuedAt: new Date().toISOString(),
  });

  assert(queue.shouldYield("alice") === true, "should yield for immediate");

  const queue2 = new InstructionQueue();
  queue2.enqueue({
    id: nanoid(),
    agentName: "alice",
    messageId: "normal",
    channel: "general",
    content: "normal task",
    priority: "normal",
    enqueuedAt: new Date().toISOString(),
  });
  assert(queue2.shouldYield("alice") === false, "should not yield for normal");
});

// ── Phase 3: Edge Cases ──────────────────────────────────────────────────

test("T18", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.send({ channel: "general", from: "alice", content: "Original message" });
  const msgs1 = await ws.contextProvider.channels.read("general");
  const originalId = msgs1[0]!.id;
  const originalContent = msgs1[0]!.content;

  await ws.contextProvider.send({ channel: "general", from: "alice", content: "Second message" });
  const msgs2 = await ws.contextProvider.channels.read("general");
  assert(msgs2[0]!.id === originalId, "ID must not change");
  assert(msgs2[0]!.content === originalContent, "content must not change");
  assert(msgs2.length === 2, "append only");

  const store = ws.contextProvider.channels;
  assert(!("update" in store), "no update method");
  assert(!("delete" in store), "no delete method");

  await ws.shutdown();
});

test("T19", async () => {
  const ws = await createWorkspace({
    name: "test",
    channels: ["general"],
    agents: ["alice"],
    storage: new MemoryStorage(),
  });

  await ws.contextProvider.send({ channel: "general", from: "user", content: "@alice old task 1" });
  await ws.contextProvider.send({ channel: "general", from: "user", content: "@alice old task 2" });

  const before = await ws.contextProvider.inbox.peek("alice");
  assert(before.length === 2, "2 stale entries");

  await ws.contextProvider.inbox.markRunStart("alice");

  const after = await ws.contextProvider.inbox.peek("alice");
  assert(after.length === 0, "stale entries cleared");

  await ws.contextProvider.send({ channel: "general", from: "user", content: "@alice new task" });
  const fresh = await ws.contextProvider.inbox.peek("alice");
  assert(fresh.length === 1, "new messages delivered after epoch");

  await ws.shutdown();
});

// ── Main ─────────────────────────────────────────────────────────────────

const phase1 = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "T13"];
const phase2 = ["T14", "T15", "T16", "T17"];
const phase3 = ["T18", "T19"];
const all = [...phase1, ...phase2, ...phase3];

const arg = process.argv[2] ?? "all";

let toRun: string[];
switch (arg) {
  case "phase1":
    toRun = phase1;
    break;
  case "phase2":
    toRun = phase2;
    break;
  case "phase3":
    toRun = phase3;
    break;
  case "all":
    toRun = all;
    break;
  default:
    if (arg.startsWith("T")) {
      toRun = [arg];
    } else {
      console.error(`Usage: workspace-harness.ts [phase1|phase2|phase3|all|T<N>]`);
      process.exit(1);
    }
}

console.log(`\n${c.bold}Workspace A2A Tests${c.reset} — running ${toRun.length} test(s)\n`);
await run(toRun);
