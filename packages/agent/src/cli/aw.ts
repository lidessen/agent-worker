#!/usr/bin/env bun
/**
 * aw — interactive a2a testing CLI for agent-worker.
 *
 * Usage:
 *   bun packages/agent/src/cli/aw.ts start [options]
 *   bun packages/agent/src/cli/aw.ts send "msg" [+1s "msg2" ...]
 *   bun packages/agent/src/cli/aw.ts recv [--wait N] [--json]
 *   bun packages/agent/src/cli/aw.ts log [--follow] [--json]
 *   bun packages/agent/src/cli/aw.ts state
 *   bun packages/agent/src/cli/aw.ts stop
 *
 * send syntax:
 *   Messages are positional strings. Insert delays with +Ns or +Nms:
 *     send "hello" +1s "world" +500ms "!"
 *   This sends "hello", waits 1s, sends "world", waits 500ms, sends "!".
 *
 *   Use --from <name> to set sender for all messages.
 */
import { AwDaemon, type DaemonConfig } from "./daemon.ts";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

// ── Paths ─────────────────────────────────────────────────────────────────

const AW_DIR = `${tmpdir()}/aw`;
const SOCKET_LINK = `${AW_DIR}/current.sock`;
const META_PATH = `${AW_DIR}/current.json`;

// ── Color helpers ─────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 23);
}

// ── Socket helper ─────────────────────────────────────────────────────────

function getSocketPath(): string {
  if (!existsSync(META_PATH)) {
    console.error(`${c.red}No running daemon found.${c.reset} Start one with: aw start`);
    process.exit(1);
  }
  const meta = JSON.parse(Bun.file(META_PATH).text() as unknown as string);
  return meta.socketPath;
}

async function loadMeta(): Promise<{
  socketPath: string;
  responsesPath: string;
  eventsPath: string;
}> {
  if (!existsSync(META_PATH)) {
    console.error(`${c.red}No running daemon found.${c.reset} Start one with: aw start`);
    process.exit(1);
  }
  return JSON.parse(await Bun.file(META_PATH).text());
}

async function daemonFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const meta = await loadMeta();
  return fetch(`http://localhost${path}`, {
    ...options,
    unix: meta.socketPath,
  } as RequestInit);
}

// ── Parse delay syntax ────────────────────────────────────────────────────

function parseDelay(token: string): number | null {
  const match = token.match(/^\+(\d+)(ms|s)$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return match[2] === "s" ? value * 1000 : value;
}

function parseSendArgs(args: string[]): Array<{ content: string; delayMs?: number }> {
  const messages: Array<{ content: string; delayMs?: number }> = [];
  let pendingDelay: number | undefined;

  for (const arg of args) {
    const delay = parseDelay(arg);
    if (delay !== null) {
      pendingDelay = (pendingDelay ?? 0) + delay;
    } else {
      messages.push({ content: arg, delayMs: pendingDelay });
      pendingDelay = undefined;
    }
  }

  return messages;
}

// ── Commands ──────────────────────────────────────────────────────────────

type RuntimeType = "ai-sdk" | "claude-code" | "codex" | "cursor" | "mock";

/**
 * Create an AgentLoop for the given runtime + model combination.
 */
async function createLoop(
  runtime: RuntimeType,
  model: string,
  instructions: string,
): Promise<import("../types.ts").AgentLoop> {
  if (runtime === "mock") {
    return createMockLoop();
  }

  if (runtime === "ai-sdk") {
    const { AiSdkLoop } = await import("@agent-worker/loop");
    const provider = model.split(":")[0] ?? "anthropic";
    const modelId = model.includes(":") ? model.split(":").slice(1).join(":") : model;

    let languageModel;
    switch (provider) {
      case "anthropic": {
        const { anthropic } = await import("@ai-sdk/anthropic");
        languageModel = anthropic(modelId);
        break;
      }
      case "openai": {
        const { openai } = await import("@ai-sdk/openai");
        languageModel = openai(modelId);
        break;
      }
      case "deepseek": {
        const { deepseek } = await import("@ai-sdk/deepseek");
        languageModel = deepseek(modelId);
        break;
      }
      default:
        throw new Error(
          `Unsupported provider "${provider}". Use anthropic:<model>, openai:<model>, or deepseek:<model>.`,
        );
    }

    const loop = new AiSdkLoop({
      model: languageModel,
      instructions,
      includeBashTools: false,
    });
    return Object.assign(loop, { supports: ["directTools"] as const });
  }

  if (runtime === "claude-code") {
    const { ClaudeCodeLoop } = await import("@agent-worker/loop");
    const loop = new ClaudeCodeLoop({ model: model as import("@agent-worker/loop").ClaudeCodeModel });
    return Object.assign(loop, { supports: [] as const });
  }

  if (runtime === "codex") {
    const { CodexLoop } = await import("@agent-worker/loop");
    const loop = new CodexLoop({ model });
    return Object.assign(loop, { supports: [] as const });
  }

  if (runtime === "cursor") {
    const { CursorLoop } = await import("@agent-worker/loop");
    const loop = new CursorLoop({ model });
    return Object.assign(loop, { supports: [] as const });
  }

  throw new Error(`Unknown runtime: ${runtime}`);
}

/** Simple mock loop for testing without API keys. */
function createMockLoop(): import("../types.ts").AgentLoop {
  let _status: import("@agent-worker/loop").LoopStatus = "idle";
  let responseText = "Mock response: I received your message.";
  let delayMs = 500;

  return {
    supports: ["directTools"],
    get status() {
      return _status;
    },
    run(prompt: string) {
      _status = "running";
      const textEvent: import("@agent-worker/loop").LoopEvent = {
        type: "text",
        text: responseText,
      };
      const delayPromise = new Promise<void>((r) => setTimeout(r, delayMs));
      const result = delayPromise.then((): import("@agent-worker/loop").LoopResult => {
        _status = "completed";
        return {
          events: [textEvent],
          usage: { inputTokens: prompt.length / 4, outputTokens: 50, totalTokens: prompt.length / 4 + 50 },
          durationMs: delayMs,
        };
      });
      return {
        async *[Symbol.asyncIterator]() {
          await delayPromise;
          yield textEvent;
        },
        result,
      };
    },
    cancel() {
      _status = "cancelled";
    },
    setTools() {},
    setPrepareStep() {},
  };
}

async function cmdStart(args: string[]): Promise<void> {
  // Parse options
  let runtime: RuntimeType = "ai-sdk";
  let model = "anthropic:claude-sonnet-4-20250514";
  let instructions = "You are a helpful agent.";
  let maxRuns = 10;
  let debounceMs = 200;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--runtime" && args[i + 1]) runtime = args[++i] as RuntimeType;
    else if (args[i] === "--model" && args[i + 1]) model = args[++i];
    else if (args[i] === "--instructions" && args[i + 1]) instructions = args[++i];
    else if (args[i] === "--max-runs" && args[i + 1]) maxRuns = parseInt(args[++i], 10);
    else if (args[i] === "--debounce" && args[i + 1]) debounceMs = parseInt(args[++i], 10);
  }

  // Ensure aw dir exists
  const { mkdirSync } = await import("node:fs");
  mkdirSync(AW_DIR, { recursive: true });

  const loop = await createLoop(runtime, model, instructions);

  const daemon = new AwDaemon({
    agentConfig: {
      name: "aw-agent",
      instructions,
      loop,
      maxRuns,
      inbox: { debounceMs },
    },
    dataDir: AW_DIR,
  });

  const paths = await daemon.start();

  // Write meta for client commands
  await Bun.write(META_PATH, JSON.stringify(paths, null, 2));

  console.log(`${c.green}Daemon started${c.reset}`);
  console.log(`  runtime:   ${c.cyan}${runtime}${c.reset}`);
  console.log(`  model:     ${c.cyan}${model}${c.reset}`);
  console.log(`  socket:    ${c.dim}${paths.socketPath}${c.reset}`);
  console.log(`  responses: ${c.dim}${paths.responsesPath}${c.reset}`);
  console.log(`  events:    ${c.dim}${paths.eventsPath}${c.reset}`);
  console.log(`  debounce:  ${c.dim}${debounceMs}ms${c.reset}`);
  console.log();
  console.log(`${c.dim}Press Ctrl+C to stop.${c.reset}`);

  // Keep alive
  const shutdown = async () => {
    console.log(`\n${c.yellow}Shutting down...${c.reset}`);
    await daemon.shutdown();
    // Clean meta
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(META_PATH);
    } catch { /* ignore */ }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Block forever
  await new Promise(() => {});
}

async function cmdSend(args: string[]): Promise<void> {
  // Extract --from flag
  let from: string | undefined;
  const filteredArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" && args[i + 1]) {
      from = args[++i];
    } else {
      filteredArgs.push(args[i]);
    }
  }

  const messages = parseSendArgs(filteredArgs);
  if (messages.length === 0) {
    console.error('Usage: aw send "message" [+1s "message2" ...]');
    process.exit(1);
  }

  // Add from to all messages
  const payload = messages.map((m) => ({ ...m, from }));

  const res = await daemonFetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: payload }),
  });

  const data = (await res.json()) as { sent: number; state: string; error?: string };
  if (data.error) {
    console.error(`${c.red}Error:${c.reset} ${data.error}`);
    process.exit(1);
  }

  const delayInfo = messages.some((m) => m.delayMs)
    ? ` (with delays: ${messages.map((m) => m.delayMs ? `+${m.delayMs}ms` : "0ms").join(", ")})`
    : "";
  console.log(`${c.green}Sent ${data.sent} message(s)${c.reset}${delayInfo}`);
  console.log(`  agent state: ${c.cyan}${data.state}${c.reset}`);
}

async function cmdRecv(args: string[]): Promise<void> {
  let waitMs = 0;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--wait" && args[i + 1]) waitMs = parseFloat(args[++i]) * 1000;
    else if (args[i] === "--json") jsonOutput = true;
  }

  const meta = await loadMeta();
  // Read cursor from file
  const cursorPath = `${AW_DIR}/recv-cursor`;
  let cursor = 0;
  try {
    cursor = parseInt(await Bun.file(cursorPath).text(), 10) || 0;
  } catch { /* first read */ }

  const deadline = Date.now() + waitMs;

  while (true) {
    const res = await daemonFetch(`/recv?cursor=${cursor}`);
    const data = (await res.json()) as {
      entries: Array<{ ts: number; type: string; [key: string]: unknown }>;
      cursor: number;
    };

    if (data.entries.length > 0) {
      for (const entry of data.entries) {
        if (jsonOutput) {
          console.log(JSON.stringify(entry));
        } else {
          const ts = `${c.dim}${fmtTime(entry.ts)}${c.reset}`;
          if (entry.type === "text") {
            console.log(`${ts} ${entry.text}`);
          } else if (entry.type === "send") {
            console.log(`${ts} ${c.magenta}→ ${entry.target}:${c.reset} ${entry.content}`);
          }
        }
      }
      cursor = data.cursor;
      await Bun.write(cursorPath, String(cursor));
    }

    if (!waitMs || Date.now() >= deadline) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  if (cursor === 0) {
    console.log(`${c.dim}(no responses yet)${c.reset}`);
  }
}

async function cmdLog(args: string[]): Promise<void> {
  let follow = false;
  let jsonOutput = false;

  for (const arg of args) {
    if (arg === "--follow" || arg === "-f") follow = true;
    else if (arg === "--json") jsonOutput = true;
  }

  const meta = await loadMeta();
  const cursorPath = `${AW_DIR}/log-cursor`;
  let cursor = 0;
  try {
    cursor = parseInt(await Bun.file(cursorPath).text(), 10) || 0;
  } catch { /* first read */ }

  const typeColors: Record<string, string> = {
    state_change: c.green,
    message_received: c.cyan,
    run_start: c.blue,
    run_end: c.blue,
    tool_call_start: c.yellow,
    tool_call_end: c.yellow,
    thinking: c.dim,
    error: c.red,
    context_assembled: c.dim,
  };

  while (true) {
    const res = await daemonFetch(`/log?cursor=${cursor}`);
    const data = (await res.json()) as {
      entries: Array<{ ts: number; type: string; [key: string]: unknown }>;
      cursor: number;
    };

    if (data.entries.length > 0) {
      for (const entry of data.entries) {
        if (jsonOutput) {
          console.log(JSON.stringify(entry));
        } else {
          const ts = `${c.dim}${fmtTime(entry.ts)}${c.reset}`;
          const color = typeColors[entry.type] ?? c.reset;
          const tag = `${color}[${entry.type}]${c.reset}`;

          switch (entry.type) {
            case "state_change":
              console.log(`${ts} ${tag} → ${entry.state}`);
              break;
            case "message_received":
              console.log(
                `${ts} ${tag} [${entry.id}] from=${entry.from ?? "-"} "${entry.content}"`,
              );
              break;
            case "run_start":
              console.log(`${ts} ${tag} #${entry.runNumber} trigger=${entry.trigger}`);
              break;
            case "run_end":
              console.log(`${ts} ${tag} ${entry.durationMs}ms, ${entry.tokens} tokens`);
              break;
            case "tool_call_start":
              console.log(`${ts} ${tag} ${entry.name}(${JSON.stringify(entry.args) ?? ""})`);
              break;
            case "tool_call_end":
              console.log(`${ts} ${tag} ${entry.name} → ${entry.durationMs}ms`);
              break;
            case "thinking":
              console.log(`${ts} ${tag} ${(entry.text as string).slice(0, 120)}...`);
              break;
            case "error":
              console.log(`${ts} ${tag} ${entry.error}`);
              break;
            case "context_assembled":
              console.log(
                `${ts} ${tag} ${entry.tokenCount} tokens, ${entry.turnCount} turns`,
              );
              break;
            default:
              console.log(`${ts} ${tag} ${JSON.stringify(entry)}`);
          }
        }
      }
      cursor = data.cursor;
      await Bun.write(cursorPath, String(cursor));
    }

    if (!follow) break;
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function cmdState(): Promise<void> {
  const res = await daemonFetch("/state");
  const data = (await res.json()) as {
    state: string;
    inbox: Array<{
      id: string;
      status: string;
      from?: string;
      content: string;
      timestamp: number;
    }>;
    todos: Array<{ id: string; status: string; text: string }>;
    history: number;
  };

  console.log(`${c.bold}Agent State:${c.reset} ${c.cyan}${data.state}${c.reset}`);
  console.log(`${c.bold}History:${c.reset} ${data.history} turns`);

  console.log(`\n${c.bold}Inbox (${data.inbox.length}):${c.reset}`);
  if (data.inbox.length === 0) {
    console.log(`  ${c.dim}(empty)${c.reset}`);
  }
  for (const msg of data.inbox) {
    const status = msg.status === "unread" ? `${c.yellow}UNREAD${c.reset}` : `${c.dim}read${c.reset}`;
    console.log(`  [${msg.id}] ${status} from=${msg.from ?? "-"} "${msg.content}"`);
  }

  console.log(`\n${c.bold}Todos (${data.todos.length}):${c.reset}`);
  if (data.todos.length === 0) {
    console.log(`  ${c.dim}(empty)${c.reset}`);
  }
  for (const t of data.todos) {
    const icon = t.status === "done" ? `${c.green}done${c.reset}` : `${c.yellow}pending${c.reset}`;
    console.log(`  [${t.id}] ${icon} ${t.text}`);
  }
}

async function cmdStop(): Promise<void> {
  try {
    await daemonFetch("/stop", { method: "POST" });
    console.log(`${c.green}Daemon stopped.${c.reset}`);
  } catch {
    console.log(`${c.yellow}Daemon not reachable (may already be stopped).${c.reset}`);
  }
  // Clean meta
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(META_PATH);
    await unlink(`${AW_DIR}/recv-cursor`).catch(() => {});
    await unlink(`${AW_DIR}/log-cursor`).catch(() => {});
  } catch { /* ignore */ }
}

function printHelp(): void {
  const bin = "aw";
  console.log(`
${c.bold}${bin}${c.reset} — interactive a2a testing CLI for agent-worker

${c.bold}Commands:${c.reset}
  ${c.cyan}start${c.reset} [options]                   Start the daemon
    --runtime <type>                 ai-sdk | claude-code | codex | cursor | mock (default: ai-sdk)
    --model <model>                  Provider:model string (default: anthropic:claude-sonnet-4-20250514)
    --instructions <text>            System instructions
    --max-runs <n>                   Max runs per cycle (default: 10)
    --debounce <ms>                  Inbox debounce delay (default: 200)

  ${c.cyan}send${c.reset} "msg" [+Ns|+Nms "msg2" ...]  Send message(s) with optional delays
    --from <name>                    Set sender name for all messages

  ${c.cyan}recv${c.reset} [--wait N] [--json]           Read new responses
    --wait <seconds>                 Poll for up to N seconds
    --json                           Raw JSON output

  ${c.cyan}log${c.reset} [--follow] [--json]            View debug events (tool calls, state, thinking, etc.)
    --follow, -f                     Tail mode (keep watching)
    --json                           Raw JSON output

  ${c.cyan}state${c.reset}                              Show agent state, inbox, todos

  ${c.cyan}stop${c.reset}                               Stop the daemon

${c.bold}Examples:${c.reset}
  ${bin} start --runtime mock                              # test without API keys
  ${bin} start --model anthropic:claude-sonnet-4-20250514  # anthropic via AI SDK
  ${bin} start --model openai:gpt-4.1                      # openai via AI SDK
  ${bin} start --runtime claude-code --model sonnet         # claude CLI
  ${bin} send "hello"
  ${bin} send "step1" +2s "step2" +500ms "step3"           # send with delays
  ${bin} send --from alice "message from alice"
  ${bin} recv --wait 10
  ${bin} log --follow                                       # tail debug events
  ${bin} state
  ${bin} stop
`);
}

// ── Main ──────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "start":
    await cmdStart(args);
    break;
  case "send":
  case "s":
    await cmdSend(args);
    break;
  case "recv":
  case "r":
    await cmdRecv(args);
    break;
  case "log":
  case "l":
    await cmdLog(args);
    break;
  case "state":
  case "st":
    await cmdState();
    break;
  case "stop":
    await cmdStop();
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    printHelp();
    break;
  default:
    console.error(`${c.red}Unknown command: ${cmd}${c.reset}`);
    printHelp();
    process.exit(1);
}
