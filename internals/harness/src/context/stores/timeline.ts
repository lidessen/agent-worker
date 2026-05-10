import { nanoid } from "../../utils.ts";
import type { TimelineEvent, StorageBackend, TimelineStoreInterface } from "../../types.ts";

export class TimelineStore implements TimelineStoreInterface {
  constructor(private readonly storage: StorageBackend) {}

  private timelinePath(agentName: string): string {
    return `agents/${agentName}/timeline.jsonl`;
  }

  async append(partial: Omit<TimelineEvent, "id" | "timestamp">): Promise<TimelineEvent> {
    const event: TimelineEvent = {
      ...partial,
      id: nanoid(),
      timestamp: new Date().toISOString(),
    };

    await this.storage.appendLine(this.timelinePath(event.agentName), JSON.stringify(event));

    return event;
  }

  async read(agentName: string, opts?: { limit?: number }): Promise<TimelineEvent[]> {
    const lines = await this.storage.readLines(this.timelinePath(agentName));
    let events = lines.map((line) => JSON.parse(line) as TimelineEvent);

    if (opts?.limit) {
      events = events.slice(-opts.limit);
    }

    return events;
  }
}
