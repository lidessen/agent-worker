/**
 * aw telegram — Telegram adapter management commands.
 *
 * Subcommands:
 *   auth   — Interactive auth flow to capture a Telegram chat ID.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".agent-worker");
const CONFIG_FILE = join(CONFIG_DIR, "telegram.json");

interface TelegramConfig {
  chat_id?: number;
  username?: string;
  first_name?: string;
}

async function loadConfig(): Promise<TelegramConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveConfig(config: TelegramConfig): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
}

export async function telegram(args: string[]): Promise<void> {
  const sub = args[0];

  switch (sub) {
    case "auth":
      return telegramAuth(args.slice(1));
    case "status":
      return telegramStatus();
    default:
      console.log(`Usage: aw telegram <command>

Commands:
  auth     Authorize a Telegram chat (captures chat ID)
  status   Show current Telegram configuration

Environment:
  TELEGRAM_BOT_TOKEN   Bot token from @BotFather (required for auth)

The auth flow generates a random token and waits for you to send it
to your bot in Telegram. Once verified, the chat ID is saved to
~/.agent-worker/telegram.json and can be used in workspace YAML configs.
`);
      if (sub) {
        console.error(`Unknown subcommand: ${sub}`);
        process.exit(1);
      }
  }
}

async function telegramAuth(args: string[]): Promise<void> {
  const botToken = args[0] ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error(
      "Bot token required. Pass as argument or set TELEGRAM_BOT_TOKEN.\n" +
        "Usage: aw telegram auth [BOT_TOKEN]",
    );
    process.exit(1);
  }

  const { runTelegramAuth } = await import("@agent-worker/workspace");

  try {
    const result = await runTelegramAuth(botToken);

    const config: TelegramConfig = {
      chat_id: result.chatId,
      username: result.username,
      first_name: result.firstName,
    };
    await saveConfig(config);

    console.log(`  Authorized successfully!\n`);
    console.log(`  Chat ID:    ${result.chatId}`);
    if (result.username) console.log(`  Username:   @${result.username}`);
    console.log(`  Name:       ${result.firstName}`);
    console.log(`\n  Saved to ${CONFIG_FILE}`);
    console.log(`\n  Use in workspace YAML:\n`);
    console.log(`    adapters:`);
    console.log(`      - platform: telegram`);
    console.log(`        config:`);
    console.log(`          bot_token: \${TELEGRAM_BOT_TOKEN}`);
    console.log(`          chat_id: ${result.chatId}`);
  } catch (err) {
    console.error(`Auth failed: ${err}`);
    process.exit(1);
  }
}

async function telegramStatus(): Promise<void> {
  const config = await loadConfig();

  if (!config.chat_id) {
    console.log("No Telegram configuration found.");
    console.log("Run 'aw telegram auth' to set up.");
    return;
  }

  console.log("Telegram configuration:");
  console.log(`  Chat ID:    ${config.chat_id}`);
  if (config.username) console.log(`  Username:   @${config.username}`);
  if (config.first_name) console.log(`  Name:       ${config.first_name}`);
  console.log(`  Config:     ${CONFIG_FILE}`);
}
