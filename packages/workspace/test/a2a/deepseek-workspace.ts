#!/usr/bin/env bun
/**
 * Workspace A2A test with DeepSeek backend.
 *
 * Tests multi-agent collaboration using DeepSeek LLM via AI SDK.
 *
 * Usage:
 *   DEEPSEEK_API_KEY=sk-... bun packages/workspace/test/a2a/deepseek-workspace.ts
 */

import {
  createWorkspace,
  createWiredLoop,
  createAgentTools,
  MemoryStorage,
} from "../../src/index.ts";
import type { Instruction } from "../../src/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function assert(condition: boolean, msg = "assertion failed"): void {
  if (!condition) throw new Error(msg);
}

// ── DeepSeek LLM handler ────────────────────────────────────────────────

async function createDeepSeekHandler(agentName: string, ws: any) {
  const { deepseek } = await import("@ai-sdk/deepseek");
  const { generateText } = await import("ai");

  const model = deepseek("deepseek-chat");
  const { tools: _tools } = createAgentTools(agentName, ws);

  return async function onInstruction(prompt: string, instruction: Instruction) {
    console.log(
      `${c.cyan}[${agentName}]${c.reset} Processing: ${instruction.content.slice(0, 80)}...`,
    );

    try {
      const result = await generateText({
        model,
        system: prompt,
        prompt: instruction.content,
        maxOutputTokens: 500,
      });

      console.log(`${c.cyan}[${agentName}]${c.reset} Response: ${result.text.slice(0, 120)}`);
      console.log(`${c.dim}  tokens: ${result.usage?.totalTokens ?? "?"}${c.reset}`);

      // If the LLM mentions sending a message, auto-send to channel
      if (result.text.length > 0) {
        await ws.contextProvider.send({
          channel: "general",
          from: agentName,
          content: result.text.slice(0, 500),
        });
      }
    } catch (err) {
      console.log(`${c.red}[${agentName}] Error: ${err}${c.reset}`);
      throw err;
    }
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

async function testPreflight(): Promise<void> {
  console.log(`\n${c.bold}T-DS1: DeepSeek Preflight${c.reset}`);

  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not set");
  }

  // Quick API check
  const { deepseek } = await import("@ai-sdk/deepseek");
  const { generateText } = await import("ai");

  const result = await generateText({
    model: deepseek("deepseek-chat"),
    prompt: "Reply with exactly: DEEPSEEK_OK",
    maxOutputTokens: 50,
  });

  console.log(`  Response: ${result.text}`);
  assert(result.text.includes("DEEPSEEK_OK"), "DeepSeek should respond with marker");
  console.log(`${c.green}PASS${c.reset} T-DS1`);
}

async function testSingleAgentWorkspace(): Promise<void> {
  console.log(`\n${c.bold}T-DS2: Single Agent in Workspace${c.reset}`);

  const ws = await createWorkspace({
    name: "deepseek-test",
    channels: ["general"],
    agents: ["assistant"],
    storage: new MemoryStorage(),
  });

  const handler = await createDeepSeekHandler("assistant", ws);

  const loop = createWiredLoop({
    name: "assistant",
    instructions:
      "You are a helpful assistant. When you receive a message, respond concisely. Always include the word ACKNOWLEDGED in your response.",
    runtime: ws,
    pollInterval: 1000,
    onInstruction: handler,
  });

  await loop.start();

  // Send a message
  await ws.contextProvider.send({
    channel: "general",
    from: "user",
    content: "@assistant What is 2+2? Remember to include ACKNOWLEDGED.",
  });

  // Wait for processing
  await new Promise((r) => setTimeout(r, 15000));

  await loop.stop();

  const msgs = await ws.contextProvider.channels.read("general");
  console.log(`  Channel messages: ${msgs.length}`);
  for (const m of msgs) {
    console.log(`  ${c.dim}${m.from}:${c.reset} ${m.content.slice(0, 100)}`);
  }

  assert(msgs.length >= 2, `expected >= 2 messages, got ${msgs.length}`);

  // Check that agent responded
  const agentMsgs = msgs.filter((m) => m.from === "assistant");
  assert(agentMsgs.length >= 1, "assistant should have responded");

  await ws.shutdown();
  console.log(`${c.green}PASS${c.reset} T-DS2`);
}

async function testTwoAgentCollaboration(): Promise<void> {
  console.log(`\n${c.bold}T-DS3: Two-Agent Collaboration${c.reset}`);

  const ws = await createWorkspace({
    name: "deepseek-collab",
    channels: ["general"],
    agents: ["planner", "executor"],
    storage: new MemoryStorage(),
  });

  let plannerProcessed = false;
  let executorProcessed = false;

  const plannerLoop = createWiredLoop({
    name: "planner",
    instructions:
      "You are Planner. When asked to plan, create a brief 2-step plan and @mention executor to carry it out. Keep responses under 100 words. Always include PLAN_READY in your response.",
    runtime: ws,
    pollInterval: 1000,
    onInstruction: async (prompt, instruction) => {
      plannerProcessed = true;
      const { deepseek } = await import("@ai-sdk/deepseek");
      const { generateText } = await import("ai");

      const result = await generateText({
        model: deepseek("deepseek-chat"),
        system: prompt,
        prompt: instruction.content,
        maxOutputTokens: 200,
      });

      console.log(`${c.magenta}[planner]${c.reset} ${result.text.slice(0, 120)}`);

      // Post planner's response mentioning executor
      const response = result.text.includes("@executor") ? result.text : `@executor ${result.text}`;
      await ws.contextProvider.send({
        channel: "general",
        from: "planner",
        content: response.slice(0, 300),
      });
    },
  });

  const executorLoop = createWiredLoop({
    name: "executor",
    instructions:
      "You are Executor. When you receive instructions from planner, acknowledge them briefly. Always include EXECUTING in your response. Keep responses under 50 words.",
    runtime: ws,
    pollInterval: 1000,
    onInstruction: async (prompt, instruction) => {
      executorProcessed = true;
      const { deepseek } = await import("@ai-sdk/deepseek");
      const { generateText } = await import("ai");

      const result = await generateText({
        model: deepseek("deepseek-chat"),
        system: prompt,
        prompt: instruction.content,
        maxOutputTokens: 100,
      });

      console.log(`${c.cyan}[executor]${c.reset} ${result.text.slice(0, 120)}`);

      await ws.contextProvider.send({
        channel: "general",
        from: "executor",
        content: result.text.slice(0, 200),
      });
    },
  });

  await plannerLoop.start();
  await executorLoop.start();

  // Kickoff: ask planner to create a plan
  await ws.contextProvider.send({
    channel: "general",
    from: "user",
    content:
      "@planner Please create a brief plan to organize a code review. Include PLAN_READY in your answer and delegate to @executor.",
  });

  // Wait for the chain: user → planner → executor
  await new Promise((r) => setTimeout(r, 25000));

  await plannerLoop.stop();
  await executorLoop.stop();

  const msgs = await ws.contextProvider.channels.read("general");
  console.log(`\n  ${c.bold}Conversation (${msgs.length} messages):${c.reset}`);
  for (const m of msgs) {
    console.log(`  ${c.dim}[${m.from}]${c.reset} ${m.content.slice(0, 100)}`);
  }

  assert(plannerProcessed, "planner should have processed a message");
  assert(msgs.length >= 2, `expected >= 2 messages, got ${msgs.length}`);

  // Check if executor also participated
  if (executorProcessed) {
    console.log(`  ${c.green}Both agents participated${c.reset}`);
  } else {
    console.log(
      `  ${c.yellow}Only planner participated (executor may not have been @mentioned)${c.reset}`,
    );
  }

  await ws.shutdown();
  console.log(`${c.green}PASS${c.reset} T-DS3`);
}

async function testToolUsageViaWorkspace(): Promise<void> {
  console.log(`\n${c.bold}T-DS4: Workspace Tools (Documents + Resources)${c.reset}`);

  const ws = await createWorkspace({
    name: "deepseek-tools",
    channels: ["general"],
    agents: ["writer"],
    storage: new MemoryStorage(),
  });

  const { tools } = createAgentTools("writer", ws);

  // Use tools directly (simulating what an agent loop would do)
  // 1. Create a team document
  const docResult = await tools.team_doc_create!({
    name: "review-notes.md",
    content: "# Code Review Notes\n\n- Issue #1: Missing error handling",
  });
  console.log(`  doc create: ${docResult}`);
  assert(docResult.includes("Created") || docResult.includes("created"), "doc created");

  // 2. Read it back
  const readResult = await tools.team_doc_read!({ name: "review-notes.md" });
  console.log(`  doc read: ${readResult.slice(0, 80)}`);
  assert(readResult.includes("Code Review"), "doc content correct");

  // 3. Create a resource (large content)
  const largeContent = "Detailed analysis:\n" + "Line-by-line review...\n".repeat(50);
  const resResult = await tools.resource_create!({ content: largeContent });
  console.log(`  resource create: ${resResult.slice(0, 80)}`);

  // Extract resource ID
  const resId = resResult.match(/res_[a-zA-Z0-9_-]+/)?.[0];
  assert(!!resId, "resource ID in result");

  // 4. Read resource back
  const resRead = await tools.resource_read!({ id: resId! });
  console.log(`  resource read: ${resRead.slice(0, 80)}...`);
  assert(resRead.includes("Detailed analysis"), "resource content correct");

  // 5. List team members
  const members = await tools.team_members!({});
  console.log(`  team members: ${members}`);
  assert(members.includes("writer"), "writer in team");

  // 6. List documents
  const docList = await tools.team_doc_list!({});
  console.log(`  doc list: ${docList}`);
  assert(docList.includes("review-notes.md"), "doc in list");

  await ws.shutdown();
  console.log(`${c.green}PASS${c.reset} T-DS4`);
}

async function testDeepSeekWithInboxCycle(): Promise<void> {
  console.log(`\n${c.bold}T-DS5: DeepSeek Inbox Cycle${c.reset}`);

  const ws = await createWorkspace({
    name: "deepseek-inbox",
    channels: ["general"],
    agents: ["responder"],
    storage: new MemoryStorage(),
  });

  const { deepseek } = await import("@ai-sdk/deepseek");
  const { generateText } = await import("ai");

  let runCount = 0;

  const loop = createWiredLoop({
    name: "responder",
    instructions:
      "You are a responder. Reply briefly to each message. Include the word REPLY_N where N is the message number you are responding to.",
    runtime: ws,
    pollInterval: 1000,
    onInstruction: async (prompt, instruction) => {
      runCount++;
      console.log(`  ${c.dim}Run #${runCount}: ${instruction.content.slice(0, 60)}${c.reset}`);

      const result = await generateText({
        model: deepseek("deepseek-chat"),
        system: prompt,
        prompt: instruction.content,
        maxOutputTokens: 100,
      });

      await ws.contextProvider.send({
        channel: "general",
        from: "responder",
        content: result.text.slice(0, 200),
      });
    },
  });

  await loop.start();

  // Send 3 messages with delays
  await ws.contextProvider.send({
    channel: "general",
    from: "user",
    content: "@responder Message 1: What is Bun?",
  });
  await new Promise((r) => setTimeout(r, 8000));

  await ws.contextProvider.send({
    channel: "general",
    from: "user",
    content: "@responder Message 2: What is Deno?",
  });
  await new Promise((r) => setTimeout(r, 8000));

  await ws.contextProvider.send({
    channel: "general",
    from: "user",
    content: "@responder Message 3: What is Node?",
  });
  await new Promise((r) => setTimeout(r, 10000));

  await loop.stop();

  const msgs = await ws.contextProvider.channels.read("general");
  console.log(`\n  ${c.bold}Messages (${msgs.length}):${c.reset}`);
  for (const m of msgs) {
    console.log(`  ${c.dim}[${m.from}]${c.reset} ${m.content.slice(0, 100)}`);
  }

  assert(runCount >= 2, `expected >= 2 runs, got ${runCount}`);
  assert(msgs.length >= 4, `expected >= 4 messages (3 sent + 1+ replies), got ${msgs.length}`);

  // Verify inbox is processed
  const inbox = await ws.contextProvider.inbox.peek("responder");
  console.log(`  Remaining inbox: ${inbox.length}`);

  await ws.shutdown();
  console.log(`${c.green}PASS${c.reset} T-DS5`);
}

// ── Main ─────────────────────────────────────────────────────────────────

console.log(`${c.bold}Workspace A2A Tests — DeepSeek Backend${c.reset}`);
console.log(`${"─".repeat(50)}`);

if (!process.env.DEEPSEEK_API_KEY) {
  console.log(`${c.red}DEEPSEEK_API_KEY not set. Skipping all tests.${c.reset}`);
  process.exit(1);
}

const arg = process.argv[2] ?? "all";
const testMap: Record<string, () => Promise<void>> = {
  "T-DS1": testPreflight,
  "T-DS2": testSingleAgentWorkspace,
  "T-DS3": testTwoAgentCollaboration,
  "T-DS4": testToolUsageViaWorkspace,
  "T-DS5": testDeepSeekWithInboxCycle,
};

const toRun = arg === "all" ? Object.keys(testMap) : [arg];

let passed = 0;
let failed = 0;

for (const id of toRun) {
  const fn = testMap[id];
  if (!fn) {
    console.log(`${c.yellow}SKIP${c.reset} ${id} (not found)`);
    continue;
  }
  try {
    await fn();
    passed++;
  } catch (e) {
    failed++;
    console.log(`${c.red}FAIL${c.reset} ${id} — ${e instanceof Error ? e.message : e}`);
  }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`${failed > 0 ? c.red : c.green}${passed}/${passed + failed} passed${c.reset}`);
if (failed > 0) process.exit(1);
