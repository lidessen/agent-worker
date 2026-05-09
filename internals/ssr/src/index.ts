/**
 * Server-side utilities for SSR with Island architecture
 */

// Main App API (recommended)
export { createApp } from "./app";

// SSR rendering
export { renderToString } from "./render";

// Router (Vite-powered) - legacy API, use createApp instead
export { createViteRouter, ViteRouter } from "./vite-router";

// Builder (for advanced usage)
export {
  createViteIslandBuilder,
  ViteIslandBuilder,
  type ViteBuilderOptions,
} from "./vite-builder";

// Collector (for advanced usage)
export { createIslandCollector, IslandCollector } from "./collector";

// Document templates
export { DefaultDocument, renderDocument } from "./document";

// Resource utilities
export {
  resource,
  STYLE_MARKER,
  LINK_MARKER,
  ASSET_MARKER,
  type ResourceTools,
  type StyleProps,
  type LinkProps,
  type AssetProps,
} from "./client/resource";

// Re-export shared types
export type {
  IslandMetadata,
  IslandScriptContext,
  IslandScriptTransformer,
  RenderToStringOptions,
  SSRResult,
  RouteContext,
  RouteHandler,
  RouteMeta,
  RouterConfig,
  DocumentTemplate,
  LinkMetadata,
  AssetMetadata,
  // App API types
  App,
  AppConfig,
  BuildOptions,
  BuildScriptEntry,
  DevOptions,
  BuildResult,
  RenderResult,
} from "./shared/types";
