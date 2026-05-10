import type { CollectionEntry, ChangeSet, WatchCallback } from "../types";
import type { RemoteSourceOptions, WebhookConfig } from "./types";
import { BaseSource } from "./base";

/**
 * Remote API source for collections
 */
export class RemoteSource<T = unknown> extends BaseSource<T> {
  id: string;
  private options: RemoteSourceOptions<T>;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(options: RemoteSourceOptions<T>, id: string = "remote") {
    super();
    this.options = options;
    this.id = `remote:${id}`;
  }

  async getEntries(): Promise<CollectionEntry<T>[]> {
    const items = await this.options.fetch();

    return items.map((item, index) => {
      const id = (item as Record<string, unknown>).id?.toString() ?? index.toString();
      const slug = (item as Record<string, unknown>).slug?.toString() ?? id;

      return {
        id,
        slug,
        data: item,
        body: (item as Record<string, unknown>).content?.toString() ?? "",
        render: async () => ({
          Content: () => {
            throw new Error("Remote content rendering not yet implemented");
          },
        }),
      };
    });
  }

  override async getEntry(id: string): Promise<CollectionEntry<T> | null> {
    if (this.options.fetchOne) {
      const item = await this.options.fetchOne(id);
      if (!item) return null;

      const slug = (item as Record<string, unknown>).slug?.toString() ?? id;

      return {
        id,
        slug,
        data: item,
        body: (item as Record<string, unknown>).content?.toString() ?? "",
        render: async () => ({
          Content: () => {
            throw new Error("Remote content rendering not yet implemented");
          },
        }),
      };
    }

    return super.getEntry(id);
  }

  override watch(callback: WatchCallback<T>): () => void {
    if (this.options.pollInterval) {
      this.pollTimer = setInterval(async () => {
        const entries = await this.getEntries();
        callback({
          cursor: Date.now().toString(),
          added: [],
          updated: entries,
          deleted: [],
        });
      }, this.options.pollInterval);

      return () => {
        if (this.pollTimer) {
          clearInterval(this.pollTimer);
        }
      };
    }

    return () => {};
  }

  override async getChanges(since: string): Promise<ChangeSet<T>> {
    if (this.options.fetchChanges) {
      return this.options.fetchChanges(since);
    }

    // Fallback to full reload
    const entries = await this.getEntries();
    return {
      cursor: Date.now().toString(),
      added: [],
      updated: entries,
      deleted: [],
    };
  }

  /**
   * Get webhook configuration for external integration
   */
  getWebhookConfig(): WebhookConfig | undefined {
    return this.options.webhook;
  }
}

/**
 * Create a remote API source
 */
export function remoteSource<T = unknown>(
  options: RemoteSourceOptions<T>,
  id?: string,
): RemoteSource<T> {
  return new RemoteSource<T>(options, id);
}
