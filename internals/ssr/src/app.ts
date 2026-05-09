/**
 * App - Main entry point for SemaJSX server applications
 *
 * Provides a unified API for:
 * - Route management
 * - SSR rendering with islands
 * - Development server with Vite
 * - Production builds
 */

import { createServer, build as viteBuild, mergeConfig } from "vite";
import type { ViteDevServer, UserConfig as ViteUserConfig } from "vite";
import { resolve } from "path";
import { renderToString } from "./render";
import { renderDocument } from "./document";
import { LRUCache } from "./lru-cache";
import { createLogger } from "@semajsx/logger";
import { virtualModules } from "./virtual-modules";
import type {
  App,
  AppConfig,
  BuildOptions,
  BuildResult,
  BuildScriptEntry,
  DevOptions,
  IslandMetadata,
  RenderResult,
  RouteContext,
  RouteHandler,
  RouteMeta,
} from "./shared/types";

const logger = createLogger({ prefix: "App" });

/**
 * Internal App implementation
 */
class AppImpl implements App {
  readonly config: AppConfig;

  private _routes: Map<string, RouteHandler> = new Map();
  private _routeMeta: Map<string, RouteMeta> = new Map();
  private _viteServer: ViteDevServer | null = null;
  private _islandCache: LRUCache<string, IslandMetadata>;
  private _initialized = false;

  constructor(config: AppConfig = {}) {
    this.config = {
      root: process.cwd(),
      ...config,
      islands: {
        cache: true,
        cacheSize: 1000,
        ...config.islands,
      },
    };

    this._islandCache = new LRUCache(this.config.islands?.cacheSize ?? 1000);

    // Register initial routes
    if (config.routes) {
      this.routes(config.routes);
    }
  }

  route(path: string, handler: RouteHandler, meta?: RouteMeta): this {
    this._routes.set(path, handler);
    if (meta) {
      this._routeMeta.set(path, meta);
    }
    return this;
  }

  routes(routes: Record<string, RouteHandler>): this {
    for (const [path, handler] of Object.entries(routes)) {
      this._routes.set(path, handler);
    }
    return this;
  }

  async prepare(): Promise<void> {
    if (this._initialized) return;

    logger.info("Initializing app with Vite dev server...");

    const baseViteConfig: ViteUserConfig = {
      root: this.config.root,
      server: {
        middlewareMode: true,
      },
      appType: "custom",
      optimizeDeps: {
        // Disable optimization for semajsx to use source directly in development
        exclude: [
          "semajsx",
          "@semajsx/core",
          "@semajsx/dom",
          "@semajsx/signal",
          "@semajsx/ssr",
          "@semajsx/style",
          "@semajsx/ui",
        ],
      },
      resolve: {
        // Ensure Vite respects package.json "exports" field with conditions
        conditions: ["browser", "development", "module", "import", "default"],
        // Add @ alias for project root
        alias: {
          "@": this.config.root || process.cwd(),
        },
      },
      plugins: [this._createVirtualIslandsPlugin()],
      // Exclude problematic native modules from SSR bundling
      ssr: {
        noExternal: [
          "@semajsx/core",
          "@semajsx/dom",
          "@semajsx/signal",
          "@semajsx/style",
          "@semajsx/ui",
        ],
        external: ["lightningcss", "fsevents"],
      },
    };

    // Merge user Vite config
    const finalConfig = this.config.vite
      ? mergeConfig(baseViteConfig, this.config.vite)
      : baseViteConfig;

    this._viteServer = await createServer(finalConfig);
    this._initialized = true;

    logger.info("App initialized successfully");
  }

  async close(): Promise<void> {
    if (this._viteServer) {
      await this._viteServer.close();
      this._viteServer = null;
    }
    this._initialized = false;
    logger.info("App closed");
  }

  async render(path: string): Promise<RenderResult> {
    // Parse path and query string
    const [pathname, queryString] = path.split("?");
    const query: Record<string, string> = {};
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      for (const [key, value] of searchParams) {
        query[key] = value;
      }
    }

    // Match route
    const { handler, params } = this._matchRoute(pathname || "/");
    if (!handler) {
      throw new Error(`No route found for path: ${path}`);
    }

    // Execute handler to get VNode
    const context: RouteContext = { params, query };
    const vnode = handler(context);

    // Render to string with island detection
    const result = await renderToString(vnode, {
      // Default transformer generates standard script tags
      transformIslandScript: (island) =>
        `<script type="module" src="${island.basePath}/${island.id}.js" async></script>`,
      rootDir: this.config.root,
    });

    // Cache islands
    if (this.config.islands?.cache) {
      for (const island of result.islands) {
        this._islandCache.set(island.id, island);
      }
    }

    // Render with document template if provided
    if (this.config.document) {
      const documentVNode = this.config.document({
        children: result.html,
        scripts: result.scripts,
        islands: result.islands,
        css: result.css,
        path,
        title: this.config.title,
        meta: this.config.meta,
      });

      return {
        ...result,
        document: renderDocument(documentVNode),
      };
    }

    return result;
  }

  async dev(options: DevOptions = {}): Promise<{ port: number; close: () => Promise<void> }> {
    const { port = 3000, host = "localhost", open = false } = options;

    await this.prepare();

    // Create HTTP server
    const server = Bun.serve({
      port,
      hostname: host,
      fetch: async (req) => this.handleRequest(req),
    });

    logger.info(`Development server running at http://${host}:${port}`);

    if (open) {
      // Open browser (platform-specific)
      const openCmd =
        process.platform === "darwin"
          ? "open"
          : process.platform === "win32"
            ? "start"
            : "xdg-open";
      Bun.spawn([openCmd, `http://${host}:${port}`]);
    }

    return {
      port,
      close: async () => {
        server.stop();
        await this.close();
      },
    };
  }

  async build(options: BuildOptions = {}): Promise<BuildResult> {
    const {
      outDir = "dist",
      mode = "full",
      minify = true,
      sourcemap = false,
      onIslandBuilt,
      renderHtml: customRenderHtml,
    } = options;

    logger.info(`Building for production (mode: ${mode})...`);

    const { mkdir } = await import("fs/promises");
    // Ensure rootDir is always absolute
    const rootDir = this.config.root ? resolve(this.config.root) : process.cwd();

    // Ensure output directory exists
    await mkdir(outDir, { recursive: true });

    const builtIslands: BuildResult["islands"] = [];
    const routes = Array.from(this._routes.keys());

    if (mode === "full") {
      // Phase 1: Pre-render all routes and collect resources
      const allIslands = new Map<string, IslandMetadata>();

      // Virtual modules (use simple file names as keys)
      const modules: Record<string, string> = {};
      const htmlInputs: Record<string, string> = {};

      // Render all routes
      for (const [path] of this._routes) {
        try {
          const result = await this.render(path);

          // Collect islands by component path (not by instance id)
          for (const island of result.islands) {
            const componentKey = this._getComponentKey(island.path, rootDir);
            if (!allIslands.has(componentKey)) {
              allIslands.set(componentKey, island);
            }
          }

          // Generate HTML with resource references
          const htmlFileName = path === "/" ? "index.html" : `${path.replace(/^\//, "")}.html`;

          // CSS paths - use absolute paths that Vite can resolve
          const cssRefs = result.css;

          // Island script references - deduplicate by component path
          const seenComponents = new Set<string>();
          const islandScriptEntries: BuildScriptEntry[] = [];
          for (const island of result.islands) {
            const componentKey = this._getComponentKey(island.path, rootDir);
            if (!seenComponents.has(componentKey)) {
              seenComponents.add(componentKey);
              islandScriptEntries.push({ src: `/_semajsx/islands/${componentKey}.ts` });
            }
          }

          // Generate HTML
          const routeMeta = this._routeMeta.get(path);
          const pageTitle = routeMeta?.title ?? this.config.title ?? "Page";

          const html = customRenderHtml
            ? customRenderHtml({
                html: result.html,
                css: cssRefs,
                styles: result.styles,
                scripts: islandScriptEntries,
                title: pageTitle,
                path,
              })
            : `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  ${cssRefs.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n  ")}
  ${result.styles.length > 0 ? `<style>${result.styles.join("\n")}</style>` : ""}
</head>
<body>
  ${result.html}
  ${islandScriptEntries.map((s) => `<script type="module" src="${s.src}"></script>`).join("\n  ")}
</body>
</html>`;

          // Store virtual HTML with simple file name as key
          modules[htmlFileName] = html;
          htmlInputs[htmlFileName.replace(".html", "")] = htmlFileName;

          logger.debug(`Rendered ${path} -> ${htmlFileName} (virtual)`);
        } catch (error) {
          logger.warn(`Failed to pre-render route ${path}: ${String(error)}`);
        }
      }

      // Generate virtual island entry modules (one per component)
      for (const [componentKey, island] of allIslands) {
        let componentPath = island.path;
        if (componentPath.startsWith("file://")) {
          componentPath = new URL(componentPath).pathname;
        }
        const componentName = island.componentName;

        const entryCode = `
import { hydrateAllIslands } from 'semajsx/ssr/client';
import * as ComponentModule from '${componentPath}';

const Component = ${componentName ? `ComponentModule['${componentName}'] || ComponentModule.${componentName}` : "ComponentModule.default"} ||
                  Object.values(ComponentModule).find(exp => typeof exp === 'function');

if (Component) {
  hydrateAllIslands('${componentKey}', Component, ComponentModule);
}
`;

        // Store virtual island entry with component key
        modules[`_semajsx/islands/${componentKey}.ts`] = entryCode;
      }

      logger.info(
        `Phase 1 complete: ${Object.keys(htmlInputs).length} pages, ${allIslands.size} islands`,
      );

      // Phase 2: Vite build with virtual modules
      const userViteConfig = this.config.vite || {};
      const viteConfig: ViteUserConfig = {
        ...userViteConfig,
        root: rootDir,
        base: "/",
        // Merge plugins - our virtual modules plugin must be included
        plugins: [virtualModules(modules), ...(userViteConfig.plugins || [])],
        build: {
          ...userViteConfig.build,
          outDir: resolve(outDir),
          emptyOutDir: true,
          minify,
          sourcemap,
          rollupOptions: {
            ...userViteConfig.build?.rollupOptions,
            input: htmlInputs,
          },
        },
      };

      // Apply options.vite if provided
      const finalConfig = options.vite ? mergeConfig(viteConfig, options.vite) : viteConfig;

      await viteBuild(finalConfig);

      logger.info("Phase 2 complete: Vite build finished");

      // Record built islands
      for (const [componentKey, island] of allIslands) {
        const webPath = `/_semajsx/islands/${componentKey}.js`;

        builtIslands.push({
          id: componentKey,
          path: island.path,
          outputPath: webPath,
        });

        if (onIslandBuilt) {
          onIslandBuilt(island);
        }
      }
    }

    logger.info(`Build complete. Output: ${outDir}`);

    return {
      outDir,
      islands: builtIslands,
      routes,
    };
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Handle Vite module requests (/@fs/, /@vite/, /node_modules/, etc.)
    // This includes CSS files which Vite will process
    if (
      pathname.startsWith("/@") ||
      pathname.startsWith("/node_modules/") ||
      pathname.includes("@vite") ||
      pathname.endsWith(".css")
    ) {
      const result = await this._handleModuleRequest(pathname);
      if (result) {
        const contentType = pathname.endsWith(".css") ? "text/css" : "application/javascript";
        return new Response(result.code, {
          headers: { "Content-Type": contentType },
        });
      }
    }

    // Handle island entry points (must be before source file handler)
    if (pathname.startsWith("/_semajsx/islands/")) {
      const match = pathname.match(/\/_semajsx\/islands\/(.+)\.js/);
      if (match && match[1]) {
        const islandId = match[1];
        try {
          const code = await this.getIslandEntryPoint(islandId);
          return new Response(code, {
            headers: { "Content-Type": "application/javascript" },
          });
        } catch {
          return new Response("Island not found", { status: 404 });
        }
      }
    }

    // Handle source file requests (.ts, .tsx, .js, .jsx)
    if (/\.(tsx?|jsx?)$/.test(pathname)) {
      const result = await this._handleModuleRequest(pathname);
      if (result) {
        return new Response(result.code, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
      return new Response("Not Found", { status: 404 });
    }

    // Handle page requests
    try {
      const result = await this.render(pathname);
      return new Response(result.document || result.html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("No route found")) {
        return new Response("Not Found", { status: 404 });
      }
      logger.error(`Request error: ${String(error)}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  getViteServer(): ViteDevServer | null {
    return this._viteServer;
  }

  async getIslandEntryPoint(islandId: string): Promise<string> {
    const island = this._islandCache.get(islandId);
    if (!island) {
      throw new Error(`Island not found: ${islandId}`);
    }

    // Normalize the component path for Vite
    const componentPath = this._normalizeModulePath(island.path);

    // Get component name for import
    const componentName = island.componentName;

    // Generate entry point code
    const entryCode = `
import { hydrateIsland } from 'semajsx/ssr/client';
import { markIslandHydrated } from 'semajsx/ssr/client';
import * as ComponentModule from '${componentPath}';

// Get the component (try named export first, then default, then first function)
const Component = ${componentName ? `ComponentModule['${componentName}'] || ComponentModule.${componentName} || ` : ""}ComponentModule.default ||
                  Object.values(ComponentModule).find(exp => typeof exp === 'function');

if (Component) {
  hydrateIsland('${islandId}', Component, markIslandHydrated);
}
`;

    // Transform through Vite if available
    if (this._viteServer) {
      const result = await this._viteServer.transformRequest(`virtual:island-entry:${islandId}`);
      if (result) {
        return result.code;
      }
    }

    return entryCode;
  }

  getIsland(islandId: string): IslandMetadata | undefined {
    return this._islandCache.get(islandId);
  }

  // Private methods

  private _matchRoute(path: string): {
    handler: RouteHandler | undefined;
    params: Record<string, string>;
  } {
    // Exact match first
    const exactHandler = this._routes.get(path);
    if (exactHandler) {
      return { handler: exactHandler, params: {} };
    }

    // Dynamic route matching
    for (const [pattern, handler] of this._routes) {
      const params = this._matchDynamicRoute(pattern, path);
      if (params) {
        return { handler, params };
      }
    }

    return { handler: undefined, params: {} };
  }

  private _matchDynamicRoute(pattern: string, path: string): Record<string, string> | null {
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = path.split("/").filter(Boolean);

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]!;
      const pathPart = pathParts[i]!;

      if (patternPart.startsWith(":")) {
        params[patternPart.slice(1)] = pathPart;
      } else if (patternPart !== pathPart) {
        return null;
      }
    }

    return params;
  }

  /**
   * Normalize module path (convert file:// URLs to paths Vite can resolve)
   */
  private _normalizeModulePath(path: string): string {
    if (path.startsWith("file://")) {
      // Convert file:// URL to filesystem path
      const fsPath = new URL(path).pathname;

      // Make path relative to app root
      const root = this.config.root || process.cwd();
      if (root && fsPath.startsWith(root)) {
        // Path is within root, make it relative
        const relativePath = fsPath.slice(root.length);
        // Ensure it starts with / for Vite to resolve from root
        return relativePath.startsWith("/") ? relativePath : `/${relativePath}`;
      }

      // Path is outside root, use @fs protocol
      return `/@fs${fsPath}`;
    }
    return path;
  }

  private async _handleModuleRequest(url: string): Promise<{ code: string } | null> {
    if (!this._viteServer) return null;

    try {
      const result = await this._viteServer.transformRequest(url);
      if (result) {
        return { code: result.code };
      }
    } catch (error) {
      logger.error(`Failed to transform module ${url}: ${String(error)}`);
    }

    return null;
  }

  /**
   * Generate a component key from path for use as file name
   * Example: "/home/user/project/src/components/Counter.tsx" -> "components/Counter"
   */
  private _getComponentKey(componentPath: string, rootDir: string): string {
    // Convert file:// URL to path
    let path = componentPath;
    if (path.startsWith("file://")) {
      path = new URL(path).pathname;
    }

    // Make relative to root and remove src/ prefix
    if (path.startsWith(rootDir)) {
      path = path.slice(rootDir.length);
    }
    path = path.replace(/^\/?(src\/)?/, "");

    // Remove extension
    path = path.replace(/\.\w+$/, "");

    // Sanitize for use as file name (replace problematic chars)
    path = path.replace(/[^a-zA-Z0-9/_-]/g, "_");

    return path;
  }

  private _createVirtualIslandsPlugin() {
    const islandCache = this._islandCache;
    const normalizeModulePath = this._normalizeModulePath.bind(this);

    return {
      name: "semajsx-virtual-islands",
      resolveId(id: string) {
        if (id.startsWith("virtual:island-entry:")) {
          return id;
        }
        return null;
      },
      load(id: string) {
        if (id.startsWith("virtual:island-entry:")) {
          const islandId = id.replace("virtual:island-entry:", "");
          const island = islandCache.get(islandId);

          if (!island) {
            return null;
          }

          const componentPath = normalizeModulePath(island.path);
          const componentName = island.componentName;

          return `
import { hydrateIsland } from 'semajsx/ssr/client';
import { markIslandHydrated } from 'semajsx/ssr/client';
import * as ComponentModule from '${componentPath}';

// Get the component (try named export first, then default, then first function)
const Component = ${componentName ? `ComponentModule['${componentName}'] || ComponentModule.${componentName}` : "ComponentModule.default"} ||
                  Object.values(ComponentModule).find(exp => typeof exp === 'function');

if (Component) {
  hydrateIsland('${islandId}', Component, markIslandHydrated);
}
`;
        }
        return null;
      },
    };
  }
}

/**
 * Create a new SemaJSX app
 */
export function createApp(config?: AppConfig): App {
  return new AppImpl(config);
}
