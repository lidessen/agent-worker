import rehypeShiki from "@shikijs/rehype";
import type { ShikiTransformer } from "@shikijs/types";
import { createSSG, fileSource } from "semajsx/ssg";
import { docsTheme } from "semajsx/ssg/plugins/docs-theme";

const rootDir = import.meta.dir;

const ssg = createSSG({
  rootDir,
  outDir: "./dist",
  plugins: [
    docsTheme({
      title: "SemaJSX Documentation",
      description:
        "A lightweight, signal-based reactive JSX runtime for building modern web applications.",
      nav: {
        logo: "SemaJSX",
        links: [
          { label: "Reference", href: "/reference" },
          { label: "Guides", href: "/guides" },
          { label: "Components", href: "/ui" },
          { label: "GitHub", href: "https://github.com/semajsx/semajsx", external: true },
        ],
      },
      hero: {
        title: "SemaJSX",
        subtitle:
          "A lightweight, signal-based reactive JSX runtime. Fine-grained updates. No virtual DOM.",
        actions: [
          { label: "Get Started", href: "/reference/getting-started", primary: true },
          { label: "View Guides", href: "/guides" },
        ],
      },
      features: {
        title: "Why SemaJSX?",
        subtitle: "Simple primitives. Powerful results.",
        items: [
          {
            icon: "zap",
            title: "Fine-Grained Reactivity",
            description:
              "Signals automatically track dependencies and update only what changed. No virtual DOM diffing overhead.",
          },
          {
            icon: "package",
            title: "Modular Architecture",
            description:
              "Choose what you need: DOM rendering, Terminal UI, SSR, or SSG. All sharing the same reactive core.",
          },
          {
            icon: "shield-check",
            title: "Type-Safe",
            description:
              "Full TypeScript support with comprehensive type inference and IDE autocompletion out of the box.",
          },
          {
            icon: "palette",
            title: "Flexible Styling",
            description:
              "Modular CSS with @semajsx/style, tree-shakeable Tailwind utilities, and signal-reactive themes.",
          },
          {
            icon: "monitor",
            title: "Multi-Target",
            description:
              "Render to the browser DOM or the terminal. Same JSX, same signals, different targets.",
          },
          {
            icon: "globe",
            title: "SSR & SSG",
            description:
              "Island architecture for SSR. Static site generation with MDX, collections, and incremental builds.",
          },
        ],
      },
      quickLinks: {
        title: "Get started in seconds.",
        subtitle: "Everything you need to build reactive applications.",
        items: [
          {
            title: "Reference",
            description: "API reference and core concepts.",
            href: "/reference",
          },
          {
            title: "Guides",
            description: "Step-by-step tutorials and examples.",
            href: "/guides",
          },
          {
            title: "Components",
            description: "Browse the UI component library.",
            href: "/ui",
          },
        ],
      },
      footer: {
        links: [
          { label: "Reference", href: "/reference" },
          { label: "Guides", href: "/guides" },
          { label: "Components", href: "/ui" },
          { label: "GitHub", href: "https://github.com/semajsx/semajsx" },
        ],
        copyright: "SemaJSX",
      },
      docs: {
        source: fileSource({ directory: "content/reference" }, rootDir),
        basePath: "/reference",
        heading: "Reference",
        description: "Learn the fundamentals and explore the API.",
      },
      guides: {
        source: fileSource({ directory: "content/guides" }, rootDir),
        heading: "Guides",
        description: "Practical tutorials to help you build with SemaJSX.",
      },
      ui: {
        source: fileSource({ directory: "content/ui" }, rootDir),
        basePath: "/ui",
        heading: "Components",
        description: "Browse, preview, and learn how to use each UI component.",
      },
      mdx: {
        rehypePlugins: [
          [
            rehypeShiki,
            {
              theme: "github-dark-dimmed",
              transformers: [
                {
                  name: "add-language-data",
                  pre(node) {
                    node.properties["data-language"] = this.options.lang;
                  },
                } satisfies ShikiTransformer,
              ],
            },
          ],
        ],
      },
    }),
  ],
});

async function main() {
  console.log("Building SemaJSX documentation site...");
  const result = await ssg.build();
  console.log(`Built ${result.paths.length} pages`);
  console.log("Stats:", result.stats);
}

main().catch(console.error);
