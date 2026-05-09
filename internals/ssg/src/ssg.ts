import { mkdir, writeFile, rm } from "fs/promises";
import { join, dirname, resolve } from "path";
import { createApp, renderDocument } from "@semajsx/ssr";
import type { App, RouteContext } from "@semajsx/ssr";
import { DefaultDocument } from "./document";
import type { VNode } from "@semajsx/core";
import {
  RawHTML,
  type SSGConfig,
  type SSGPlugin,
  type SSGInstance,
  type MDXConfig,
  type RouteConfig,
  type DocumentTemplate,
  type Collection,
  type CollectionEntry,
  type BuildOptions,
  type BuildResult,
  type BuildState,
  type WatchOptions,
  type Watcher,
  type DocumentProps,
  type InferCollections,
} from "./types";
import { viteMDXPlugin } from "./mdx";

/**
 * Sort plugins by enforce order: 'pre' → normal → 'post'
 */
function sortPlugins(plugins: SSGPlugin[]): SSGPlugin[] {
  const pre: SSGPlugin[] = [];
  const normal: SSGPlugin[] = [];
  const post: SSGPlugin[] = [];

  for (const plugin of plugins) {
    if (plugin.enforce === "pre") pre.push(plugin);
    else if (plugin.enforce === "post") post.push(plugin);
    else normal.push(plugin);
  }

  return [...pre, ...normal, ...post];
}

/**
 * Merge a partial MDX config into an existing one.
 */
function mergeMdxConfig(base: MDXConfig, partial: Partial<MDXConfig>): MDXConfig {
  return {
    remarkPlugins: [...(base.remarkPlugins ?? []), ...(partial.remarkPlugins ?? [])],
    rehypePlugins: [...(base.rehypePlugins ?? []), ...(partial.rehypePlugins ?? [])],
    components: { ...base.components, ...partial.components },
  };
}

/**
 * Resolved config produced by running all plugin config hooks.
 */
interface ResolvedPluginConfig {
  mdx: MDXConfig;
  document?: DocumentTemplate;
  routes: RouteConfig[];
  collections: Collection[];
}

/**
 * Result of plugin resolution: merged config + flat list of all plugins.
 */
interface PluginResolutionResult {
  config: ResolvedPluginConfig;
  allPlugins: SSGPlugin[];
}

/**
 * Run config hooks on all plugins, then merge with user config.
 *
 * Plugin arrays are flattened Vite-style: plugin factories may return
 * `SSGPlugin | SSGPlugin[]`, and the top-level array is `.flat()`-ed
 * before sorting and processing.
 *
 * Merge strategies:
 * - mdx: merge (concat arrays, merge component objects)
 * - document: override (last writer wins, user config last)
 * - routes: concat (plugin routes first, then user routes)
 * - collections: concat (plugin collections first, then user collections)
 */
function resolvePlugins(
  plugins: (SSGPlugin | SSGPlugin[])[],
  config: SSGConfig,
): PluginResolutionResult {
  // Vite-style: flatten nested arrays from plugin factories
  const flat = plugins.flat();
  const sorted = sortPlugins(flat);

  let mdx: MDXConfig = { remarkPlugins: [], rehypePlugins: [], components: {} };
  let document: DocumentTemplate | undefined;
  const routes: RouteConfig[] = [];
  const collections: Collection[] = [];

  // Call config hooks in order
  for (const plugin of sorted) {
    if (!plugin.config) continue;
    const partial = plugin.config(config);
    if (!partial) continue;

    if (partial.mdx) mdx = mergeMdxConfig(mdx, partial.mdx);
    if (partial.document) document = partial.document;
    if (partial.routes) routes.push(...partial.routes);
    if (partial.collections) collections.push(...partial.collections);
  }

  // User config takes precedence (applied last)
  if (config.mdx) mdx = mergeMdxConfig(mdx, config.mdx);
  if (config.document) document = config.document;
  if (config.routes) routes.push(...config.routes);
  if (config.collections) collections.push(...config.collections);

  return { config: { mdx, document, routes, collections }, allPlugins: sorted };
}

/**
 * SSG (Static Site Generator) core class
 * Built on top of server's createApp
 */
export class SSG<
  TRegistry extends Record<string, unknown> = Record<string, unknown>,
> implements SSGInstance<TRegistry> {
  private config: SSGConfig;
  private plugins: SSGPlugin[];
  private rootDir: string;
  private collections: Map<string, Collection>;
  private entriesCache: Map<string, CollectionEntry[]>;
  private app: App;
  private mdxModules: Map<string, string> = new Map();

  constructor(config: SSGConfig) {
    // Resolve rootDir
    this.rootDir = config.rootDir ?? process.cwd();

    // Run config hooks — merges plugins + user config, collects all plugins (including nested)
    const { config: resolved, allPlugins } = resolvePlugins(config.plugins ?? [], config);

    // Store all plugins (including sub-plugins) for lifecycle hooks
    this.plugins = allPlugins;

    this.config = {
      base: "/",
      ...config,
      mdx: resolved.mdx,
      document: resolved.document,
      routes: resolved.routes,
      collections: resolved.collections,
      outDir: resolve(this.rootDir, config.outDir),
    };

    // Call configResolved on all plugins
    for (const plugin of this.plugins) {
      plugin.configResolved?.(this.config);
    }
    this.collections = new Map();
    this.entriesCache = new Map();

    // Create App with MDX plugins
    this.app = createApp({
      root: this.rootDir,
      vite: {
        plugins: [
          // Virtual MDX content modules
          {
            name: "ssg-virtual-mdx",
            resolveId: (id: string) => {
              if (id.startsWith("virtual:mdx:")) {
                return "\0" + id;
              }
            },
            load: (id: string) => {
              if (id.startsWith("\0virtual:mdx:")) {
                const mdxId = id.replace("\0virtual:mdx:", "");
                return this.mdxModules.get(mdxId);
              }
            },
          },
          // MDX compiler plugin
          viteMDXPlugin(resolved.mdx),
        ],
      },
    });

    // Register collections (from resolved config — plugins + user)
    for (const collection of this.config.collections ?? []) {
      this.collections.set(collection.name, collection);
    }
  }

  getRootDir(): string {
    return this.rootDir;
  }

  async getCollection<K extends keyof TRegistry & string>(
    name: K,
  ): Promise<CollectionEntry<TRegistry[K]>[]> {
    const collection = this.collections.get(name);
    if (!collection) {
      throw new Error(`Collection "${name}" not found`);
    }

    if (this.entriesCache.has(name)) {
      return this.entriesCache.get(name) as CollectionEntry<TRegistry[K]>[];
    }

    const entries = await collection.source.getEntries();

    const validatedEntries = entries.map((entry) => {
      const result = collection.schema.safeParse(entry.data);
      if (!result.success) {
        throw new Error(`Validation error in ${name}/${entry.id}: ${result.error.message}`);
      }

      return {
        ...entry,
        data: result.data,
        render: async () => {
          // Get Vite server from app
          const vite = this.app.getViteServer();
          if (!vite) {
            throw new Error("Vite server not initialized");
          }

          // Store MDX content as virtual module
          const mdxId = `${name}/${entry.id}.mdx`;
          this.mdxModules.set(mdxId, entry.body);

          try {
            // Load module through Vite SSR
            const moduleExports = (await vite.ssrLoadModule(`virtual:mdx:${mdxId}`)) as {
              default: (props: Record<string, unknown>) => unknown;
            };

            const Content = (props: Record<string, unknown> = {}): VNode =>
              moduleExports.default({
                ...props,
                components: this.config.mdx?.components ?? {},
              }) as VNode;

            return {
              Content,
              headings: this.extractHeadings(entry.body),
            };
          } finally {
            this.mdxModules.delete(mdxId);
          }
        },
      };
    });

    this.entriesCache.set(name, validatedEntries);
    return validatedEntries as CollectionEntry<TRegistry[K]>[];
  }

  async getEntry<K extends keyof TRegistry & string>(
    name: K,
    id: string,
  ): Promise<CollectionEntry<TRegistry[K]> | null> {
    const entries = await this.getCollection(name);
    return entries.find((e) => e.id === id || e.slug === id) ?? null;
  }

  async build(options: BuildOptions = {}): Promise<BuildResult> {
    const { incremental = false, state: prevState } = options;
    const outDir = this.config.outDir;

    // Plugin hook: buildStart
    for (const plugin of this.plugins) {
      await plugin.buildStart?.();
    }

    // Initialize App (starts Vite)
    await this.app.prepare();

    try {
      // Register routes with App
      await this.registerRoutes();

      // Build all pages
      const result = await this.buildPages(incremental, prevState, outDir);

      // Build islands for client-side hydration
      // Pass renderHtml so the Vite build uses the SSG's Document template
      // instead of a hardcoded minimal HTML template
      const documentTemplate = this.config.document ?? DefaultDocument;
      await this.app.build({
        outDir,
        mode: "full",
        minify: true,
        renderHtml: ({ html, css, styles, scripts, title, path: routePath }) => {
          const scriptsHtml = scripts
            .map((s) => `<script type="module" src="${s.src}"></script>`)
            .join("\n");
          const documentProps: DocumentProps = {
            children: new RawHTML(html),
            title,
            base: this.config.base ?? "/",
            path: routePath,
            props: {},
            scripts: scriptsHtml ? new RawHTML(scriptsHtml) : undefined,
            css: css ?? [],
            styles: styles ?? [],
          };
          const documentVNode = documentTemplate(documentProps);
          return renderDocument(documentVNode);
        },
        vite: {
          build: {
            rollupOptions: {
              // Don't externalize for SSG - bundle everything
              external: [],
            },
          },
        },
      });

      // Plugin hook: buildEnd
      for (const plugin of this.plugins) {
        await plugin.buildEnd?.(result, this);
      }

      return result;
    } finally {
      await this.app.close();
    }
  }

  private async registerRoutes(): Promise<void> {
    const routes = this.config.routes ?? [];

    for (const route of routes) {
      if (route.getStaticPaths) {
        // Dynamic route - register each path
        const staticPaths = await route.getStaticPaths(this);
        for (const sp of staticPaths) {
          const path = this.applyParams(route.path, sp.params);
          const props: Record<string, unknown> = { ...sp.props, params: sp.params };

          this.app.route(
            path,
            (_context: RouteContext) => {
              return route.component(props);
            },
            { title: props.title as string | undefined },
          );
        }
      } else {
        // Static route
        let props: Record<string, unknown> = {};
        if (typeof route.props === "function") {
          props = await route.props(this);
        } else if (route.props) {
          props = route.props;
        }

        this.app.route(
          route.path,
          (_context: RouteContext) => {
            return route.component(props);
          },
          { title: props.title as string | undefined },
        );
      }
    }
  }

  private async buildPages(
    incremental: boolean,
    prevState: BuildState | undefined,
    outDir: string,
  ): Promise<BuildResult> {
    const state: BuildState = {
      cursors: {},
      pageHashes: {},
      timestamp: Date.now(),
    };

    const stats = { added: 0, updated: 0, deleted: 0, unchanged: 0 };
    const builtPaths: string[] = [];

    if (!incremental) {
      await rm(outDir, { recursive: true, force: true });
    }
    await mkdir(outDir, { recursive: true });

    this.entriesCache.clear();

    // Get all paths to build
    const allPaths = await this.generateAllPaths();
    const currentPaths = new Set(allPaths.map((p) => p.path));

    // Delete removed pages
    if (incremental && prevState) {
      for (const oldPath of Object.keys(prevState.pageHashes)) {
        if (!currentPaths.has(oldPath)) {
          const filePath = this.pathToFilePath(oldPath);
          try {
            await rm(join(outDir, filePath));
            stats.deleted++;
          } catch {
            // ignore
          }
        }
      }
    }

    // Build each page
    for (const { path, props } of allPaths) {
      const html = await this.renderPage(path, props);
      const hash = this.hashContent(html);

      const prevHash = prevState?.pageHashes[path];
      const needsWrite = !incremental || !prevHash || prevHash !== hash;

      if (needsWrite) {
        const filePath = this.pathToFilePath(path);
        const fullPath = join(outDir, filePath);

        await mkdir(dirname(fullPath), { recursive: true });
        await writeFile(fullPath, html);

        builtPaths.push(path);
        if (!prevHash) {
          stats.added++;
        } else {
          stats.updated++;
        }
      } else {
        stats.unchanged++;
      }

      state.pageHashes[path] = hash;
    }

    for (const [name, collection] of this.collections) {
      if (collection.source.getChanges) {
        state.cursors[name] = Date.now().toString();
      }
    }

    return { state, paths: builtPaths, stats };
  }

  private async renderPage(path: string, props: Record<string, unknown>): Promise<string> {
    // Use App to render the page
    const result = await this.app.render(path);

    // Wrap with document template
    const documentProps: DocumentProps = {
      children: new RawHTML(result.html),
      title: props.title as string | undefined,
      base: this.config.base ?? "/",
      path,
      props,
      scripts: result.scripts ? new RawHTML(result.scripts) : undefined,
      css: result.css ?? [],
      styles: result.styles ?? [],
    };

    const template = this.config.document ?? DefaultDocument;
    const documentVNode = template(documentProps);

    return renderDocument(documentVNode);
  }

  private async generateAllPaths(): Promise<
    Array<{ path: string; props: Record<string, unknown> }>
  > {
    const paths: Array<{ path: string; props: Record<string, unknown> }> = [];
    const routes = this.config.routes ?? [];

    for (const route of routes) {
      if (route.getStaticPaths) {
        const staticPaths = await route.getStaticPaths(this);
        for (const sp of staticPaths) {
          const path = this.applyParams(route.path, sp.params);
          paths.push({ path, props: { ...sp.props, params: sp.params } });
        }
      } else {
        let props: Record<string, unknown> = {};
        if (typeof route.props === "function") {
          props = await route.props(this);
        } else if (route.props) {
          props = route.props;
        }
        paths.push({ path: route.path, props });
      }
    }

    return paths;
  }

  watch(options: WatchOptions = {}): Watcher {
    const unsubscribers: (() => void)[] = [];

    for (const [name, collection] of this.collections) {
      if (collection.source.watch) {
        const unsubscribe = collection.source.watch(async () => {
          try {
            this.entriesCache.delete(name);
            const result = await this.build({ incremental: true });
            options.onRebuild?.(result);
          } catch (error) {
            options.onError?.(error as Error);
          }
        });
        unsubscribers.push(unsubscribe);
      }
    }

    return {
      close: () => unsubscribers.forEach((fn) => fn()),
    };
  }

  private pathToFilePath(urlPath: string): string {
    if (urlPath === "/") return "index.html";
    return `${urlPath.slice(1)}/index.html`;
  }

  private applyParams(pattern: string, params: Record<string, string>): string {
    let path = pattern;
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, value);
    }
    return path;
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private extractHeadings(content: string): Array<{ depth: number; text: string; slug: string }> {
    const headings: Array<{ depth: number; text: string; slug: string }> = [];
    const regex = /^(#{1,6})\s+(.+)$/gm;

    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!match[1] || !match[2]) continue;
      const depth = match[1].length;
      const text = match[2].trim();
      const slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ depth, text, slug });
    }

    return headings;
  }
}

export function createSSG<
  const TCollections extends readonly Collection[],
  TRegistry extends Record<string, unknown> = InferCollections<TCollections>,
>(config: SSGConfig<TCollections, TRegistry>): SSGInstance<TRegistry> {
  return new SSG<TRegistry>(config as unknown as SSGConfig);
}
