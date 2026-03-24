/**
 * aw connect — Manage platform connections.
 *
 * Subcommands:
 *   telegram [--name <name>]   — Complete auth flow: bot token → chat ID → save.
 *   status                     — Show all configured connections.
 *   rm <platform> [<name>]     — Remove a saved connection.
 *
 * Named connections are stored under ~/.agent-worker/connections/{platform}/{name}.json
 * and referenced in workspace YAML via the `name` field on ConnectionDef.
 */

import { readFile, readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { fatal, wantsHelp } from "../output.ts";

const CONNECTIONS_DIR = join(homedir(), ".agent-worker", "connections");

interface TelegramConnection {
  platform: "telegram";
  bot_token: string;
  chat_id: number;
  username?: string;
  first_name?: string;
}

type Connection = TelegramConnection & { _name?: string };

/**
 * Load a saved connection. Tries named path first, then legacy flat file.
 */
async function loadConnection(platform: string, name?: string): Promise<Connection | null> {
  name ??= platform;
  // Named: connections/telegram/dev-bot.json
  try {
    const raw = await readFile(join(CONNECTIONS_DIR, platform, `${name}.json`), "utf-8");
    return { ...JSON.parse(raw), _name: name };
  } catch { /* not found */ }

  // Legacy fallback: connections/telegram.json
  if (name === platform) {
    try {
      const raw = await readFile(join(CONNECTIONS_DIR, `${platform}.json`), "utf-8");
      return { ...JSON.parse(raw), _name: platform };
    } catch { /* not found */ }
  }

  return null;
}

async function removeConnection(platform: string, name?: string): Promise<boolean> {
  name ??= platform;
  // Try named path first
  try {
    await unlink(join(CONNECTIONS_DIR, platform, `${name}.json`));
    return true;
  } catch { /* not found */ }

  // Legacy fallback
  if (name === platform) {
    try {
      await unlink(join(CONNECTIONS_DIR, `${platform}.json`));
      return true;
    } catch { /* not found */ }
  }

  return false;
}

/**
 * List all connections across all platforms and names.
 */
async function listConnections(): Promise<Connection[]> {
  const conns: Connection[] = [];
  try {
    const entries = await readdir(CONNECTIONS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        // Legacy flat file: telegram.json
        try {
          const raw = await readFile(join(CONNECTIONS_DIR, entry.name), "utf-8");
          const legacyName = entry.name.replace(/\.json$/, "");
          conns.push({ ...JSON.parse(raw), _name: legacyName });
        } catch { /* skip corrupt */ }
      } else if (entry.isDirectory()) {
        // Named dir: telegram/dev-bot.json
        try {
          const files = await readdir(join(CONNECTIONS_DIR, entry.name));
          for (const f of files) {
            if (!f.endsWith(".json")) continue;
            try {
              const raw = await readFile(join(CONNECTIONS_DIR, entry.name, f), "utf-8");
              const name = f.replace(/\.json$/, "");
              conns.push({ ...JSON.parse(raw), _name: name });
            } catch { /* skip corrupt */ }
          }
        } catch { /* skip */ }
      }
    }
  } catch { /* dir doesn't exist */ }
  return conns;
}

// ── Subcommands ─────────────────────────────────────────────────────────────

export async function connect(args: string[]): Promise<void> {
  const sub = args[0];

  if (!wantsHelp(args)) {
    switch (sub) {
      case "telegram":
        return connectTelegram(args.slice(1));
      case "status":
        return connectStatus();
      case "rm":
        return connectRm(args[1], args[2]);
    }
  }

  console.log(`Usage: aw connect <command>

Commands:
  telegram [--name <name>]   Connect a Telegram bot (full setup flow)
  status                     Show all configured connections
  rm <platform> [<name>]     Remove a saved connection

Connections are saved to ~/.agent-worker/connections/{platform}/{name}.json
and automatically used by workspace connections when config is not specified.

Examples:
  aw connect telegram                    # Save as "default"
  aw connect telegram --name dev-bot     # Save as "dev-bot"
  aw connect rm telegram dev-bot         # Remove "dev-bot"
`);
  if (sub && !wantsHelp(args)) {
    console.error(`Unknown subcommand: ${sub}`);
    process.exit(1);
  }
}

async function connectTelegram(args: string[]): Promise<void> {
  const platform = "telegram";
  const nameIdx = args.indexOf("--name");
  if (nameIdx >= 0 && !args[nameIdx + 1]) {
    fatal("--name requires a value");
  }
  const name = nameIdx >= 0 ? args[nameIdx + 1]! : platform;
  const isPrimary = name === platform;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let botToken: string | undefined;

  try {
    const existing = await loadConnection(platform, name);
    if (existing) {
      const tg = existing as TelegramConnection;
      console.log(`\n  Existing Telegram connection${!isPrimary ? ` "${name}"` : ""} found:`);
      console.log(`    Chat ID:  ${tg.chat_id}`);
      if (tg.username) console.log(`    Username: @${tg.username}`);
      console.log();

      const answer = await rl.question("  Overwrite? [y/N] ");
      if (answer.trim().toLowerCase() !== "y") {
        console.log("  Aborted.");
        return;
      }
      console.log();
    }

    // Get bot token: argument or interactive prompt
    botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      botToken = (await rl.question("  Bot token (from @BotFather): ")).trim();
      if (!botToken) {
        fatal("Bot token is required.");
      }
    } else {
      console.log("  Using bot token from TELEGRAM_BOT_TOKEN env var.");
    }
  } finally {
    rl.close();
  }

  const { runTelegramAuth, saveConnection, setSecret } = await import("@agent-worker/workspace");

  try {
    const result = await runTelegramAuth(botToken!);

    // Save connection file using the new named storage
    const conn = {
      platform: "telegram",
      bot_token: botToken!,
      chat_id: result.chatId,
      username: result.username,
      first_name: result.firstName,
    };
    const savedPath = await saveConnection(platform, conn, name);

    // Save secrets for ${{ secrets.X }} interpolation (only for primary connection)
    if (isPrimary) {
      await setSecret("TELEGRAM_BOT_TOKEN", botToken!);
      await setSecret("TELEGRAM_CHAT_ID", String(result.chatId));
    }

    const nameLabel = !isPrimary ? ` "${name}"` : "";
    console.log(`\n  Connected${nameLabel} successfully!\n`);
    console.log(`  Chat ID:    ${result.chatId}`);
    if (result.username) console.log(`  Username:   @${result.username}`);
    console.log(`  Name:       ${result.firstName}`);
    console.log(`\n  Saved to ${savedPath}`);
    console.log(`\n  Workspace YAML:\n`);
    if (name === "default") {
      console.log(`    connections:`);
      console.log(`      - platform: telegram`);
    } else {
      console.log(`    connections:`);
      console.log(`      - platform: telegram`);
      console.log(`        name: ${name}`);
    }
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
    const nameLabel = conn._name && conn._name !== conn.platform ? ` (${conn._name})` : "";
    switch (conn.platform) {
      case "telegram": {
        console.log(`  telegram${nameLabel}`);
        console.log(`    Chat ID:  ${conn.chat_id}`);
        if (conn.username) console.log(`    Username: @${conn.username}`);
        if (conn.first_name) console.log(`    Name:     ${conn.first_name}`);
        break;
      }
      default:
        console.log(`  ${conn.platform}${nameLabel}`);
    }
    console.log();
  }
}

async function connectRm(platform?: string, name?: string): Promise<void> {
  if (!platform) {
    fatal("Usage: aw connect rm <platform> [<name>]");
  }
  const connName = name ?? platform;
  const removed = await removeConnection(platform, connName);
  if (removed) {
    // Clean up associated secrets (only for primary connection)
    if (connName === platform) {
      const { deleteSecret } = await import("@agent-worker/workspace");
      if (platform === "telegram") {
        await deleteSecret("TELEGRAM_BOT_TOKEN");
        await deleteSecret("TELEGRAM_CHAT_ID");
      }
    }
    const nameLabel = connName !== platform ? ` "${connName}"` : "";
    console.log(`Removed ${platform}${nameLabel} connection.`);
  } else {
    const nameLabel = connName !== platform ? ` "${connName}"` : "";
    console.log(`No ${platform}${nameLabel} connection found.`);
  }
}
