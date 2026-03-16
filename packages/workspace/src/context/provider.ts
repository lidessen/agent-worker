import type {
  Message,
  ContextProvider,
  ChannelStoreInterface,
  InboxStoreInterface,
  DocumentStoreInterface,
  ResourceStoreInterface,
  StatusStoreInterface,
  TimelineStoreInterface,
} from "../types.ts";

export interface ContextProviderConfig {
  channels: ChannelStoreInterface;
  inbox: InboxStoreInterface;
  documents: DocumentStoreInterface;
  resources: ResourceStoreInterface;
  status: StatusStoreInterface;
  timeline: TimelineStoreInterface;
  /** Max message length in characters. Default: 1200 */
  maxMessageLength?: number;
}

export class CompositeContextProvider implements ContextProvider {
  readonly channels: ChannelStoreInterface;
  readonly inbox: InboxStoreInterface;
  readonly documents: DocumentStoreInterface;
  readonly resources: ResourceStoreInterface;
  readonly status: StatusStoreInterface;
  readonly timeline: TimelineStoreInterface;

  private readonly maxMessageLength: number;

  constructor(config: ContextProviderConfig) {
    this.channels = config.channels;
    this.inbox = config.inbox;
    this.documents = config.documents;
    this.resources = config.resources;
    this.status = config.status;
    this.timeline = config.timeline;
    this.maxMessageLength = config.maxMessageLength ?? 1200;
  }

  async send(msg: {
    channel: string;
    from: string;
    content: string;
    to?: string;
  }): Promise<Message> {
    const { extractMentions } = await import("../utils.ts");

    if (msg.content.length > this.maxMessageLength) {
      throw new Error(
        `Message too long (${msg.content.length} chars, max ${this.maxMessageLength}). ` +
          `Use resource_create to store large content first, then send a short message with the resource ID.`,
      );
    }

    const mentions = extractMentions(msg.content);
    return this.channels.append(msg.channel, {
      from: msg.from,
      channel: msg.channel,
      content: msg.content,
      mentions,
      to: msg.to,
      kind: "message",
    });
  }
}
