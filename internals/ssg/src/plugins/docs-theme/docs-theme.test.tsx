/** @jsxImportSource @semajsx/dom */

import { describe, it, expect, vi } from "vitest";
import type { VNode } from "@semajsx/core";
import { docsTheme, Callout, CodeBlock } from "./index";
import type { DocsThemeOptions } from "./types";
import type { SSGPlugin, CollectionSource, CollectionEntry } from "../../types";
import { createSSG, defineCollection, z } from "../../index";

// Minimal valid options for most tests
function createMinimalOptions(overrides: Partial<DocsThemeOptions> = {}): DocsThemeOptions {
  return {
    title: "Test Docs",
    nav: {
      logo: "TestLogo",
      links: [
        { label: "Docs", href: "/docs" },
        { label: "GitHub", href: "https://github.com/test", external: true },
      ],
    },
    ...overrides,
  };
}

// Mock source for collection tests
function createMockSource<T>(entries: CollectionEntry<T>[]): CollectionSource<T> {
  return {
    id: "mock",
    getEntries: vi.fn().mockResolvedValue(entries),
    getEntry: vi.fn().mockImplementation(async (id) => entries.find((e) => e.id === id) ?? null),
  };
}

// =============================================================================
// Plugin identity
// =============================================================================

describe("docsTheme plugin", () => {
  it("should return an array of plugins (Vite-style)", () => {
    const plugins = docsTheme(createMinimalOptions());
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThanOrEqual(1);
  });

  it("should have docs-theme as the first plugin", () => {
    const [main] = docsTheme(createMinimalOptions());
    expect(main.name).toBe("docs-theme");
  });

  it("should include lucide plugin by default", () => {
    const plugins = docsTheme(createMinimalOptions());
    expect(plugins.find((p) => p.name === "lucide")).toBeDefined();
  });

  it("should exclude lucide plugin when lucide: false", () => {
    const plugins = docsTheme(createMinimalOptions({ lucide: false }));
    expect(plugins.find((p) => p.name === "lucide")).toBeUndefined();
    expect(plugins).toHaveLength(1);
  });

  it("should have config() hook on main plugin", () => {
    const [main] = docsTheme(createMinimalOptions());
    expect(typeof main.config).toBe("function");
  });
});

// =============================================================================
// config() — Document
// =============================================================================

describe("docsTheme config() — document", () => {
  it("should provide a document template", () => {
    const [main] = docsTheme(createMinimalOptions());
    const result = main.config!({} as never);
    expect(result).toBeDefined();
    expect(result!.document).toBeDefined();
    expect(typeof result!.document).toBe("function");
  });
});

// =============================================================================
// config() — Routes
// =============================================================================

describe("docsTheme config() — routes", () => {
  it("should always include home and 404 routes", () => {
    const [main] = docsTheme(createMinimalOptions());
    const result = main.config!({} as never);
    const routes = result!.routes!;

    const paths = routes.map((r) => r.path);
    expect(paths).toContain("/");
    expect(paths).toContain("/404");
  });

  it("should include docs routes when docs config is provided", () => {
    const [main] = docsTheme(
      createMinimalOptions({
        docs: {
          source: createMockSource([]),
        },
      }),
    );
    const result = main.config!({} as never);
    const paths = result!.routes!.map((r) => r.path);

    expect(paths).toContain("/docs");
    expect(paths).toContain("/docs/:slug");
  });

  it("should include guides routes when guides config is provided", () => {
    const [main] = docsTheme(
      createMinimalOptions({
        guides: {
          source: createMockSource([]),
        },
      }),
    );
    const result = main.config!({} as never);
    const paths = result!.routes!.map((r) => r.path);

    expect(paths).toContain("/guides");
    expect(paths).toContain("/guides/:slug");
  });

  it("should not include docs/guides routes when not configured", () => {
    const [main] = docsTheme(createMinimalOptions());
    const result = main.config!({} as never);
    const paths = result!.routes!.map((r) => r.path);

    expect(paths).not.toContain("/docs");
    expect(paths).not.toContain("/docs/:slug");
    expect(paths).not.toContain("/guides");
    expect(paths).not.toContain("/guides/:slug");
  });

  it("should use custom base paths", () => {
    const [main] = docsTheme(
      createMinimalOptions({
        docs: {
          source: createMockSource([]),
          basePath: "/reference",
        },
        guides: {
          source: createMockSource([]),
          basePath: "/tutorials",
        },
      }),
    );
    const result = main.config!({} as never);
    const paths = result!.routes!.map((r) => r.path);

    expect(paths).toContain("/reference");
    expect(paths).toContain("/reference/:slug");
    expect(paths).toContain("/tutorials");
    expect(paths).toContain("/tutorials/:slug");
    expect(paths).not.toContain("/docs");
    expect(paths).not.toContain("/guides");
  });
});

// =============================================================================
// config() — Collections
// =============================================================================

describe("docsTheme config() — collections", () => {
  it("should register docs collection when configured", () => {
    const source = createMockSource([]);
    const [main] = docsTheme(createMinimalOptions({ docs: { source } }));
    const result = main.config!({} as never);

    expect(result!.collections).toHaveLength(1);
    expect(result!.collections![0].name).toBe("docs");
  });

  it("should register guides collection when configured", () => {
    const source = createMockSource([]);
    const [main] = docsTheme(createMinimalOptions({ guides: { source } }));
    const result = main.config!({} as never);

    expect(result!.collections).toHaveLength(1);
    expect(result!.collections![0].name).toBe("guides");
  });

  it("should register both collections when both configured", () => {
    const [main] = docsTheme(
      createMinimalOptions({
        docs: { source: createMockSource([]) },
        guides: { source: createMockSource([]) },
      }),
    );
    const result = main.config!({} as never);
    const names = result!.collections!.map((c) => c.name);

    expect(names).toEqual(["docs", "guides"]);
  });

  it("should register no collections when neither configured", () => {
    const [main] = docsTheme(createMinimalOptions());
    const result = main.config!({} as never);

    expect(result!.collections).toHaveLength(0);
  });
});

// =============================================================================
// config() — MDX
// =============================================================================

describe("docsTheme config() — mdx", () => {
  it("should include Callout and CodeBlock as default components", () => {
    const [main] = docsTheme(createMinimalOptions());
    const result = main.config!({} as never);
    const components = result!.mdx!.components as Record<string, unknown>;

    expect(components.Callout).toBe(Callout);
    expect(components.CodeBlock).toBe(CodeBlock);
  });

  it("should merge user MDX components", () => {
    const Custom = () => <div>custom</div>;
    const [main] = docsTheme(
      createMinimalOptions({
        mdx: { components: { Custom } },
      }),
    );
    const result = main.config!({} as never);
    const components = result!.mdx!.components as Record<string, unknown>;

    expect(components.Callout).toBe(Callout);
    expect(components.CodeBlock).toBe(CodeBlock);
    expect(components.Custom).toBe(Custom);
  });

  it("should pass through remark/rehype plugins", () => {
    const remarkPlugin = () => {};
    const rehypePlugin = () => {};
    const [main] = docsTheme(
      createMinimalOptions({
        mdx: {
          remarkPlugins: [remarkPlugin],
          rehypePlugins: [rehypePlugin],
        },
      }),
    );
    const result = main.config!({} as never);

    expect(result!.mdx!.remarkPlugins).toContain(remarkPlugin);
    expect(result!.mdx!.rehypePlugins).toContain(rehypePlugin);
  });
});

// =============================================================================
// No hardcoded text content
// =============================================================================

describe("docsTheme — no hardcoded content", () => {
  it("should use title from options in 404 route props", () => {
    const [main] = docsTheme(createMinimalOptions({ title: "MySite" }));
    const result = main.config!({} as never);
    const notFoundRoute = result!.routes!.find((r) => r.path === "/404");

    expect(notFoundRoute).toBeDefined();
    const props = notFoundRoute!.props as Record<string, unknown>;
    expect(props.title).toBe("404 - Page Not Found | MySite");
  });

  it("should use title from options in home route props", () => {
    const [main] = docsTheme(createMinimalOptions({ title: "MySite" }));
    const result = main.config!({} as never);
    const homeRoute = result!.routes!.find((r) => r.path === "/");

    expect(homeRoute).toBeDefined();
    const props = homeRoute!.props as Record<string, unknown>;
    expect(props.title).toBe("MySite");
  });
});

// =============================================================================
// home option
// =============================================================================

describe("docsTheme config() — home option", () => {
  it("should register home route by default (home undefined)", () => {
    const [main] = docsTheme(createMinimalOptions());
    const result = main.config!({} as never);
    const paths = result!.routes!.map((r) => r.path);

    expect(paths).toContain("/");
  });

  it("should not register home route when home: false", () => {
    const [main] = docsTheme(createMinimalOptions({ home: false }));
    const result = main.config!({} as never);
    const paths = result!.routes!.map((r) => r.path);

    expect(paths).not.toContain("/");
    // Should still have 404
    expect(paths).toContain("/404");
  });

  it("should register docs-index home route when home: 'docs-index'", () => {
    const [main] = docsTheme(
      createMinimalOptions({
        home: "docs-index",
        docs: { source: createMockSource([]) },
      }),
    );
    const result = main.config!({} as never);
    const homeRoute = result!.routes!.find((r) => r.path === "/");

    expect(homeRoute).toBeDefined();
    // Props should be a function (async) for fetching collections
    expect(typeof homeRoute!.props).toBe("function");
  });

  it("should register custom component home route when home is a function", () => {
    const CustomHome = ({ Layout: _Layout }: { Layout: unknown }) => (
      <div>
        <h1>Custom Home</h1>
      </div>
    );

    const [main] = docsTheme(createMinimalOptions({ home: CustomHome }));
    const result = main.config!({} as never);
    const homeRoute = result!.routes!.find((r) => r.path === "/");

    expect(homeRoute).toBeDefined();
    // Props should be a function (async) for passing Layout and collections
    expect(typeof homeRoute!.props).toBe("function");
  });

  it("should still have all other routes when home: false", () => {
    const [main] = docsTheme(
      createMinimalOptions({
        home: false,
        docs: { source: createMockSource([]) },
        guides: { source: createMockSource([]) },
      }),
    );
    const result = main.config!({} as never);
    const paths = result!.routes!.map((r) => r.path);

    expect(paths).not.toContain("/");
    expect(paths).toContain("/docs");
    expect(paths).toContain("/docs/:slug");
    expect(paths).toContain("/guides");
    expect(paths).toContain("/guides/:slug");
    expect(paths).toContain("/404");
  });
});

// =============================================================================
// Integration with SSG plugin system
// =============================================================================

describe("docsTheme — SSG integration", () => {
  it("should work with createSSG as a plugin array (Vite-style)", () => {
    const plugins = docsTheme(
      createMinimalOptions({
        docs: { source: createMockSource([]) },
      }),
    );

    // Should not throw — nested arrays are flattened
    const ssg = createSSG({
      outDir: "./dist",
      plugins: [plugins],
    });

    expect(ssg).toBeDefined();
  });

  it("should merge with user-provided collections", async () => {
    const themeSource = createMockSource<{ title: string }>([
      {
        id: "intro",
        slug: "intro",
        data: { title: "Intro" },
        body: "",
        render: vi.fn(),
      },
    ]);

    const userSource = createMockSource<{ name: string }>([
      {
        id: "blog-1",
        slug: "blog-1",
        data: { name: "Blog Post" },
        body: "",
        render: vi.fn(),
      },
    ]);

    const plugins = docsTheme(
      createMinimalOptions({
        docs: { source: themeSource },
      }),
    );

    const ssg = createSSG({
      outDir: "./dist",
      plugins: [plugins],
      collections: [
        defineCollection({
          name: "blog",
          source: userSource,
          schema: z.object({ name: z.string() }),
        }),
      ],
    });

    // Both plugin and user collections available
    const docs = await ssg.getCollection("docs");
    expect(docs).toHaveLength(1);

    const blog = await ssg.getCollection("blog");
    expect(blog).toHaveLength(1);
  });

  it("should let user document override theme document", () => {
    const userDoc = () => (
      <html>
        <body>user</body>
      </html>
    );

    const plugins = docsTheme(createMinimalOptions());

    let resolvedDoc: unknown;
    const inspector: SSGPlugin = {
      name: "inspector",
      enforce: "post",
      configResolved(config) {
        resolvedDoc = config.document;
      },
    };

    createSSG({
      outDir: "./dist",
      plugins: [plugins, inspector],
      document: userDoc,
    });

    // User document wins over theme document
    expect(resolvedDoc).toBe(userDoc);
  });
});

// =============================================================================
// Agent Markdown integration
// =============================================================================

describe("docsTheme — llms integration", () => {
  it("should include llms plugin when docs are configured", () => {
    const plugins = docsTheme(
      createMinimalOptions({
        docs: { source: createMockSource([]) },
      }),
    );
    expect(plugins.find((p) => p.name === "llms")).toBeDefined();
  });

  it("should include llms plugin when guides are configured", () => {
    const plugins = docsTheme(
      createMinimalOptions({
        guides: { source: createMockSource([]) },
      }),
    );
    expect(plugins.find((p) => p.name === "llms")).toBeDefined();
  });

  it("should not include llms when no content collections", () => {
    const plugins = docsTheme(createMinimalOptions());
    expect(plugins.find((p) => p.name === "llms")).toBeUndefined();
  });

  it("should not include llms when explicitly disabled", () => {
    const plugins = docsTheme(
      createMinimalOptions({
        docs: { source: createMockSource([]) },
        llms: false,
      }),
    );
    expect(plugins.find((p) => p.name === "llms")).toBeUndefined();
  });

  it("should pass custom llms options", () => {
    const plugins = docsTheme(
      createMinimalOptions({
        docs: { source: createMockSource([]) },
        llms: {
          url: "https://example.com",
          links: [{ title: "GitHub", url: "https://github.com/test" }],
        },
      }),
    );
    // Plugin exists — options are passed internally
    expect(plugins.find((p) => p.name === "llms")).toBeDefined();
  });
});

// =============================================================================
// Callout component
// =============================================================================

describe("Callout component", () => {
  it("should render with default info type", () => {
    const result = Callout({ children: "Hello" }) as VNode;
    expect(result).toBeDefined();
    expect(result.props.role).toBe("note");
    expect(result.props.style).toContain("rgba(0, 122, 255");
  });

  it("should render with specified type", () => {
    const result = Callout({ type: "warning", children: "Warning!" }) as VNode;
    expect(result.props.role).toBe("note");
    expect(result.props.style).toContain("rgba(255, 159, 10");
  });

  it("should render title when provided", () => {
    const result = Callout({ title: "Note", children: "Content" }) as VNode;
    // VNode children should include the title div and content div
    expect(result.children.length).toBeGreaterThan(1);
  });
});

// =============================================================================
// CodeBlock component
// =============================================================================

describe("CodeBlock component", () => {
  it("should render code block", () => {
    const result = CodeBlock({ children: "const x = 1;", language: "ts" });
    expect(result).toBeDefined();
    expect(result.props.class).toBe("dt-code-block");
  });

  it("should extract language from className", () => {
    const result = CodeBlock({ children: "code", className: "language-python" });
    expect(result).toBeDefined();
  });

  it("should hide header for plain text", () => {
    const result = CodeBlock({ children: "plain text" });
    expect(result).toBeDefined();
  });
});
