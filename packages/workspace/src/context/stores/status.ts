import type {
  AgentStatus,
  AgentStatusEntry,
  StorageBackend,
  StatusStoreInterface,
} from "../../types.ts";

const STATUS_FILE = "status.json";

export class StatusStore implements StatusStoreInterface {
  private statuses = new Map<string, AgentStatusEntry>();

  constructor(private readonly storage: StorageBackend) {}

  async set(
    name: string,
    status: AgentStatus,
    currentTask?: string,
  ): Promise<void> {
    const entry: AgentStatusEntry = {
      name,
      status,
      updatedAt: new Date().toISOString(),
      currentTask,
    };
    this.statuses.set(name, entry);
    await this.persist();
  }

  async get(name: string): Promise<AgentStatusEntry | null> {
    return this.statuses.get(name) ?? null;
  }

  async getAll(): Promise<AgentStatusEntry[]> {
    return [...this.statuses.values()];
  }

  /** Load from storage. */
  async load(): Promise<void> {
    const content = await this.storage.readFile(STATUS_FILE);
    if (!content) return;
    try {
      const entries = JSON.parse(content) as AgentStatusEntry[];
      for (const entry of entries) {
        this.statuses.set(entry.name, entry);
      }
    } catch {
      // Skip malformed data
    }
  }

  private async persist(): Promise<void> {
    await this.storage.writeFile(
      STATUS_FILE,
      JSON.stringify([...this.statuses.values()], null, 2),
    );
  }
}
