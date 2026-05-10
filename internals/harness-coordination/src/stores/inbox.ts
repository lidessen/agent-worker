import type { InboxEntry, StorageBackend, InboxStoreInterface } from "@agent-worker/harness";

export class InboxStore implements InboxStoreInterface {
  /** In-memory inbox per agent: messageId → InboxEntry */
  private inboxes = new Map<string, Map<string, InboxEntry>>();
  /** One-shot listeners waiting for new inbox entries per agent. */
  private listeners = new Map<string, Array<() => void>>();
  /** Agents whose inbox has already been loaded from storage. */
  private loadedAgents = new Set<string>();

  constructor(private readonly storage: StorageBackend) {}

  private inboxPath(agentName: string): string {
    return `agents/${agentName}/inbox.jsonl`;
  }

  private getAgentInbox(agentName: string): Map<string, InboxEntry> {
    let inbox = this.inboxes.get(agentName);
    if (!inbox) {
      inbox = new Map();
      this.inboxes.set(agentName, inbox);
    }
    return inbox;
  }

  async enqueue(agentName: string, entry: InboxEntry): Promise<void> {
    const inbox = this.getAgentInbox(agentName);
    if (inbox.has(entry.messageId)) return;

    inbox.set(entry.messageId, entry);
    await this.storage.appendLine(this.inboxPath(agentName), JSON.stringify(entry));

    const cbs = this.listeners.get(agentName);
    if (cbs && cbs.length > 0) {
      const batch = cbs.splice(0);
      for (const cb of batch) cb();
    }
  }

  async peek(agentName: string): Promise<InboxEntry[]> {
    const inbox = this.getAgentInbox(agentName);
    const now = Date.now();
    const result: InboxEntry[] = [];

    for (const entry of inbox.values()) {
      if (entry.state === "pending") {
        result.push(entry);
      } else if (entry.state === "deferred") {
        if (entry.deferredUntil) {
          const until = new Date(entry.deferredUntil).getTime();
          if (now >= until) {
            entry.state = "pending";
            result.push(entry);
          }
        } else {
          entry.state = "pending";
          result.push(entry);
        }
      }
    }

    return result.sort(
      (a, b) => new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime(),
    );
  }

  async inspect(agentName: string): Promise<InboxEntry[]> {
    const inbox = this.getAgentInbox(agentName);
    return [...inbox.values()]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime());
  }

  async ack(agentName: string, messageId: string): Promise<void> {
    const inbox = this.getAgentInbox(agentName);
    inbox.delete(messageId);
    await this.persistInbox(agentName);
  }

  async defer(agentName: string, messageId: string, until?: string): Promise<void> {
    const inbox = this.getAgentInbox(agentName);
    const entry = inbox.get(messageId);
    if (!entry) return;

    entry.state = "deferred";
    entry.deferredUntil = until;
    await this.persistInbox(agentName);
  }

  async markSeen(agentName: string, messageId: string): Promise<void> {
    const inbox = this.getAgentInbox(agentName);
    const entry = inbox.get(messageId);
    if (!entry) return;

    if (entry.state === "pending") {
      entry.state = "seen";
      await this.persistInbox(agentName);
    }
  }

  async markRunStart(agentName: string): Promise<void> {
    const inbox = this.getAgentInbox(agentName);
    for (const entry of inbox.values()) {
      if (entry.state === "seen") {
        entry.state = "pending";
      }
    }
    await this.persistInbox(agentName);
  }

  async hasEntry(agentName: string, messageId: string): Promise<boolean> {
    const inbox = this.getAgentInbox(agentName);
    return inbox.has(messageId);
  }

  /** Load inbox from storage into memory. */
  async load(agentName: string): Promise<void> {
    if (this.loadedAgents.has(agentName)) return;

    const lines = await this.storage.readLines(this.inboxPath(agentName));
    const inbox = this.getAgentInbox(agentName);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as InboxEntry;
        inbox.set(entry.messageId, entry);
      } catch {
        // Skip malformed lines
      }
    }
    this.loadedAgents.add(agentName);
  }

  /** Register a one-shot listener for when a new inbox entry arrives. */
  onNewEntry(agentName: string): Promise<void> {
    return new Promise((resolve) => {
      const list = this.listeners.get(agentName) ?? [];
      list.push(resolve);
      this.listeners.set(agentName, list);
    });
  }

  private async persistInbox(agentName: string): Promise<void> {
    const inbox = this.getAgentInbox(agentName);
    const lines = [...inbox.values()].map((e) => JSON.stringify(e));
    await this.storage.writeFile(
      this.inboxPath(agentName),
      lines.join("\n") + (lines.length > 0 ? "\n" : ""),
    );
  }
}
