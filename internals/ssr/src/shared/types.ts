import type { JSXNode, VNode } from "@semajsx/core";
import type { UserConfig as ViteUserConfig, ViteDevServer } from "vite";

/**
 * Island metadata collected during SSR rendering
 */
export interface IslandMetadata {
  /** Unique identifier for this island instance */
  id: string;
  /** Module path to the island component */
  path: string;
  /** Serialized props for the island */
  props: Record<string, any>;
  /** Component name (for debugging) */
  componentName?: string;
}

/**
 * Context passed to island script transformer
 */
export interface IslandScriptContext {
  /** Unique identifier for this island instance */
  id: string;
  /** Module path to the island component */
  path: string;
  /** Serialized props for the island */
  props: Record<string, any>;
  /** Component name */
  componentName: string;
  /** Base path for islands */
  basePath: string;
}

/**
 * Function to transform island metadata into custom script code
 * Return null or empty string to skip script generation for this island
 */
export type IslandScriptTransformer = (context: IslandScriptContext) => string | null;

/**
 * Options for renderToString
 */
export interface RenderToStringOptions {
  /**
   * Custom transformer for island scripts.
   * If not provided, no client-side scripts are generated (static HTML only).
   * Provide this to enable client-side hydration with custom script generation.
   */
  transformIslandScript?: IslandScriptTransformer;
  /**
   * Root directory for computing component keys.
   * Defaults to process.cwd().
   */
  rootDir?: string;
}

/**
 * Result of SSR rendering with islands
 */
export interface SSRResult {
  /** Rendered HTML string (page content only) */
  html: string;
  /** List of islands found during rendering */
  islands: IslandMetadata[];
  /** Script tags to load island code */
  scripts: string;
  /** Complete HTML document (if document template was provided) */
  document?: string;
  /** Collected CSS file paths */
  css: string[];
  /** Collected inline CSS from StyleTokens */
  styles: string[];
  /** Collected asset file paths */
  assets: string[];
}

/**
 * Link resource metadata
 */
export interface LinkMetadata {
  href: string;
  rel: string;
  as?: string;
}

/**
 * Asset resource metadata
 */
export interface AssetMetadata {
  src: string;
  type: "image" | "font" | "script";
}

/**
 * Island component marker attached to VNode
 */
export interface IslandMarker {
  /** Module path to the island component */
  modulePath: string;
  /** Original component function */
  component: Function;
  /** Props passed to the component */
  props: any;
}

// ========================
// Route Context Types
// ========================

/**
 * Route context passed to route handlers
 */
export interface RouteContext {
  /** Route parameters (e.g., /post/:id → { id: "123" }) */
  params: Record<string, string>;
  /** Query string parameters (e.g., ?q=test → { q: "test" }) */
  query: Record<string, string>;
}

/**
 * Route handler function
 */
export type RouteHandler = (context: RouteContext) => VNode;

/**
 * Route metadata for per-route configuration
 */
export interface RouteMeta {
  /** Page title */
  title?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Document template function for rendering complete HTML documents
 */
export type DocumentTemplate = (props: {
  /** Page content (JSX node - can be string, VNode, etc.) */
  children: JSXNode;
  /** Island script tags (JSX node - can be string, VNode, etc.) */
  scripts: JSXNode;
  /** Island metadata (for custom processing) */
  islands: IslandMetadata[];
  /** Collected CSS file paths */
  css: string[];
  /** Current route path */
  path: string;
  /** Page title (optional, should be provided by user) */
  title?: string;
  /** Additional metadata (optional) */
  meta?: Record<string, any>;
}) => VNode;

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Enable code caching */
  enableCache?: boolean;
  /** Development mode (uses Vite for module transformation) */
  dev?: boolean;
  /** Project root directory (for Vite) */
  root?: string;
  /** Custom build options (for production bundling) */
  buildOptions?: {
    minify?: boolean;
    sourcemap?: boolean;
  };
  /** HTML document template (JSX) */
  document?: DocumentTemplate;
  /** Default page title (passed to document template) */
  title?: string;
  /** Additional metadata (passed to document template) */
  meta?: Record<string, any>;
}

/**
 * Resource collection configuration
 */
export interface ResourceConfig {
  /**
   * Capture patterns based on source file types (like VSCode file nesting)
   * Keys are glob patterns, values are arrays of capture patterns
   * ${capture} is replaced with the base filename (without extension)
   *
   * @example
   * {
   *   '**\/*.tsx': ['${capture}.css', '${capture}.module.css'],
   *   'src/components/**\/*.tsx': ['${capture}.styles.css']
   * }
   */
  capture?: Record<string, string[]>;

  /**
   * Additional glob patterns to include
   * @example ['src/styles/**\/*.css']
   */
  include?: string[];

  /**
   * Glob patterns to exclude
   * @example ['**\/*.test.*', 'node_modules/**']
   */
  exclude?: string[];
}

// ========================
// App API Types
// ========================

/**
 * App configuration
 */
export interface AppConfig {
  /** Route definitions (use app.route() for type-safe params) */
  routes?: Record<string, RouteHandler>;

  /** Vite configuration (fully exposed) */
  vite?: ViteUserConfig;

  /** Island configuration */
  islands?: {
    /** Enable caching (default: true) */
    cache?: boolean;
    /** Maximum cache size (default: 1000) */
    cacheSize?: number;
  };

  /** HTML document template */
  document?: DocumentTemplate;

  /** Default page title */
  title?: string;

  /** Additional metadata */
  meta?: Record<string, any>;

  /** Project root directory */
  root?: string;

  /** Resource collection configuration */
  resources?: ResourceConfig;
}

/**
 * Script entry included in a build page (e.g., island hydration scripts).
 */
export interface BuildScriptEntry {
  /** Script module URL (resolved by Vite during build) */
  src: string;
}

/**
 * Build options for production
 */
export interface BuildOptions {
  /** Output directory (default: 'dist') */
  outDir?: string;

  /** Build mode */
  mode?: "full" | "on-demand";

  /** Minify output (default: true) */
  minify?: boolean;

  /** Generate sourcemaps (default: false) */
  sourcemap?: boolean;

  /** Additional Vite build config */
  vite?: ViteUserConfig;

  /** Callback when an island is built */
  onIslandBuilt?: (island: IslandMetadata) => void;

  /**
   * Custom HTML renderer for build output.
   * When provided, used instead of the default minimal HTML template.
   * This allows callers (e.g., SSG) to inject their own Document template
   * with custom head elements (fonts, meta tags, etc.).
   */
  renderHtml?: (opts: {
    /** Rendered page content (HTML string) */
    html: string;
    /** CSS stylesheet paths */
    css: string[];
    /** Inline CSS collected from StyleTokens */
    styles: string[];
    /** Island script entries to include */
    scripts: BuildScriptEntry[];
    /** Page title */
    title: string;
    /** Route path */
    path: string;
  }) => string;
}

/**
 * Development server options
 */
export interface DevOptions {
  /** Server port (default: 3000) */
  port?: number;

  /** Server host (default: 'localhost') */
  host?: string;

  /** Open browser on start */
  open?: boolean;
}

/**
 * Build result
 */
export interface BuildResult {
  /** Output directory path */
  outDir: string;

  /** Built islands */
  islands: Array<{
    id: string;
    path: string;
    outputPath: string;
  }>;

  /** Routes in the build */
  routes: string[];
}

/**
 * Render result (same as SSRResult)
 */
export type RenderResult = SSRResult;

/**
 * App interface
 */
export interface App {
  /** App configuration */
  readonly config: AppConfig;

  /** Register a route */
  route(path: string, handler: RouteHandler, meta?: RouteMeta): this;

  /** Register multiple routes */
  routes(routes: Record<string, RouteHandler>): this;

  /** Initialize the app (Vite dev server) */
  prepare(): Promise<void>;

  /** Close and cleanup resources */
  close(): Promise<void>;

  /** Render a path to HTML */
  render(path: string): Promise<RenderResult>;

  /** Start development server */
  dev(options?: DevOptions): Promise<{ port: number; close: () => Promise<void> }>;

  /** Build for production */
  build(options?: BuildOptions): Promise<BuildResult>;

  /** Handle HTTP request (for custom server integration) */
  handleRequest(request: Request): Promise<Response>;

  /** Get Vite dev server instance */
  getViteServer(): ViteDevServer | null;

  /** Get island entry point code */
  getIslandEntryPoint(islandId: string): Promise<string>;

  /** Get island metadata */
  getIsland(islandId: string): IslandMetadata | undefined;
}
