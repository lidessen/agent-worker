#!/usr/bin/env bun
/**
 * Mock CLI script that simulates agent CLI output in stream-json format.
 *
 * Usage:
 *   bun test/helpers/mock-cli.ts --format claude|codex|cursor --scenario success|error|tool-calls|slow
 *
 * Used as the CLI command for testing CLI loops without having the real CLIs installed.
 */

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const format = getArg("format") ?? "claude";
const scenario = getArg("scenario") ?? "success";

function writeLine(obj: unknown) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

// ── Claude Code format ──────────────────────────────────────────────────────

async function claudeSuccess() {
  writeLine({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "I'll help you with that." }],
    },
  });
  await sleep(50);
  writeLine({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "call_001",
          name: "bash",
          input: { command: "echo hello" },
        },
      ],
    },
  });
  await sleep(50);
  writeLine({
    type: "tool",
    tool_name: "bash",
    tool_call_id: "call_001",
    content: "hello",
  });
  await sleep(50);
  writeLine({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "Done! The command output 'hello'." }],
    },
  });
  writeLine({
    type: "result",
    result: "Done! The command output 'hello'.",
    usage: { input_tokens: 100, output_tokens: 50 },
  });
}

async function claudeError() {
  writeLine({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "Attempting the task..." }],
    },
  });
  await sleep(50);
  process.stderr.write("Error: something went wrong\n");
  process.exit(1);
}

async function claudeToolCalls() {
  for (let i = 0; i < 3; i++) {
    writeLine({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: `call_${i}`,
            name: i === 0 ? "bash" : i === 1 ? "readFile" : "writeFile",
            input: { command: `step ${i}` },
          },
        ],
      },
    });
    await sleep(30);
    writeLine({
      type: "tool",
      tool_name: i === 0 ? "bash" : i === 1 ? "readFile" : "writeFile",
      tool_call_id: `call_${i}`,
      content: `result of step ${i}`,
    });
    await sleep(30);
  }
  writeLine({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "All three tool calls completed." }],
    },
  });
  writeLine({
    type: "result",
    result: "All three tool calls completed.",
    usage: { input_tokens: 300, output_tokens: 150 },
  });
}

async function claudeSlow() {
  writeLine({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "Starting slow task..." }],
    },
  });
  // Long delay to allow cancellation tests to abort before completion
  await sleep(30_000);
  writeLine({
    type: "result",
    result: "Slow task done.",
    usage: { input_tokens: 50, output_tokens: 20 },
  });
}

// ── Codex format ────────────────────────────────────────────────────────────

async function codexSuccess() {
  writeLine({
    type: "message",
    role: "assistant",
    content: "I'll help you with that task.",
  });
  await sleep(50);
  writeLine({
    type: "function_call",
    name: "shell",
    arguments: { command: "echo hello" },
  });
  await sleep(50);
  writeLine({
    type: "function_call_output",
    name: "shell",
    output: "hello",
  });
  await sleep(50);
  writeLine({
    type: "message",
    role: "assistant",
    content: "Task completed successfully.",
  });
}

async function codexError() {
  writeLine({
    type: "message",
    role: "assistant",
    content: "Starting...",
  });
  await sleep(50);
  process.stderr.write("codex error: execution failed\n");
  process.exit(1);
}

async function codexToolCalls() {
  for (let i = 0; i < 3; i++) {
    writeLine({
      type: "tool_call",
      name: `tool_${i}`,
      arguments: { step: i },
    });
    await sleep(30);
    writeLine({
      type: "tool_call_output",
      name: `tool_${i}`,
      output: `output_${i}`,
    });
    await sleep(30);
  }
  writeLine({
    type: "message",
    role: "assistant",
    content: "All tools called.",
  });
}

// ── Cursor format ───────────────────────────────────────────────────────────

async function cursorSuccess() {
  writeLine({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "Working on it." }],
    },
  });
  await sleep(50);
  writeLine({
    type: "assistant",
    message: {
      content: [
        {
          type: "tool_use",
          id: "cur_001",
          name: "edit_file",
          input: { path: "test.txt", content: "hello" },
        },
      ],
    },
  });
  await sleep(50);
  writeLine({
    type: "result",
    result: "File edited successfully.",
  });
}

async function cursorError() {
  writeLine({
    type: "assistant",
    message: {
      content: [{ type: "text", text: "Trying..." }],
    },
  });
  await sleep(50);
  process.stderr.write("cursor: command failed\n");
  process.exit(1);
}

async function cursorToolCalls() {
  for (let i = 0; i < 3; i++) {
    writeLine({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            id: `cur_${i}`,
            name: `tool_${i}`,
            input: { step: i },
          },
        ],
      },
    });
    await sleep(30);
  }
  writeLine({
    type: "result",
    result: "All done.",
  });
}

// ── Dispatch ────────────────────────────────────────────────────────────────

const handlers: Record<string, Record<string, () => Promise<void>>> = {
  claude: {
    success: claudeSuccess,
    error: claudeError,
    "tool-calls": claudeToolCalls,
    slow: claudeSlow,
  },
  codex: {
    success: codexSuccess,
    error: codexError,
    "tool-calls": codexToolCalls,
  },
  cursor: {
    success: cursorSuccess,
    error: cursorError,
    "tool-calls": cursorToolCalls,
  },
};

const formatHandlers = handlers[format];
if (!formatHandlers) {
  console.error(`Unknown format: ${format}`);
  process.exit(1);
}

const handler = formatHandlers[scenario];
if (!handler) {
  console.error(`Unknown scenario: ${scenario} for format: ${format}`);
  process.exit(1);
}

await handler();
