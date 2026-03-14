import { test, expect, describe, mock, afterEach } from "bun:test";
import { TelegramAdapter } from "../src/adapters/telegram.ts";
import type { ChannelBridgeInterface, Message } from "../src/types.ts";
import { parse as parseYaml } from "yaml";
import type { ConnectionDef } from "../src/config/types.ts";

// ── Mock bridge ──────────────────────────────────────────────────────────

function createMockBridge(): ChannelBridgeInterface & {
  subscribers: Set<(msg: Message) => void>;
  sent: Array<{ channel: string; from: string; content: string }>;
} {
  const subscribers = new Set<(msg: Message) => void>();
  const sent: Array<{ channel: string; from: string; content: string }> = [];
  return {
    subscribers,
    sent,
    async send(channel: string, from: string, content: string): Promise<Message> {
      sent.push({ channel, from, content });
      return {
        id: "msg-1",
        timestamp: new Date().toISOString(),
        from,
        channel,
        content,
        mentions: [],
      };
    },
    subscribe(callback: (msg: Message) => void): void {
      subscribers.add(callback);
    },
    unsubscribe(callback: (msg: Message) => void): void {
      subscribers.delete(callback);
    },
  };
}

// ── TelegramAdapter unit tests ───────────────────────────────────────────

describe("TelegramAdapter", () => {
  let origFetch: typeof globalThis.fetch;
  let adapter: TelegramAdapter | null = null;

  afterEach(async () => {
    if (adapter) {
      await adapter.shutdown();
      adapter = null;
    }
    if (origFetch) {
      globalThis.fetch = origFetch;
    }
  });

  function mockFetch() {
    origFetch = globalThis.fetch;
    const calls: Array<{ url: string; body?: string }> = [];
    globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
      calls.push({ url: urlStr, body: init?.body as string });
      return Promise.resolve(new Response(JSON.stringify({ ok: true, result: [] })));
    }) as any;
    return calls;
  }

  test("has correct platform identifier", () => {
    adapter = new TelegramAdapter({ botToken: "test-token", chatId: 123 });
    expect(adapter.platform).toBe("telegram");
  });

  test("subscribes to bridge on start", async () => {
    mockFetch();
    adapter = new TelegramAdapter({ botToken: "test-token", chatId: 123 });
    const bridge = createMockBridge();
    await adapter.start(bridge);
    expect(bridge.subscribers.size).toBe(1);
  });

  test("anti-loop: ignores messages from telegram sources", async () => {
    const calls = mockFetch();
    adapter = new TelegramAdapter({ botToken: "test-token", chatId: 123 });
    const bridge = createMockBridge();
    await adapter.start(bridge);

    const telegramMsg: Message = {
      id: "m1",
      timestamp: new Date().toISOString(),
      from: "telegram:johndoe",
      channel: "general",
      content: "hello from telegram",
      mentions: [],
    };

    const subscriber = [...bridge.subscribers][0]!;
    subscriber(telegramMsg);

    await new Promise((r) => setTimeout(r, 20));
    const sendCalls = calls.filter((c) => c.url.includes("sendMessage"));
    expect(sendCalls).toHaveLength(0);
  });

  test("only forwards messages from configured channel", async () => {
    const calls = mockFetch();
    adapter = new TelegramAdapter({ botToken: "test-token", chatId: 123, channel: "alerts" });
    const bridge = createMockBridge();
    await adapter.start(bridge);

    const otherMsg: Message = {
      id: "m2",
      timestamp: new Date().toISOString(),
      from: "agent-alice",
      channel: "general",
      content: "hello from general",
      mentions: [],
    };

    const subscriber = [...bridge.subscribers][0]!;
    subscriber(otherMsg);

    await new Promise((r) => setTimeout(r, 20));
    const sendCalls = calls.filter((c) => c.url.includes("sendMessage"));
    expect(sendCalls).toHaveLength(0);
  });

  test("forwards matching channel messages to Telegram", async () => {
    const calls = mockFetch();
    adapter = new TelegramAdapter({ botToken: "test-token", chatId: 123, channel: "general" });
    const bridge = createMockBridge();
    await adapter.start(bridge);

    const agentMsg: Message = {
      id: "m3",
      timestamp: new Date().toISOString(),
      from: "agent-alice",
      channel: "general",
      content: "task complete",
      mentions: [],
    };

    const subscriber = [...bridge.subscribers][0]!;
    subscriber(agentMsg);

    await new Promise((r) => setTimeout(r, 20));
    const sendCalls = calls.filter((c) => c.url.includes("sendMessage"));
    expect(sendCalls).toHaveLength(1);
    const body = JSON.parse(sendCalls[0]!.body!);
    expect(body.chat_id).toBe(123);
  });

  test("no sendMessage when chatId is not set", async () => {
    const calls = mockFetch();
    adapter = new TelegramAdapter({ botToken: "test-token" });
    const bridge = createMockBridge();
    await adapter.start(bridge);

    const agentMsg: Message = {
      id: "m4",
      timestamp: new Date().toISOString(),
      from: "agent-alice",
      channel: "general",
      content: "hello",
      mentions: [],
    };

    const subscriber = [...bridge.subscribers][0]!;
    subscriber(agentMsg);

    await new Promise((r) => setTimeout(r, 20));
    const sendCalls = calls.filter((c) => c.url.includes("sendMessage"));
    expect(sendCalls).toHaveLength(0);
  });
});

// ── YAML connection config parsing ───────────────────────────────────────

describe("YAML connection config", () => {
  test("parses connections field from YAML", () => {
    const raw = parseYaml(`
name: test
agents:
  alice:
    model: claude-sonnet-4-5
connections:
  - platform: telegram
    config:
      bot_token: "abc123"
      chat_id: 456
      channel: general
`);
    const connections = raw.connections as ConnectionDef[];
    expect(connections).toHaveLength(1);
    expect(connections[0]!.platform).toBe("telegram");
    expect(connections[0]!.config!.bot_token).toBe("abc123");
    expect(connections[0]!.config!.chat_id).toBe(456);
  });

  test("YAML without connections has undefined", () => {
    const raw = parseYaml(`
name: test
agents:
  alice:
    model: x
`);
    expect(raw.connections).toBeUndefined();
  });

  test("TelegramAdapter can be constructed from YAML config", () => {
    const raw = parseYaml(`
connections:
  - platform: telegram
    config:
      bot_token: "my-token"
      chat_id: 789
      channel: alerts
      poll_timeout: 10
`);
    const def = raw.connections[0] as ConnectionDef;
    const cfg = def.config as any;
    const adapter = new TelegramAdapter({
      botToken: cfg.bot_token,
      chatId: cfg.chat_id,
      channel: cfg.channel,
      pollTimeout: cfg.poll_timeout,
    });
    expect(adapter.platform).toBe("telegram");
  });

  test("connections without config uses saved connection", () => {
    const raw = parseYaml(`
connections:
  - platform: telegram
`);
    const connections = raw.connections as ConnectionDef[];
    expect(connections).toHaveLength(1);
    expect(connections[0]!.platform).toBe("telegram");
    expect(connections[0]!.config).toBeUndefined();
  });
});
