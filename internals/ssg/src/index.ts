// Core SSG
export { createSSG, SSG } from "./ssg";
export { DefaultDocument } from "./document";
export { RawHTML } from "./types";

// Collection
export { defineCollection } from "./collection";

// Sources
export {
  fileSource,
  gitSource,
  remoteSource,
  createSource,
  BaseSource,
  FileSource,
  GitSource,
  RemoteSource,
  CustomSource,
} from "./sources";

// MDX
export { MDXProcessor, createMDXProcessor } from "./mdx";

// Webhook
export { createWebhookHandler, verifyWebhookSignature } from "./watcher";

// Re-export zod for convenience
export { z } from "zod";

// Types
export type {
  // Core types
  SSGConfig,
  SSGInstance,
  CollectionEntry,
  Collection,
  CollectionConfig,
  CollectionSource,
  ChangeSet,
  WatchCallback,
  InferCollections,

  // Route types
  RouteConfig,
  StaticPath,

  // Build types
  BuildOptions,
  BuildResult,
  BuildState,

  // Watch types
  WatchOptions,
  Watcher,

  // Plugin types
  SSGPlugin,
  SSGPluginConfig,

  // MDX types
  MDXConfig,

  // Document types
  DocumentProps,
  DocumentTemplate,
} from "./types";

export type {
  // Source types
  FileSourceOptions,
  GitSourceOptions,
  GitCommitSourceOptions,
  GitTagSourceOptions,
  RemoteSourceOptions,
  WebhookConfig,
  CustomSourceOptions,
} from "./sources";

export type {
  // MDX types
  MDXCompileResult,
  Heading,
} from "./mdx";

export type {
  // Webhook types
  WebhookHandlerOptions,
  WebhookRequest,
  WebhookResponse,
} from "./watcher";
