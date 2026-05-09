import type {
  RouteContext,
  RouteHandler,
  RouterConfig,
  SSRResult,
  IslandMetadata,
  DocumentTemplate,
} from "./shared/types";
import { renderToString } from "./render";
import { createViteIslandBuilder, type ViteIslandBuilder } from "./vite-builder";
import type { ViteDevServer } from "vite";
import { LRUCache } from "./lru-cache";

/**
 * Route matcher result
 */
interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
}

/**
 * Internal router configuration with required base fields
 */
interface InternalRouterConfig {
  enableCache: boolean;
  dev: boolean;
  root: string;
  buildOptions: { minify: boolean; sourcemap: boolean };
  document?: DocumentTemplate;
  title?: string;
  meta?: Record<string, any>;
}

/**
 * Vite-powered SSR Router with island support
 * Uses Vite dev server for module transformation in dev mode
 */
export class ViteRouter {
  private routeMap: Map<string, RouteHandler> = new Map();
  private dynamicRoutes: Array<{ pattern: RegExp; handler: RouteHandler }> = [];
  private builder: ViteIslandBuilder | null = null;
  private config: InternalRouterConfig;
  // Use LRU cache to prevent memory leaks from unbounded island storage
  private islandsCache: LRUCache<string, IslandMetadata>;
  private initialized = false;

  constructor(config: RouterConfig = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      dev: config.dev ?? true,
      root: config.root ?? process.cwd(),
      buildOptions: {
        minify: config.buildOptions?.minify ?? true,
        sourcemap: config.buildOptions?.sourcemap ?? false,
      },
      document: config.document,
      title: config.title,
      meta: config.meta,
    };

    // Initialize LRU cache with configurable max size
    // Default: 1000 islands (should be enough for most apps)
    const cacheSize = (config as any).islandCacheSize ?? 1000;
    this.islandsCache = new LRUCache<string, IslandMetadata>(cacheSize);
  }

  /**
   * Initialize the router (async because Vite setup is async)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.config.dev) {
      this.builder = await createViteIslandBuilder({
        dev: true,
        root: this.config.root,
      });
    }

    this.initialized = true;
  }

  /**
   * Register a static route
   */
  route(path: string, handler: RouteHandler): this {
    if (path.includes(":")) {
      // Dynamic route
      const pattern = this.pathToRegex(path);
      this.dynamicRoutes.push({ pattern, handler });
    } else {
      // Static route
      this.routeMap.set(path, handler);
    }
    return this;
  }

  /**
   * Register multiple routes at once
   */
  routes(routes: Record<string, RouteHandler>): this {
    for (const [path, handler] of Object.entries(routes)) {
      this.route(path, handler);
    }
    return this;
  }

  /**
   * Get page content for a given path (lazy rendering)
   */
  async get(path: string): Promise<SSRResult> {
    await this.initialize();

    // Parse path and query string
    const [pathname, queryString] = path.split("?");
    const query: Record<string, string> = {};
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      for (const [key, value] of searchParams) {
        query[key] = value;
      }
    }

    // Find matching route
    const match = this.matchRoute(pathname || "/");
    if (!match) {
      throw new Error(`Route not found: ${path}`);
    }

    // Call the route handler to get VNode
    const context: RouteContext = { params: match.params, query };
    const vnode = match.handler(context);

    // Render to HTML with islands
    const result = await renderToString(vnode, {
      // Default transformer generates standard script tags
      transformIslandScript: (island) =>
        `<script type="module" src="${island.basePath}/${island.id}.js" async></script>`,
    });

    // Store islands in LRU cache for later code retrieval
    // Old islands will be automatically evicted when cache is full
    for (const island of result.islands) {
      this.islandsCache.set(island.id, island);
    }

    // If document template is provided, render complete HTML document
    if (this.config.document) {
      const { renderDocument } = await import("./document");

      const documentVNode = this.config.document({
        // Wrap HTML strings in VNodes with dangerouslySetInnerHTML for raw HTML injection
        children: {
          type: "template",
          props: { dangerouslySetInnerHTML: { __html: result.html } },
          children: [],
        },
        scripts: {
          type: "template",
          props: { dangerouslySetInnerHTML: { __html: result.scripts } },
          children: [],
        },
        islands: result.islands,
        css: result.css,
        path,
        title: this.config.title,
        meta: this.config.meta,
      });

      result.document = renderDocument(documentVNode);
    }

    return result;
  }

  /**
   * Get island client code
   * In dev mode, returns the entry point (Vite will transform it)
   * In prod mode, would return pre-built bundle
   */
  async getIslandEntryPoint(islandId: string): Promise<string> {
    await this.initialize();

    const island = this.islandsCache.get(islandId);
    if (!island) {
      throw new Error(`Island not found: ${islandId}`);
    }

    if (!this.builder) {
      throw new Error("Vite builder not initialized");
    }

    return this.builder.getEntryPoint(island);
  }

  /**
   * Handle module transformation request
   * This is called when browser requests /@fs/... or /node_modules/...
   */
  async handleModuleRequest(url: string): Promise<{ code: string } | null> {
    await this.initialize();

    if (!this.builder) {
      throw new Error("Vite builder not initialized");
    }

    return this.builder.transformModule(url);
  }

  /**
   * Get island metadata by ID
   */
  getIsland(islandId: string): IslandMetadata | undefined {
    return this.islandsCache.get(islandId);
  }

  /**
   * Get Vite dev server instance (for middleware integration)
   */
  getViteServer(): ViteDevServer | null {
    return this.builder?.getViteServer() ?? null;
  }

  /**
   * Close the router and cleanup resources
   */
  async close(): Promise<void> {
    if (this.builder) {
      await this.builder.close();
    }
  }

  /**
   * Match a path to a route handler
   */
  private matchRoute(path: string): RouteMatch | null {
    // Try static routes first
    const staticHandler = this.routeMap.get(path);
    if (staticHandler) {
      return { handler: staticHandler, params: {} };
    }

    // Try dynamic routes
    for (const { pattern, handler } of this.dynamicRoutes) {
      const match = path.match(pattern);
      if (match) {
        const params = this.extractParams(pattern, match);
        return { handler, params };
      }
    }

    return null;
  }

  /**
   * Convert path pattern to regex
   * Example: /blog/:id -> /^\/blog\/([^\/]+)$/
   */
  private pathToRegex(path: string): RegExp {
    const pattern = path.replace(/\//g, "\\/").replace(/:([^/]+)/g, "(?<$1>[^\\/]+)");
    return new RegExp(`^${pattern}$`);
  }

  /**
   * Extract params from regex match
   */
  private extractParams(_pattern: RegExp, match: RegExpMatchArray): Record<string, string> {
    return match.groups || {};
  }
}

/**
 * Create a new Vite-powered router
 */
export async function createViteRouter(
  routes?: Record<string, RouteHandler>,
  config?: RouterConfig,
): Promise<ViteRouter> {
  const router = new ViteRouter(config);

  if (routes) {
    router.routes(routes);
  }

  // Initialize immediately
  await router.initialize();

  return router;
}
