import type {
  Message,
  BridgeSubscriber,
  ChannelBridgeInterface,
  ChannelStoreInterface,
  ChannelAdapter,
} from "../types.ts";
import { extractMentions } from "../utils.ts";

export class ChannelBridge implements ChannelBridgeInterface {
  private subscribers = new Set<BridgeSubscriber>();
  private adapters: ChannelAdapter[] = [];

  constructor(private readonly channels: ChannelStoreInterface) {
    // Listen to channel messages and dispatch to subscribers
    this.channels.on("message", (message) => {
      this.dispatch(message);
    });
  }

  async send(channel: string, from: string, content: string): Promise<Message> {
    const mentions = extractMentions(content);
    return this.channels.append(channel, {
      from,
      channel,
      content,
      mentions,
      kind: "message",
    });
  }

  subscribe(callback: BridgeSubscriber): void {
    this.subscribers.add(callback);
  }

  unsubscribe(callback: BridgeSubscriber): void {
    this.subscribers.delete(callback);
  }

  /** Register and start an adapter. */
  async addAdapter(adapter: ChannelAdapter): Promise<void> {
    this.adapters.push(adapter);
    await adapter.start(this);
  }

  /** Shutdown all adapters. */
  async shutdown(): Promise<void> {
    for (const adapter of this.adapters) {
      await adapter.shutdown();
    }
    this.adapters = [];
  }

  private dispatch(message: Message): void {
    for (const subscriber of this.subscribers) {
      // Anti-loop: check if the subscriber's platform matches the message source
      // Adapters should check message.from to avoid echo loops
      try {
        subscriber(message);
      } catch {
        // Don't let one subscriber crash others
      }
    }
  }
}
