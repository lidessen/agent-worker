import type { Component, VNode } from "@semajsx/core";
import type { z } from "zod";

// =============================================================================
// Collection Registry (for type inference)
// =============================================================================

/**
 * Infer a registry type from an array of collections
 * Maps collection names to their data types
 */
export type InferCollections<T extends readonly Collection[]> = {
  [K in T[number] as K["name"]]: K extends Collection<infer D> ? D : unknown;
};

// =============================================================================
// Collection Entry
// =============================================================================

export interface CollectionEntry<T = unknown> {
  /** Unique identifier within the collection */
  id: string;
  /** URL-friendly slug */
  slug: string;
  /** Validated frontmatter data */
  data: T;
  /** Raw content body (markdown/mdx) */
  body: string;
  /** Render the content to JSX */
  render: () => Promise<{ Content: () => VNode }>;
}

// =============================================================================
// Collection Source
// =============================================================================

export interface ChangeSet<T = unknown> {
  /** Cursor for next incremental fetch */
  cursor: string;
  /** Newly added entries */
  added: CollectionEntry<T>[];
  /** Updated entries */
  updated: CollectionEntry<T>[];
  /** Deleted entry IDs */
  deleted: string[];
}

export type WatchCallback<T = unknown> = (changes: ChangeSet<T>) => void;

export interface CollectionSource<T = unknown> {
  /** Unique identifier for this source */
  id: string;

  /** Get all entries from this source */
  getEntries(): Promise<CollectionEntry<T>[]>;

  /** Get a single entry by ID */
  getEntry(id: string): Promise<CollectionEntry<T> | null>;

  /** Watch for changes (optional) */
  watch?(callback: WatchCallback<T>): () => void;

  /** Get incremental changes since cursor (optional) */
  getChanges?(since: string): Promise<ChangeSet<T>>;
}

// =============================================================================
// Collection Definition
// =============================================================================

export interface CollectionConfig<T extends z.ZodType = z.ZodType> {
  /** Collection name */
  name: string;
  /** Data source (returns raw entries, validated against schema later) */
  source: CollectionSource<unknown>;
  /** Zod schema for validation */
  schema: T;
}

export interface Collection<T = unknown> {
  name: string;
  source: CollectionSource<unknown>;
  schema: z.ZodType;
  /** Type-only field for inference */
  _outputType?: T;
}

// =============================================================================
// Route Configuration
// =============================================================================

export interface StaticPath<P = Record<string, string>> {
  params: P;
  props?: Record<string, unknown>;
}

export interface RouteConfig<TRegistry extends Record<string, unknown> = Record<string, unknown>> {
  /** Route path pattern (e.g., '/blog/:slug') */
  path: string;
  /** Component to render. Props are provided dynamically by the route config. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Route props are dynamic, typed via `props`/`getStaticPaths`
  component: (props: any) => VNode;
  /** Static props for the route */
  props?:
    | Record<string, unknown>
    | ((ssg: SSGInstance<TRegistry>) => Promise<Record<string, unknown>>);
  /** Generate static paths for dynamic routes */
  getStaticPaths?: (ssg: SSGInstance<TRegistry>) => Promise<StaticPath[]>;
}

// =============================================================================
// MDX Configuration
// =============================================================================

export interface MDXConfig {
  /** Remark plugins */
  remarkPlugins?: unknown[];
  /** Rehype plugins */
  rehypePlugins?: unknown[];
  /** Component mapping for MDX */
  components?: Record<string, Component>;
}

// =============================================================================
// Document Template
// =============================================================================

/**
 * Raw HTML VNode that can be used directly in JSX or converted to string
 */
export class RawHTML {
  public readonly type = "div";
  public readonly props: { dangerouslySetInnerHTML: { __html: string } };
  public readonly children: never[] = [];

  constructor(public readonly html: string) {
    this.props = { dangerouslySetInnerHTML: { __html: html } };
  }

  toString(): string {
    return this.html;
  }
}

export interface DocumentProps {
  /** Rendered page content (VNode with toString) */
  children: RawHTML;
  /** Page title */
  title?: string;
  /** Base URL path */
  base: string;
  /** Route path */
  path: string;
  /** Route props */
  props: Record<string, unknown>;
  /** Script tags for islands (as RawHTML) */
  scripts?: RawHTML;
  /** CSS stylesheet paths */
  css?: string[];
  /** Inline CSS collected from StyleTokens */
  styles?: string[];
}

export type DocumentTemplate = (props: DocumentProps) => VNode;

// =============================================================================
// Plugin System
// =============================================================================

/**
 * Partial SSG config that a plugin's config() hook can return.
 * Each field has a defined merge strategy:
 * - mdx: merge (concat arrays, merge component objects)
 * - document: override (last writer wins)
 * - routes: concat
 * - collections: concat
 */
export interface SSGPluginConfig {
  mdx?: Partial<MDXConfig>;
  document?: DocumentTemplate;
  routes?: RouteConfig[];
  collections?: readonly Collection[];
}

export interface SSGPlugin {
  /** Plugin name for identification and debugging */
  name: string;

  /** Plugin ordering: 'pre' runs before normal plugins, 'post' runs after */
  enforce?: "pre" | "post";

  /**
   * Modify SSG config before it is resolved.
   * Return partial config to merge.
   * Called in plugin order: enforce:'pre' → normal → enforce:'post' → user config.
   */
  config?(config: SSGConfig): SSGPluginConfig | void;

  /** Called after config is fully resolved. Read-only inspection. */
  configResolved?(config: SSGConfig): void;

  /** Called before build starts */
  buildStart?(): void | Promise<void>;

  /** Called after build completes. Receives the SSG instance for post-build operations. */
  buildEnd?(result: BuildResult, ssg: SSGInstance): void | Promise<void>;
}

// =============================================================================
// SSG Configuration
// =============================================================================

export interface SSGConfig<
  TCollections extends readonly Collection[] = Collection[],
  TRegistry extends Record<string, unknown> = InferCollections<TCollections>,
> {
  /** Output directory for built files */
  outDir: string;
  /** Root directory for resolving relative paths (defaults to script location) */
  rootDir?: string;
  /** Base URL path */
  base?: string;
  /** Collections to include */
  collections?: TCollections;
  /** Route definitions */
  routes?: RouteConfig<TRegistry>[];
  /** Plugins that contribute remark/rehype plugins and components.
   * Plugin factories may return arrays (Vite-style); nested arrays are flattened. */
  plugins?: (SSGPlugin | SSGPlugin[])[];
  /** MDX configuration (merged after plugins, takes precedence) */
  mdx?: MDXConfig;
  /** Custom document template */
  document?: DocumentTemplate;
}

// =============================================================================
// Build State & Result
// =============================================================================

export interface BuildState {
  /** Cursor for each collection */
  cursors: Record<string, string>;
  /** Content hash for each page */
  pageHashes: Record<string, string>;
  /** Last build timestamp */
  timestamp: number;
}

export interface BuildResult {
  /** New build state for incremental builds */
  state: BuildState;
  /** Paths that were built */
  paths: string[];
  /** Build statistics */
  stats: {
    added: number;
    updated: number;
    deleted: number;
    unchanged: number;
  };
}

export interface BuildOptions {
  /** Enable incremental build */
  incremental?: boolean;
  /** Previous build state */
  state?: BuildState;
  /** Only build specific collections */
  collections?: string[];
}

// =============================================================================
// Watcher
// =============================================================================

export interface WatchOptions {
  /** Callback when rebuild completes */
  onRebuild?: (result: BuildResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface Watcher {
  /** Stop watching */
  close(): void;
}

// =============================================================================
// SSG Instance
// =============================================================================

export interface SSGInstance<TRegistry extends Record<string, unknown> = Record<string, unknown>> {
  /** Get the root directory for resolving paths */
  getRootDir(): string;

  /** Get all entries from a collection */
  getCollection<K extends keyof TRegistry & string>(
    name: K,
  ): Promise<CollectionEntry<TRegistry[K]>[]>;

  /** Get a single entry from a collection */
  getEntry<K extends keyof TRegistry & string>(
    name: K,
    id: string,
  ): Promise<CollectionEntry<TRegistry[K]> | null>;

  /** Build the static site */
  build(options?: BuildOptions): Promise<BuildResult>;

  /** Watch for changes and rebuild */
  watch(options?: WatchOptions): Watcher;
}
