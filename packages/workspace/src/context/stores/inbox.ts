import type { InboxEntry, StorageBackend, InboxStoreInterface } from "../../types.ts";

export class InboxStore implements InboxStoreInterface {
  /** In-memory inbox per agent: messageId → InboxEntry */
  private inboxes = new Map<string, Map<string, InboxEntry>>();

  constructor(private readonly storage: StorageBackend) {}

  private inboxPath(agentName: string): string {
    return `inbox/${agentName}.jsonl`;
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
    // Invariant #7: one entry per (agent, messageId)
    if (inbox.has(entry.messageId)) return;

    inbox.set(entry.messageId, entry);
    await this.storage.appendLine(this.inboxPath(agentName), JSON.stringify(entry));
  }

  async peek(agentName: string): Promise<InboxEntry[]> {
    const inbox = this.getAgentInbox(agentName);
    const now = Date.now();
    const result: InboxEntry[] = [];

    for (const entry of inbox.values()) {
      if (entry.state === "pending") {
        result.push(entry);
      } else if (entry.state === "deferred") {
        // Check if defer has expired
        if (entry.deferredUntil) {
          const until = new Date(entry.deferredUntil).getTime();
          if (now >= until) {
            entry.state = "pending";
            result.push(entry);
          }
        } else {
          // No expiry → return to pending on next poll
          entry.state = "pending";
          result.push(entry);
        }
      }
    }

    return result.sort(
      (a, b) => new Date(a.enqueuedAt).getTime() - new Date(b.enqueuedAt).getTime(),
    );
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
    }
  }

  async markRunStart(agentName: string): Promise<void> {
    // Clear all stale entries from previous runs
    const inbox = this.getAgentInbox(agentName);
    inbox.clear();
    await this.persistInbox(agentName);
  }

  async hasEntry(agentName: string, messageId: string): Promise<boolean> {
    const inbox = this.getAgentInbox(agentName);
    return inbox.has(messageId);
  }

  /** Load inbox from storage into memory. */
  async load(agentName: string): Promise<void> {
    const lines = await this.storage.readLines(this.inboxPath(agentName));
    const inbox = this.getAgentInbox(agentName);

    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as InboxEntry;
        // Last entry wins (replay semantics)
        inbox.set(entry.messageId, entry);
      } catch {
        // Skip malformed lines
      }
    }
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
