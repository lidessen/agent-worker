import type {
  EventKind,
  EventLog,
  TimelineEvent,
  ToolCallData,
  TimelineStoreInterface,
} from "../types.ts";

export class WorkspaceEventLog implements EventLog {
  constructor(private readonly timeline: TimelineStoreInterface) {}

  async log(
    agentName: string,
    kind: EventKind,
    content: string,
    opts?: { toolCall?: ToolCallData },
  ): Promise<TimelineEvent> {
    // Invariant #13: message kind goes to channels, not timeline
    if (kind === "message") {
      throw new Error(
        'Cannot log kind="message" to EventLog. Use channel_send instead.',
      );
    }

    return this.timeline.append({
      agentName,
      kind,
      content,
      toolCall: opts?.toolCall,
    });
  }
}
