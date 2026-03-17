/**
 * Telegram adapter for workspace channel bridge.
 *
 * Uses the Telegram Bot API directly (no external dependencies).
 * Supports long-polling for receiving messages and sends channel
 * messages back to the configured Telegram chat.
 *
 * Auth flow inspired by github.com/lidessen/ccrc:
 * - Chat-ID-based authorization (single chat allowed)
 * - `runAuth()` helper generates a token, waits for user to send it,
 *   then captures and returns the chat ID.
 */

import type { ChannelAdapter, ChannelBridgeInterface, Message } from "../types.ts";

// ── Telegram Bot API types (minimal subset) ────────────────────────────────

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  reply_to_message?: TelegramMessage;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ── Config ─────────────────────────────────────────────────────────────────

export interface TelegramAdapterConfig {
  /** Telegram bot token (from @BotFather). */
  botToken: string;
  /** Allowed chat ID. If set, only messages from this chat are processed. */
  chatId?: number;
  /** Channel to route incoming Telegram messages to. Default: "general". */
  channel?: string;
  /** Polling timeout in seconds. Default: 30. */
  pollTimeout?: number;
  /** Optional callback to get agent status for /status command. */
  getAgents?: () => Promise<Array<{ name: string; status: string; task?: string }>>;
}

// ── Bot commands ──────────────────────────────────────────────────────────

const BOT_COMMANDS = [{ command: "status", description: "Show connection status" }];

// ── Adapter ────────────────────────────────────────────────────────────────

export class TelegramAdapter implements ChannelAdapter {
  readonly platform = "telegram";

  private readonly token: string;
  private readonly chatId: number | undefined;
  private readonly channel: string;
  private readonly pollTimeout: number;
  private readonly baseUrl: string;
  private readonly getAgents: TelegramAdapterConfig["getAgents"];

  private bridge: ChannelBridgeInterface | null = null;
  private bridgeSubscriber: ((msg: Message) => void) | null = null;
  private offset = 0;
  private running = false;
  private pollController: AbortController | null = null;

  constructor(config: TelegramAdapterConfig) {
    this.token = config.botToken;
    this.chatId = config.chatId;
    this.getAgents = config.getAgents;
    this.channel = config.channel ?? "general";
    this.pollTimeout = config.pollTimeout ?? 30;
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  async start(bridge: ChannelBridgeInterface): Promise<void> {
    this.bridge = bridge;
    this.running = true;

    // Subscribe to outbound channel messages → send to Telegram
    this.bridgeSubscriber = (msg: Message) => {
      // Anti-loop: don't echo messages that came from Telegram
      if (msg.from.startsWith("telegram:")) return;
      // Only forward messages from the configured channel
      if (msg.channel !== this.channel) return;
      this.sendToTelegram(msg.content, msg.from).catch((err) => {
        console.error("[telegram] failed to send:", err);
      });
    };
    bridge.subscribe(this.bridgeSubscriber);

    // Start long-polling loop
    this.poll();
  }

  async shutdown(): Promise<void> {
    this.running = false;
    this.pollController?.abort();
    if (this.bridge && this.bridgeSubscriber) {
      this.bridge.unsubscribe(this.bridgeSubscriber);
    }
    this.bridgeSubscriber = null;
    this.bridge = null;
  }

  private async sendStatus(chatId: number): Promise<void> {
    const lines = [
      `Running: ${this.running}`,
      `Workspace: ${this.bridge ? "connected" : "not connected"}`,
      `Default channel: #${this.channel}`,
      `Chat ID: ${chatId}`,
    ];

    if (this.getAgents) {
      const agents = await this.getAgents();
      if (agents.length > 0) {
        lines.push("", "Agents:");
        for (const a of agents) {
          const task = a.task ? ` — ${a.task}` : "";
          lines.push(`  @${a.name}: ${a.status}${task}`);
        }
      }
    }

    if (this.bridge) {
      lines.push("", 'Tip: "#channel message" to post to a specific channel.');
    }

    await this.api("sendMessage", { chat_id: chatId, text: lines.join("\n") });
  }

  // ── Telegram Bot API calls ─────────────────────────────────────────────

  private api<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    return telegramApi<T>(this.baseUrl, method, body, this.pollController?.signal);
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    return this.api<TelegramUpdate[]>("getUpdates", {
      offset: this.offset,
      timeout: this.pollTimeout,
      allowed_updates: ["message"],
    });
  }

  private async sendToTelegram(text: string, from?: string): Promise<void> {
    if (!this.chatId) return;
    const formatted = from ? `*${escapeMarkdown(from)}:*\n${escapeMarkdown(text)}` : text;
    await this.api("sendMessage", {
      chat_id: this.chatId,
      text: formatted,
      parse_mode: "MarkdownV2",
    });
  }

  // ── Polling loop ───────────────────────────────────────────────────────

  private async poll(): Promise<void> {
    while (this.running) {
      this.pollController = new AbortController();
      try {
        const updates = await this.getUpdates();
        for (const update of updates) {
          this.offset = update.update_id + 1;
          if (update.message) {
            this.handleMessage(update.message);
          }
        }
        // Small delay between polls to avoid tight loops when server responds instantly
        if (this.running) await sleep(100);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") break;
        console.error("[telegram] poll error:", err);
        // Back off on error
        await sleep(5000);
      }
    }
  }

  private handleMessage(msg: TelegramMessage): void {
    if (!msg.text) return;

    // Authorization check
    if (this.chatId && msg.chat.id !== this.chatId) return;

    // Handle bot commands
    if (msg.text.startsWith("/")) {
      this.handleCommand(msg);
      return;
    }

    if (!this.bridge) {
      this.api("sendMessage", {
        chat_id: msg.chat.id,
        text: "No workspace connected. Start a workspace with this Telegram connection first.",
      }).catch(() => {});
      return;
    }

    // Parse #channel prefix: "#design hello" → channel="design", content="hello"
    const { channel, content } = parseChannelPrefix(msg.text, this.channel);

    const from = telegramUserLabel(msg.from);
    this.bridge.send(channel, `telegram:${from}`, content).catch((err) => {
      console.error("[telegram] failed to inject message:", err);
    });
  }

  private handleCommand(msg: TelegramMessage): void {
    const cmd = msg.text!.split(/\s|@/)[0]!.toLowerCase();

    switch (cmd) {
      case "/status": {
        this.sendStatus(msg.chat.id).catch((err) => {
          console.error("[telegram] /status reply failed:", err);
        });
        break;
      }
      default: {
        if (!this.bridge) {
          this.api("sendMessage", {
            chat_id: msg.chat.id,
            text: "No workspace connected. Start a workspace with this Telegram connection first.",
          }).catch(() => {});
          return;
        }
        // Unknown command — forward to workspace as regular message
        const from = telegramUserLabel(msg.from);
        const { channel, content } = parseChannelPrefix(msg.text!, this.channel);
        this.bridge.send(channel, `telegram:${from}`, content).catch((err) => {
          console.error("[telegram] failed to inject message:", err);
        });
      }
    }
  }
}

// ── Auth flow ──────────────────────────────────────────────────────────────

export interface AuthResult {
  chatId: number;
  username?: string;
  firstName: string;
}

/**
 * Run an interactive auth flow to capture a Telegram chat ID.
 *
 * Inspired by ccrc: generates a random token, starts polling,
 * and waits for a user to send the token to the bot.
 * Returns the chat ID of the user who sent the correct token.
 */
export async function runTelegramAuth(
  botToken: string,
  opts?: { timeout?: number },
): Promise<AuthResult> {
  const token = generateAuthToken();
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  const timeoutMs = opts?.timeout ?? 120_000;

  console.log("\n  Send this token to your bot in Telegram:\n");
  console.log(`    ${token}\n`);
  console.log("  Waiting for verification...\n");

  const deadline = Date.now() + timeoutMs;
  let offset = 0;

  // Flush pending updates first
  try {
    const flush = await telegramApi<TelegramUpdate[]>(baseUrl, "getUpdates", {
      offset: -1,
      timeout: 0,
    });
    if (flush.length > 0) {
      offset = flush[flush.length - 1]!.update_id + 1;
    }
  } catch {
    // ignore
  }

  while (Date.now() < deadline) {
    try {
      const updates = await telegramApi<TelegramUpdate[]>(baseUrl, "getUpdates", {
        offset,
        timeout: 5,
        allowed_updates: ["message"],
      });

      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.message?.text?.trim() === token) {
          const chat = update.message.chat;
          const user = update.message.from;

          // Register bot commands
          await telegramApi(baseUrl, "setMyCommands", {
            commands: BOT_COMMANDS,
          }).catch(() => {}); // non-fatal

          // Confirm to user
          await telegramApi(baseUrl, "sendMessage", {
            chat_id: chat.id,
            text: "Authorized. This chat is now linked.",
          });

          return {
            chatId: chat.id,
            username: user?.username,
            firstName: user?.first_name ?? chat.first_name ?? "Unknown",
          };
        }
      }
    } catch (err) {
      console.error("[telegram-auth] poll error:", err);
      await sleep(2000);
    }
  }

  throw new Error("Auth timed out — no valid token received within the time limit.");
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse "#channel message" prefix from text.
 * Returns the target channel and remaining content.
 * If no prefix, returns the default channel with full text.
 */
function parseChannelPrefix(
  text: string,
  defaultChannel: string,
): { channel: string; content: string } {
  const match = text.match(/^#([\w-]+)\s+([\s\S]+)/);
  if (match) {
    return { channel: match[1]!, content: match[2]! };
  }
  return { channel: defaultChannel, content: text };
}

function telegramUserLabel(user?: TelegramUser): string {
  if (!user) return "unknown";
  if (user.username) return user.username;
  return user.first_name + (user.last_name ? ` ${user.last_name}` : "");
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function generateAuthToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function telegramApi<T>(
  baseUrl: string,
  method: string,
  body?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${baseUrl}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const json = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram API error (${method}): ${json.description ?? "unknown"}`);
  }
  return json.result;
}
