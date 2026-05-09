import { glob } from "glob";
import matter from "gray-matter";
import { readFile, watch as fsWatch } from "fs/promises";
import { join, relative } from "path";
import type { CollectionEntry, ChangeSet, WatchCallback } from "../types";
import type { FileSourceOptions } from "./types";
import { BaseSource } from "./base";

/**
 * File system source for collections
 */
export class FileSource<T = unknown> extends BaseSource<T> {
  id: string;
  private directory: string;
  private include: string;
  private shouldWatch: boolean;
  private contentRoot: string;

  constructor(options: FileSourceOptions, contentRoot: string = process.cwd()) {
    super();
    this.directory = options.directory;
    this.include = options.include ?? "**/*.{md,mdx}";
    this.shouldWatch = options.watch ?? false;
    this.contentRoot = contentRoot;
    this.id = `file:${this.directory}`;
  }

  async getEntries(): Promise<CollectionEntry<T>[]> {
    const dir = join(this.contentRoot, this.directory);
    const pattern = join(dir, this.include);
    const files = await glob(pattern);

    const entries = await Promise.all(
      files.map(async (filePath) => {
        const content = await readFile(filePath, "utf-8");
        const { data, content: body } = matter(content);

        const relativePath = relative(dir, filePath);
        const id = relativePath.replace(/\.(md|mdx)$/, "");
        const slug = id.replace(/\\/g, "/");

        return {
          id,
          slug,
          data: data as T,
          body,
          render: async () => {
            // MDX compilation will be handled by the MDX processor
            return {
              Content: () => {
                throw new Error("MDX rendering not yet implemented");
              },
            };
          },
        };
      }),
    );

    return entries;
  }

  override watch(callback: WatchCallback<T>): () => void {
    if (!this.shouldWatch) {
      return () => {};
    }

    const dir = join(this.contentRoot, this.directory);
    const abortController = new AbortController();

    const startWatching = async () => {
      try {
        const watcher = fsWatch(dir, {
          recursive: true,
          signal: abortController.signal,
        });

        for await (const _event of watcher) {
          // Debounce and collect changes
          const entries = await this.getEntries();
          callback({
            cursor: Date.now().toString(),
            added: [],
            updated: entries,
            deleted: [],
          });
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          throw err;
        }
      }
    };

    startWatching();

    return () => {
      abortController.abort();
    };
  }

  override async getChanges(_since: string): Promise<ChangeSet<T>> {
    // For file source, we do a full reload
    // A more sophisticated implementation could track file mtimes
    const entries = await this.getEntries();
    return {
      cursor: Date.now().toString(),
      added: [],
      updated: entries,
      deleted: [],
    };
  }
}

/**
 * Create a file system source
 */
export function fileSource<T = unknown>(
  options: FileSourceOptions,
  contentRoot?: string,
): FileSource<T> {
  return new FileSource<T>(options, contentRoot);
}
