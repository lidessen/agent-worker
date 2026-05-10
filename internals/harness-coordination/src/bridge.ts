import { extractMentions } from "@agent-worker/harness";
import type {
  Message,
  BridgeSubscriber,
  ChannelBridgeInterface,
  ChannelStoreInterface,
  ChannelAdapter,
} from "@agent-worker/harness";

export class ChannelBridge implements ChannelBridgeInterface {
  private subscribers = new Set<BridgeSubscriber>();
  private adapters: ChannelAdapter[] = [];

  constructor(private readonly channels: ChannelStoreInterface) {
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
      try {
        subscriber(message);
      } catch {
        // Don't let one subscriber crash others
      }
    }
  }
}
