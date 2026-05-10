import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import remarkGfm from "remark-gfm";
import { Mermaid } from "@semajsx/mermaid";
import { remarkMermaid } from "@semajsx/mermaid/remark";
import { z } from "zod";
import type { SSGPlugin, SSGConfig, Collection, RouteConfig } from "../../types";
import { defineCollection } from "../../index";
import type { DocsThemeOptions } from "./types";
import {
  createComponents,
  ComponentPreview,
  Callout,
  CodeBlock,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Steps,
  Step,
  Button,
  Badge,
  Card,
  Separator,
  Input,
  Avatar,
  Kbd,
  Switch,
  Table,
  Pre,
} from "./components";
import { island } from "@semajsx/ssr/client";
import { lucide as lucidePlugin } from "../lucide/index";
import { llms as llmsPlugin } from "../llms/index";
import type { LlmsSection } from "../llms/types";
import type { Component } from "@semajsx/core";

// Wrap Tabs as an island, pointing to the source module so the client
// entry automatically has TabList/Tab/TabPanel in its component registry.
const TabsIsland = island(Tabs, "@semajsx/ui/components/tabs");

export type {
  DocsThemeOptions,
  LlmsThemeOptions,
  NavLink,
  HeroAction,
  FeatureItem,
  QuickLinkItem,
  DocsConfig,
  GuidesConfig,
  UIConfig,
  HomeOption,
  HomePageProps,
  LayoutComponent,
} from "./types";

export {
  ComponentPreview,
  Callout,
  CodeBlock,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  Steps,
  Step,
  Button,
  Badge,
  Card,
  Separator,
  Input,
  Avatar,
  Kbd,
  Switch,
} from "./components";

export { Mermaid } from "@semajsx/mermaid";
export { remarkMermaid } from "@semajsx/mermaid/remark";

// =============================================================================
// Schemas
// =============================================================================

const docsSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  order: z.number().default(999),
  category: z.string().optional(),
});

const guidesSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  order: z.number().default(999),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
});

const uiSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  order: z.number().default(999),
  category: z.string().optional(),
});

// =============================================================================
// Plugin factory
// =============================================================================

/**
 * Docs theme plugin for SSG.
 *
 * Provides an Apple-inspired documentation site with:
 * - Frosted glass navigation
 * - Home page with hero, features, and quick links
 * - Docs collection with category grouping
 * - Guides collection with difficulty levels
 * - MDX components (Callout, CodeBlock)
 * - Responsive design
 *
 * All text content, navigation links, and site metadata
 * are configured through options — nothing is hardcoded.
 *
 * @example
 * ```tsx
 * import { createSSG } from "@semajsx/ssg";
 * import { docsTheme } from "@semajsx/ssg/plugins/docs-theme";
 * import { fileSource } from "@semajsx/ssg";
 *
 * const ssg = createSSG({
 *   outDir: "./dist",
 *   plugins: [
 *     docsTheme({
 *       title: "My Docs",
 *       nav: {
 *         logo: "MyProject",
 *         links: [
 *           { label: "Docs", href: "/docs" },
 *           { label: "GitHub", href: "https://github.com/...", external: true },
 *         ],
 *       },
 *       hero: {
 *         title: "MyProject",
 *         subtitle: "A great project.",
 *         actions: [{ label: "Get Started", href: "/docs/intro", primary: true }],
 *       },
 *       docs: { source: fileSource({ directory: "content/docs" }, rootDir) },
 *     }),
 *   ],
 * });
 * ```
 */
export function docsTheme(options: DocsThemeOptions): SSGPlugin[] {
  const components = createComponents(options);
  const docsBasePath = options.docs?.basePath ?? "/docs";
  const guidesBasePath = options.guides?.basePath ?? "/guides";
  const uiBasePath = options.ui?.basePath ?? "/ui";

  let outDir = "";

  const mainPlugin: SSGPlugin = {
    name: "docs-theme",

    configResolved(config: SSGConfig) {
      outDir = config.outDir ?? "./dist";
    },

    async buildEnd() {
      // Copy bundled font to output directory
      const thisDir = dirname(fileURLToPath(import.meta.url));
      const fontSrc = join(thisDir, "fonts", "MapleMono-NF-CN-Regular.woff2");
      const fontDest = join(outDir, "fonts", "MapleMono-NF-CN-Regular.woff2");
      await mkdir(dirname(fontDest), { recursive: true });
      await copyFile(fontSrc, fontDest);
    },

    config() {
      const collections: Collection[] = [];
      const routes: RouteConfig[] = [];

      // --- Collections ---

      if (options.docs) {
        collections.push(
          defineCollection({
            name: "docs",
            source: options.docs.source,
            schema: docsSchema,
          }),
        );
      }

      if (options.guides) {
        collections.push(
          defineCollection({
            name: "guides",
            source: options.guides.source,
            schema: guidesSchema,
          }),
        );
      }

      if (options.ui) {
        collections.push(
          defineCollection({
            name: "ui",
            source: options.ui.source,
            schema: uiSchema,
          }),
        );
      }

      // --- Routes ---

      // Home page
      if (options.home !== false) {
        if (options.home === "docs-index") {
          // Minimal document index preset
          routes.push({
            path: "/",
            component: components.DocsIndexHome,
            props: async (ssg) => ({
              title: options.title,
              docs: options.docs ? await ssg.getCollection("docs") : [],
              guides: options.guides ? await ssg.getCollection("guides") : [],
            }),
          });
        } else if (typeof options.home === "function") {
          // Custom component — pass Layout and collection data
          const CustomHome = options.home;
          routes.push({
            path: "/",
            component: (props: Record<string, unknown>) => CustomHome(props as never),
            props: async (ssg) => ({
              title: options.title,
              Layout: components.Layout,
              docs: options.docs ? await ssg.getCollection("docs") : [],
              guides: options.guides ? await ssg.getCollection("guides") : [],
            }),
          });
        } else {
          // Default marketing homepage
          routes.push({
            path: "/",
            component: components.HomePage,
            props: { title: options.title },
          });
        }
      }

      // Docs routes
      if (options.docs) {
        routes.push({
          path: docsBasePath,
          component: components.DocsIndex,
          props: async (ssg) => ({
            title: options.docs?.heading ?? "Documentation",
            docs: await ssg.getCollection("docs"),
          }),
        });

        routes.push({
          path: `${docsBasePath}/:slug`,
          component: components.DocPage,
          getStaticPaths: async (ssg) => {
            const allDocs = await ssg.getCollection("docs");
            return Promise.all(
              allDocs.map(async (doc) => {
                const { Content } = await doc.render();
                return {
                  params: { slug: doc.slug },
                  props: {
                    doc,
                    content: Content(),
                    title: `${(doc.data as { title: string }).title} | ${options.title}`,
                  },
                };
              }),
            );
          },
        });
      }

      // Guides routes
      if (options.guides) {
        routes.push({
          path: guidesBasePath,
          component: components.GuidesIndex,
          props: async (ssg) => ({
            title: options.guides?.heading ?? "Guides",
            guides: await ssg.getCollection("guides"),
          }),
        });

        routes.push({
          path: `${guidesBasePath}/:slug`,
          component: components.GuidePage,
          getStaticPaths: async (ssg) => {
            const allGuides = await ssg.getCollection("guides");
            return Promise.all(
              allGuides.map(async (guide) => {
                const { Content } = await guide.render();
                return {
                  params: { slug: guide.slug },
                  props: {
                    guide,
                    content: Content(),
                    title: `${(guide.data as { title: string }).title} | ${options.title}`,
                  },
                };
              }),
            );
          },
        });
      }

      // UI routes
      if (options.ui) {
        routes.push({
          path: uiBasePath,
          component: components.UIIndex,
          props: async (ssg) => ({
            title: options.ui?.heading ?? "Components",
            components: await ssg.getCollection("ui"),
          }),
        });

        routes.push({
          path: `${uiBasePath}/:slug`,
          component: components.UIPage,
          getStaticPaths: async (ssg) => {
            const allComponents = await ssg.getCollection("ui");
            return Promise.all(
              allComponents.map(async (comp) => {
                const { Content } = await comp.render();
                return {
                  params: { slug: comp.slug },
                  props: {
                    component: comp,
                    content: Content(),
                    title: `${(comp.data as { title: string }).title} | ${options.title}`,
                  },
                };
              }),
            );
          },
        });
      }

      // 404 page
      routes.push({
        path: "/404",
        component: components.NotFound,
        props: { title: `404 - Page Not Found | ${options.title}` },
      });

      // --- MDX ---

      const mdxComponents: Record<string, Component> = {
        table: Table,
        pre: Pre,
        ComponentPreview,
        Callout,
        CodeBlock,
        Tabs: TabsIsland,
        TabList,
        Tab,
        TabPanel,
        Steps,
        Step,
        Button,
        Badge,
        Card,
        Separator,
        Input,
        Avatar,
        Kbd,
        Switch,
        Mermaid,
        ...options.mdx?.components,
      };

      return {
        document: components.Document,
        collections,
        routes,
        mdx: {
          remarkPlugins: [remarkGfm, remarkMermaid, ...(options.mdx?.remarkPlugins ?? [])],
          rehypePlugins: options.mdx?.rehypePlugins,
          components: mdxComponents,
        },
      };
    },
  };

  // Compose sub-plugins Vite-style: return flat array
  const plugins: SSGPlugin[] = [mainPlugin];

  if (options.lucide !== false) {
    const lucideOpts = typeof options.lucide === "object" ? options.lucide : {};
    plugins.push(lucidePlugin(lucideOpts));
  }

  // LLMs (llms.txt) — enabled by default when docs, guides, or ui exist
  const hasContent = options.docs || options.guides || options.ui;
  if (options.llms !== false && hasContent) {
    const llmsOpts = typeof options.llms === "object" ? options.llms : {};

    // Auto-derive sections from configured collections
    const sections: LlmsSection[] = [];
    if (options.docs) {
      sections.push({
        title: options.docs.heading ?? "Documentation",
        collection: "docs",
        basePath: docsBasePath,
      });
    }
    if (options.guides) {
      sections.push({
        title: options.guides.heading ?? "Guides",
        collection: "guides",
        basePath: guidesBasePath,
      });
    }
    if (options.ui) {
      sections.push({
        title: options.ui.heading ?? "Components",
        collection: "ui",
        basePath: uiBasePath,
      });
    }

    plugins.push(
      llmsPlugin({
        title: options.title,
        description: options.description,
        url: llmsOpts.url,
        sections,
        links: llmsOpts.links,
        llmsTxt: llmsOpts.llmsTxt,
        llmsFullTxt: llmsOpts.llmsFullTxt,
        markdownPages: llmsOpts.markdownPages,
      }),
    );
  }

  return plugins;
}
