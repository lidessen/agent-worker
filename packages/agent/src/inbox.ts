import type { InboxMessage, InboxConfig, WaitResult, Message } from "./types.ts";

let nextMsgId = 1;

export class Inbox {
  private messages: InboxMessage[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private waitResolvers: Array<() => void> = [];
  private messageCounter = 0;
  private lastPeekCounter = 0;

  private readonly debounceMs: number;
  private readonly peekThreshold: number;

  constructor(
    config: InboxConfig = {},
    private onWake: () => void = () => {},
  ) {
    this.debounceMs = config.debounceMs ?? 200;
    this.peekThreshold = config.peekThreshold ?? 200;
  }

  /** Push a message into the inbox. Triggers debounced wake if agent is idle. */
  push(input: string | Message): InboxMessage {
    const msg: InboxMessage = {
      id: `msg_${nextMsgId++}`,
      content: typeof input === "string" ? input : input.content,
      from: typeof input === "string" ? undefined : input.from,
      timestamp: Date.now(),
      status: "unread",
    };
    this.messages.push(msg);
    this.messageCounter++;

    // Resolve any pending wait()
    for (const resolve of this.waitResolvers) {
      resolve();
    }
    this.waitResolvers = [];

    // Debounced wake
    this.scheduleDebouncedWake();

    return msg;
  }

  private scheduleDebouncedWake(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.onWake();
    }, this.debounceMs);
  }

  /** Cancel pending debounce (e.g. when agent is already processing) */
  cancelDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /** Set the wake callback */
  setOnWake(fn: () => void): void {
    this.onWake = fn;
  }

  /** Get all unread messages */
  get unread(): readonly InboxMessage[] {
    return this.messages.filter((m) => m.status === "unread");
  }

  /** Get all messages */
  get all(): readonly InboxMessage[] {
    return this.messages;
  }

  /** Read a specific message by ID, mark as read */
  read(id: string): InboxMessage | null {
    const msg = this.messages.find((m) => m.id === id);
    if (!msg) return null;
    msg.status = "read";
    return msg;
  }

  /** Check if new messages arrived since last peek */
  hasNewSinceLastPeek(): boolean {
    return this.messageCounter > this.lastPeekCounter;
  }

  /**
   * Generate inbox peek for prompt injection.
   * Short messages are auto-marked read, long messages are truncated.
   */
  peek(): string {
    this.lastPeekCounter = this.messageCounter;
    const unread = this.unread;
    if (unread.length === 0) return "📥 Inbox: empty";

    const lines = unread.map((msg) => {
      const from = msg.from ? `from:${msg.from} — ` : "";
      if (msg.content.length <= this.peekThreshold) {
        // Short message: deliver in full, auto-mark read
        msg.status = "read";
        return `• [${msg.id}] ${from}"${msg.content}" ✓`;
      }
      // Long message: truncated preview
      const preview = msg.content.slice(0, this.peekThreshold);
      return `• [${msg.id}] ${from}"${preview}..." (truncated, inbox.read("${msg.id}") for full)`;
    });

    return `📥 Inbox (${unread.length} unread):\n${lines.join("\n")}`;
  }

  /** Wait for a new message to arrive, or timeout */
  wait(timeoutMs?: number): Promise<WaitResult> {
    return new Promise<WaitResult>((resolve) => {
      // Check if already have unread
      if (this.unread.length > 0) {
        resolve({ timeout: false });
        return;
      }

      let timer: ReturnType<typeof setTimeout> | null = null;

      const onMessage = () => {
        if (timer) clearTimeout(timer);
        resolve({ timeout: false });
      };

      this.waitResolvers.push(onMessage);

      if (timeoutMs !== undefined) {
        timer = setTimeout(() => {
          // Remove resolver
          const idx = this.waitResolvers.indexOf(onMessage);
          if (idx >= 0) this.waitResolvers.splice(idx, 1);
          resolve({ timeout: true });
        }, timeoutMs);
      }
    });
  }

  /** Count of unread messages */
  get unreadCount(): number {
    return this.messages.filter((m) => m.status === "unread").length;
  }
}
