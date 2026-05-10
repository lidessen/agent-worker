import { nanoid } from "@agent-worker/harness";
import type { Message, StorageBackend, ChannelStoreInterface } from "@agent-worker/harness";

type MessageListener = (message: Message) => void;

export class ChannelStore implements ChannelStoreInterface {
  private channels = new Set<string>();
  private listeners = new Set<MessageListener>();
  /** In-memory index: messageId → channel for fast lookups. */
  private messageIndex = new Map<string, string>();

  constructor(
    private readonly storage: StorageBackend,
    initialChannels: string[] = [],
  ) {
    for (const ch of initialChannels) {
      this.channels.add(ch);
    }
  }

  private channelPath(channel: string): string {
    return `channels/${channel}.jsonl`;
  }

  createChannel(name: string): void {
    this.channels.add(name);
  }

  listChannels(): string[] {
    return [...this.channels];
  }

  async append(channel: string, partial: Omit<Message, "id" | "timestamp">): Promise<Message> {
    if (!this.channels.has(channel)) {
      this.channels.add(channel);
    }

    const message: Message = {
      ...partial,
      id: nanoid(),
      timestamp: new Date().toISOString(),
    };

    await this.storage.appendLine(this.channelPath(channel), JSON.stringify(message));

    this.messageIndex.set(message.id, channel);
    this.emit(message);
    return message;
  }

  async read(
    channel: string,
    opts?: { since?: string; sinceId?: string; limit?: number },
  ): Promise<Message[]> {
    const lines = await this.storage.readLines(this.channelPath(channel));
    let messages = lines.map((line) => JSON.parse(line) as Message);

    if (opts?.since) {
      const sinceTime = new Date(opts.since).getTime();
      messages = messages.filter((m) => new Date(m.timestamp).getTime() > sinceTime);
    }

    if (opts?.sinceId) {
      const idx = messages.findIndex((m) => m.id === opts.sinceId);
      if (idx !== -1) {
        messages = messages.slice(idx + 1);
      }
    }

    if (opts?.limit) {
      messages = messages.slice(-opts.limit);
    }

    for (const m of messages) {
      this.messageIndex.set(m.id, channel);
    }

    return messages;
  }

  async getMessage(channel: string, messageId: string): Promise<Message | null> {
    const lines = await this.storage.readLines(this.channelPath(channel));
    for (const line of lines) {
      const msg = JSON.parse(line) as Message;
      if (msg.id === messageId) {
        this.messageIndex.set(msg.id, channel);
        return msg;
      }
    }
    return null;
  }

  /** Find a message by ID across all channels (uses index first). */
  async findMessage(messageId: string): Promise<Message | null> {
    const knownChannel = this.messageIndex.get(messageId);
    if (knownChannel) {
      return this.getMessage(knownChannel, messageId);
    }
    for (const ch of this.channels) {
      const msg = await this.getMessage(ch, messageId);
      if (msg) return msg;
    }
    return null;
  }

  /** Load all channels from storage and build the in-memory index. */
  async loadIndex(): Promise<void> {
    for (const ch of this.channels) {
      const lines = await this.storage.readLines(this.channelPath(ch));
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as Message;
          this.messageIndex.set(msg.id, ch);
        } catch {
          // Skip malformed lines (crash recovery)
        }
      }
    }
  }

  /** Clear all messages in a channel. */
  async clear(channel: string): Promise<void> {
    await this.storage.writeFile(this.channelPath(channel), "");
    for (const [id, ch] of this.messageIndex) {
      if (ch === channel) this.messageIndex.delete(id);
    }
  }

  /** Get all messages mentioning a specific agent in a channel. */
  async getMessagesForAgent(channel: string, agentName: string): Promise<Message[]> {
    const messages = await this.read(channel);
    return messages.filter((m) => m.mentions.includes(agentName) || m.to === agentName);
  }

  // ── EventEmitter ────────────────────────────────────────────────────────

  on(_event: "message", listener: MessageListener): void {
    this.listeners.add(listener);
  }

  off(_event: "message", listener: MessageListener): void {
    this.listeners.delete(listener);
  }

  private emit(message: Message): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}
