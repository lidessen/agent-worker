import { exec } from "child_process";
import { promisify } from "util";
import type { CollectionEntry } from "../types";
import type { GitSourceOptions, GitCommitSourceOptions, GitTagSourceOptions } from "./types";
import { BaseSource } from "./base";

const execAsync = promisify(exec);

/**
 * Git source for collections
 */
export class GitSource<T = unknown> extends BaseSource<T> {
  id: string;
  private options: GitSourceOptions;
  private cwd: string;

  constructor(options: GitSourceOptions, cwd: string = process.cwd()) {
    super();
    this.options = options;
    this.cwd = cwd;
    this.id = `git:${options.type}`;
  }

  async getEntries(): Promise<CollectionEntry<T>[]> {
    if (this.options.type === "commits") {
      return this.getCommits(this.options);
    } else {
      return this.getTags(this.options);
    }
  }

  private async getCommits(options: GitCommitSourceOptions): Promise<CollectionEntry<T>[]> {
    const args = ["log", "--format=%H|%s|%an|%ae|%aI"];

    if (options.filter?.since) {
      args.push(`--since=${options.filter.since}`);
    }
    if (options.filter?.until) {
      args.push(`--until=${options.filter.until}`);
    }
    if (options.filter?.author) {
      args.push(`--author=${options.filter.author}`);
    }
    if (options.limit) {
      args.push(`-n`, options.limit.toString());
    }
    if (options.filter?.paths?.length) {
      args.push("--", ...options.filter.paths);
    }

    const { stdout } = await execAsync(`git ${args.join(" ")}`, {
      cwd: this.cwd,
    });
    const lines = stdout.trim().split("\n").filter(Boolean);

    return lines.map((line) => {
      const parts = line.split("|");
      const hash = parts[0] ?? "";
      const message = parts[1] ?? "";
      const author = parts[2] ?? "";
      const email = parts[3] ?? "";
      const dateStr = parts[4] ?? "";

      const data = {
        hash,
        message,
        author,
        email,
        date: new Date(dateStr),
      } as unknown as T;

      return {
        id: hash,
        slug: hash.slice(0, 7),
        data,
        body: message,
        render: async () => ({
          Content: () => {
            throw new Error("Git commits cannot be rendered as content");
          },
        }),
      };
    });
  }

  private async getTags(options: GitTagSourceOptions): Promise<CollectionEntry<T>[]> {
    const pattern = options.pattern ?? "*";

    // Get tags with date and message
    const { stdout } = await execAsync(
      `git tag -l "${pattern}" --format="%(refname:short)|%(objectname:short)|%(creatordate:iso)|%(contents:subject)"`,
      { cwd: this.cwd },
    );

    const lines = stdout.trim().split("\n").filter(Boolean);

    return lines.map((line) => {
      const parts = line.split("|");
      const tag = parts[0] ?? "";
      const hash = parts[1] ?? "";
      const dateStr = parts[2] ?? "";
      const message = parts[3] ?? "";

      const data = {
        tag,
        hash,
        date: new Date(dateStr),
        message: message || undefined,
      } as unknown as T;

      return {
        id: tag,
        slug: tag,
        data,
        body: message,
        render: async () => ({
          Content: () => {
            throw new Error("Git tags cannot be rendered as content");
          },
        }),
      };
    });
  }
}

/**
 * Create a Git source
 */
export function gitSource<T = unknown>(options: GitSourceOptions, cwd?: string): GitSource<T> {
  return new GitSource<T>(options, cwd);
}
