/**
 * Interactive async messaging test harness.
 *
 * Uses a controllable mock loop so you can:
 *   - Send messages while agent is processing
 *   - Burst-send multiple messages
 *   - Observe state transitions, inbox, and send-guard behavior
 *   - Adjust mock response delay on the fly
 *
 * Usage:
 *   bun run packages/agent/test/interactive-messaging.ts
 *
 * Commands:
 *   send <text>       — push a message into the agent's inbox
 *   burst <n> [prefix] — send N messages rapidly
 *   state              — show agent state + inbox + todos
 *   delay <ms>         — set mock loop response delay (default 500)
 *   reply <text>       — set mock loop response text
 *   history            — show conversation history
 *   quit               — stop agent and exit
 */
import { Agent } from "../src/agent.ts";
import type { AgentLoop, AgentState } from "../src/types.ts";
import type { LoopRun, LoopResult, LoopEvent, LoopStatus } from "@agent-worker/loop";
import * as readline from "node:readline";

// ── Controllable mock loop ────────────────────────────────────────────────

function createControllableLoop() {
  let responseText = "Got it, processing your request.";
  let responseDelayMs = 500;
  let runCounter = 0;
  let _status: LoopStatus = "idle";

  const mock: AgentLoop & {
    setDelay(ms: number): void;
    setResponse(text: string): void;
    runCounter: number;
  } = {
    supports: ["directTools"] as const,

    get status(): LoopStatus {
      return _status;
    },

    run(prompt: string): LoopRun {
      runCounter++;
      const runNum = runCounter;
      _status = "running";

      log("loop", `run #${runNum} started (delay=${responseDelayMs}ms)`);
      log("loop", `prompt length: ${prompt.length} chars`);

      const events: LoopEvent[] = [];
      const textEvent: LoopEvent = { type: "text", text: responseText };

      const result = new Promise<LoopResult>((resolve) => {
        setTimeout(() => {
          events.push(textEvent);
          _status = "completed";
          log("loop", `run #${runNum} completed → "${responseText}"`);
          resolve({
            events,
            usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
            durationMs: responseDelayMs,
          });
        }, responseDelayMs);
      });

      return {
        async *[Symbol.asyncIterator]() {
          // Wait for the delay before yielding the text event
          await new Promise((r) => setTimeout(r, responseDelayMs));
          yield textEvent;
        },
        result,
      };
    },

    cancel() {
      _status = "cancelled";
      log("loop", "cancelled");
    },

    setTools() {},
    setPrepareStep() {},

    setDelay(ms: number) {
      responseDelayMs = ms;
    },
    setResponse(text: string) {
      responseText = text;
    },

    get runCounter() {
      return runCounter;
    },
  };

  return mock;
}

// ── Logging ───────────────────────────────────────────────────────────────

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(tag: string, msg: string) {
  const colorMap: Record<string, string> = {
    state: colors.green,
    inbox: colors.cyan,
    send: colors.magenta,
    event: colors.dim,
    loop: colors.yellow,
    run: colors.blue,
    err: colors.red,
  };
  const c = colorMap[tag] ?? colors.reset;
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`${colors.dim}${ts}${colors.reset} ${c}[${tag}]${colors.reset} ${msg}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const loop = createControllableLoop();

  const agent = new Agent({
    name: "test-agent",
    instructions: "You are a test agent. Respond briefly.",
    loop,
    maxRuns: 10,
    inbox: { debounceMs: 200 },
  });

  // Wire up event listeners
  agent.on("stateChange", (state: AgentState) => {
    log("state", `→ ${state}`);
  });

  agent.on("messageReceived", (msg) => {
    log("inbox", `received: [${msg.id}] "${msg.content}" (from: ${msg.from ?? "user"})`);
  });

  agent.on("send", (target, content) => {
    log("send", `→ ${target}: "${content}"`);
  });

  agent.on("runStart", (info) => {
    log("run", `start #${info.runNumber} trigger=${info.trigger}`);
  });

  agent.on("runEnd", (result) => {
    log("run", `end (${result.durationMs}ms, ${result.usage.totalTokens} tokens)`);
  });

  agent.on("event", (event) => {
    if (event.type === "text") {
      log("event", `text: "${event.text}"`);
    } else if (event.type === "tool_call_start") {
      log("event", `tool_call: ${event.name}`);
    }
  });

  await agent.init();
  log("state", "Agent initialized. Type 'help' for commands.");

  // ── Interactive REPL ────────────────────────────────────────────────────

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "\n> ",
  });

  rl.prompt();

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      rl.prompt();
      return;
    }

    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(" ");

    switch (cmd) {
      case "send":
      case "s": {
        if (!arg) {
          console.log("Usage: send <message text>");
          break;
        }
        try {
          agent.push(arg);
        } catch (e: unknown) {
          log("err", (e as Error).message);
        }
        break;
      }

      case "sendfrom":
      case "sf": {
        const parts = arg.split(/\s+/);
        const from = parts[0];
        const content = parts.slice(1).join(" ");
        if (!from || !content) {
          console.log("Usage: sendfrom <from> <message text>");
          break;
        }
        try {
          agent.push({ content, from });
        } catch (e: unknown) {
          log("err", (e as Error).message);
        }
        break;
      }

      case "burst":
      case "b": {
        const n = parseInt(rest[0] ?? "3", 10);
        const prefix = rest.slice(1).join(" ") || "burst msg";
        log("inbox", `sending ${n} messages rapidly...`);
        for (let i = 1; i <= n; i++) {
          try {
            agent.push(`${prefix} #${i}`);
          } catch (e: unknown) {
            log("err", (e as Error).message);
            break;
          }
        }
        break;
      }

      case "state":
      case "st": {
        console.log(`  state: ${agent.state}`);
        console.log(`  inbox (${agent.inboxMessages.length} total):`);
        for (const msg of agent.inboxMessages) {
          const status = msg.status === "unread" ? "UNREAD" : "read";
          console.log(`    [${msg.id}] ${status} from=${msg.from ?? "-"} "${msg.content}"`);
        }
        console.log(`  todos (${agent.todos.length}):`);
        for (const t of agent.todos) {
          console.log(`    [${t.id}] ${t.status}: ${t.text}`);
        }
        break;
      }

      case "delay":
      case "d": {
        const ms = parseInt(arg, 10);
        if (isNaN(ms) || ms < 0) {
          console.log("Usage: delay <milliseconds>");
          break;
        }
        loop.setDelay(ms);
        console.log(`  Mock response delay set to ${ms}ms`);
        break;
      }

      case "reply":
      case "r": {
        if (!arg) {
          console.log("Usage: reply <response text>");
          break;
        }
        loop.setResponse(arg);
        console.log(`  Mock response set to: "${arg}"`);
        break;
      }

      case "history":
      case "h": {
        const ctx = agent.context;
        if (ctx.length === 0) {
          console.log("  (empty history)");
        } else {
          for (const turn of ctx) {
            const prefix = turn.role === "user" ? "USR" : "AST";
            const truncated =
              turn.content.length > 120 ? turn.content.slice(0, 120) + "..." : turn.content;
            console.log(`  [${prefix}] ${truncated}`);
          }
        }
        break;
      }

      case "help": {
        console.log(`
  Commands:
    send <text>             (s)  Push a message to the agent inbox
    sendfrom <from> <text>  (sf) Push a message with a sender name
    burst <n> [prefix]      (b)  Send N messages rapidly (default 3)
    state                   (st) Show agent state, inbox, todos
    delay <ms>              (d)  Set mock loop response delay
    reply <text>            (r)  Set mock loop response text
    history                 (h)  Show conversation history
    quit                    (q)  Stop and exit
`);
        break;
      }

      case "quit":
      case "q": {
        log("state", "Stopping agent...");
        agent.stop().then(() => {
          log("state", "Agent stopped. Bye!");
          process.exit(0);
        });
        return;
      }

      default:
        console.log(`  Unknown command: ${cmd}. Type 'help' for available commands.`);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    agent.stop().then(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
