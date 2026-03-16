import type {
  Message,
  Priority,
  EventKind,
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
  /** SmartSend threshold. Default: 1200 */
  smartSendThreshold?: number;
}

export class CompositeContextProvider implements ContextProvider {
  readonly channels: ChannelStoreInterface;
  readonly inbox: InboxStoreInterface;
  readonly documents: DocumentStoreInterface;
  readonly resources: ResourceStoreInterface;
  readonly status: StatusStoreInterface;
  readonly timeline: TimelineStoreInterface;

  private readonly smartSendThreshold: number;

  constructor(config: ContextProviderConfig) {
    this.channels = config.channels;
    this.inbox = config.inbox;
    this.documents = config.documents;
    this.resources = config.resources;
    this.status = config.status;
    this.timeline = config.timeline;
    this.smartSendThreshold = config.smartSendThreshold ?? 1200;
  }

  async smartSend(
    channel: string,
    from: string,
    content: string,
    opts?: { to?: string; priority?: Priority; kind?: EventKind },
  ): Promise<Message> {
    const { extractMentions } = await import("../utils.ts");
    const mentions = extractMentions(content);
    const kind = opts?.kind ?? "message";

    // Only "message" kind goes to channels (Invariant #12)
    if (kind !== "message") {
      throw new Error(`Cannot send kind="${kind}" to channel. Only "message" kind is allowed.`);
    }

    // Hard limit: reject messages that exceed the threshold.
    // Agents must use resource_create for large content, then send a short
    // message referencing the resource ID.
    if (content.length > this.smartSendThreshold) {
      throw new Error(
        `Message too long (${content.length} chars, max ${this.smartSendThreshold}). ` +
          `Use resource_create to store large content first, then send a short message with the resource ID.`,
      );
    }

    const message = await this.channels.append(channel, {
      from,
      channel,
      content,
      mentions,
      to: opts?.to,
      kind,
    });

    return message;
  }
}
