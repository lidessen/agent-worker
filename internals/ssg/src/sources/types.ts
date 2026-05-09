import type { CollectionSource, ChangeSet, WatchCallback } from "../types";

// =============================================================================
// File Source
// =============================================================================

export interface FileSourceOptions {
  /** Directory path relative to content root */
  directory: string;
  /** Glob pattern for files (default: **\/*.md,mdx) */
  include?: string;
  /** Enable file watching */
  watch?: boolean;
}

// =============================================================================
// Git Source
// =============================================================================

export interface GitCommitSourceOptions {
  type: "commits";
  /** Filter commits by paths */
  filter?: {
    paths?: string[];
    since?: string;
    until?: string;
    author?: string;
  };
  /** Max commits to fetch */
  limit?: number;
}

export interface GitTagSourceOptions {
  type: "tags";
  /** Tag pattern (e.g., 'v*') */
  pattern?: string;
}

export type GitSourceOptions = GitCommitSourceOptions | GitTagSourceOptions;

// =============================================================================
// Remote Source
// =============================================================================

export interface WebhookConfig {
  /** Webhook endpoint path */
  path: string;
  /** Secret for verification */
  secret?: string;
}

export interface RemoteSourceOptions<T> {
  /** Fetch all entries */
  fetch: () => Promise<T[]>;
  /** Fetch single entry (optional) */
  fetchOne?: (id: string) => Promise<T | null>;
  /** Fetch incremental changes (optional) */
  fetchChanges?: (cursor: string) => Promise<ChangeSet<T>>;
  /** Webhook configuration (optional) */
  webhook?: WebhookConfig;
  /** Polling interval in ms (optional) */
  pollInterval?: number;
}

// =============================================================================
// Custom Source
// =============================================================================

export interface CustomSourceOptions<T> {
  /** Unique identifier */
  id: string;
  /** Get all entries */
  getEntries: () => Promise<T[]>;
  /** Get single entry (optional) */
  getEntry?: (id: string) => Promise<T | null>;
  /** Watch for changes (optional) */
  watch?: (callback: WatchCallback<T>) => () => void;
  /** Get incremental changes (optional) */
  getChanges?: (since: string) => Promise<ChangeSet<T>>;
}

// =============================================================================
// Source Factory Types
// =============================================================================

export type SourceFactory<T, O> = (options: O) => CollectionSource<T>;
