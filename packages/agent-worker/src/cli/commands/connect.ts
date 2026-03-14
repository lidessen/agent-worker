/**
 * aw connect — Manage platform connections.
 *
 * Subcommands:
 *   telegram   — Complete auth flow: bot token → chat ID → save connection.
 *   status     — Show all configured connections.
 *   rm <name>  — Remove a saved connection.
 */

import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { fatal } from "../output.ts";

const CONNECTIONS_DIR = join(homedir(), ".agent-worker", "connections");

interface TelegramConnection {
  platform: "telegram";
  bot_token: string;
  chat_id: number;
  username?: string;
  first_name?: string;
}

type Connection = TelegramConnection;

async function loadConnection(platform: string): Promise<Connection | null> {
  try {
    const raw = await readFile(join(CONNECTIONS_DIR, `${platform}.json`), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function saveConnection(platform: string, conn: Connection): Promise<void> {
  await mkdir(CONNECTIONS_DIR, { recursive: true });
  await writeFile(join(CONNECTIONS_DIR, `${platform}.json`), JSON.stringify(conn, null, 2) + "\n");
}

async function removeConnection(platform: string): Promise<boolean> {
  try {
    await unlink(join(CONNECTIONS_DIR, `${platform}.json`));
    return true;
  } catch {
    return false;
  }
}

async function listConnections(): Promise<Connection[]> {
  try {
    const files = await readdir(CONNECTIONS_DIR);
    const conns: Connection[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(CONNECTIONS_DIR, f), "utf-8");
        conns.push(JSON.parse(raw));
      } catch {
        // skip corrupt files
      }
    }
    return conns;
  } catch {
    return [];
  }
}

// ── Subcommands ─────────────────────────────────────────────────────────────

export async function connect(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case "telegram":
      return connectTelegram();
    case "status":
      return connectStatus();
    case "rm":
      return connectRm(args[1]);
    default:
      console.log(`Usage: aw connect <command>

Commands:
  telegram     Connect a Telegram bot (full setup flow)
  status       Show all configured connections
  rm <name>    Remove a saved connection

Connections are saved to ~/.agent-worker/connections/ and automatically
used by workspace connections when config is not specified in YAML.
`);
      if (sub) {
        console.error(`Unknown subcommand: ${sub}`);
        process.exit(1);
      }
  }
}

async function connectTelegram(): Promise<void> {
  const existing = await loadConnection("telegram");
  if (existing) {
    const tg = existing as TelegramConnection;
    console.log(`\n  Existing Telegram connection found:`);
    console.log(`    Chat ID:  ${tg.chat_id}`);
    if (tg.username) console.log(`    Username: @${tg.username}`);
    console.log();

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("  Overwrite? [y/N] ");
    rl.close();
    if (answer.trim().toLowerCase() !== "y") {
      console.log("  Aborted.");
      return;
    }
    console.log();
  }

  // Get bot token: argument or interactive prompt
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    botToken = (await rl.question("  Bot token (from @BotFather): ")).trim();
    rl.close();
    if (!botToken) {
      fatal("Bot token is required.");
    }
  } else {
    console.log("  Using bot token from TELEGRAM_BOT_TOKEN env var.");
  }

  const { runTelegramAuth, setSecret } = await import("@agent-worker/workspace");

  try {
    const result = await runTelegramAuth(botToken);

    // Save connection file (for resolveConnections fallback)
    const conn: TelegramConnection = {
      platform: "telegram",
      bot_token: botToken,
      chat_id: result.chatId,
      username: result.username,
      first_name: result.firstName,
    };
    await saveConnection("telegram", conn);

    // Save secrets (for ${{ secrets.X }} interpolation in YAML)
    await setSecret("TELEGRAM_BOT_TOKEN", botToken);
    await setSecret("TELEGRAM_CHAT_ID", String(result.chatId));

    console.log(`\n  Connected successfully!\n`);
    console.log(`  Chat ID:    ${result.chatId}`);
    if (result.username) console.log(`  Username:   @${result.username}`);
    console.log(`  Name:       ${result.firstName}`);
    console.log(`\n  Saved to ~/.agent-worker/connections/telegram.json`);
    console.log(`\n  Workspace YAML can now use:\n`);
    console.log(`    connections:`);
    console.log(`      - platform: telegram`);
    console.log(`\n  No config needed — credentials loaded from saved connection.`);
  } catch (err) {
    fatal(`Connection failed: ${err}`);
  }
}

async function connectStatus(): Promise<void> {
  const conns = await listConnections();
  if (conns.length === 0) {
    console.log("No connections configured.");
    console.log("Run 'aw connect telegram' to set up Telegram.");
    return;
  }

  console.log("Connections:\n");
  for (const conn of conns) {
    switch (conn.platform) {
      case "telegram": {
        console.log(`  telegram`);
        console.log(`    Chat ID:  ${conn.chat_id}`);
        if (conn.username) console.log(`    Username: @${conn.username}`);
        if (conn.first_name) console.log(`    Name:     ${conn.first_name}`);
        break;
      }
      default:
        console.log(`  ${conn.platform}`);
    }
    console.log();
  }
}

async function connectRm(platform?: string): Promise<void> {
  if (!platform) {
    fatal("Usage: aw connect rm <platform>");
  }
  const removed = await removeConnection(platform);
  if (removed) {
    // Clean up associated secrets
    const { deleteSecret } = await import("@agent-worker/workspace");
    if (platform === "telegram") {
      await deleteSecret("TELEGRAM_BOT_TOKEN");
      await deleteSecret("TELEGRAM_CHAT_ID");
    }
    console.log(`Removed ${platform} connection.`);
  } else {
    console.log(`No ${platform} connection found.`);
  }
}

// ── Public API for adapter resolution ───────────────────────────────────────

export async function loadTelegramConnection(): Promise<TelegramConnection | null> {
  return loadConnection("telegram") as Promise<TelegramConnection | null>;
}
