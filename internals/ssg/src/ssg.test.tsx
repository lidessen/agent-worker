/** @jsxImportSource @semajsx/dom */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSSG, defineCollection, RawHTML, z } from "./index";
import type { CollectionSource, CollectionEntry, SSGPlugin } from "./types";

// Mock source for testing
function createMockSource<T>(entries: CollectionEntry<T>[]): CollectionSource<T> {
  return {
    id: "mock",
    getEntries: vi.fn().mockResolvedValue(entries),
    getEntry: vi.fn().mockImplementation(async (id) => entries.find((e) => e.id === id) ?? null),
  };
}

describe("RawHTML", () => {
  it("should have VNode structure", () => {
    const raw = new RawHTML("<p>Hello</p>");

    expect(raw.type).toBe("div");
    expect(raw.props.dangerouslySetInnerHTML.__html).toBe("<p>Hello</p>");
    expect(raw.children).toEqual([]);
  });

  it("should convert to string", () => {
    const raw = new RawHTML("<p>Hello</p>");

    expect(raw.toString()).toBe("<p>Hello</p>");
    expect(`${raw}`).toBe("<p>Hello</p>");
  });
});

describe("defineCollection", () => {
  it("should create a collection with schema", () => {
    const source = createMockSource([]);
    const collection = defineCollection({
      name: "posts",
      source,
      schema: z.object({
        title: z.string(),
      }),
    });

    expect(collection.name).toBe("posts");
    expect(collection.source).toBe(source);
  });
});

describe("SSG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should get collection entries", async () => {
    const entries: CollectionEntry<{ title: string }>[] = [
      {
        id: "post-1",
        slug: "post-1",
        data: { title: "First Post" },
        body: "Content",
        render: vi.fn(),
      },
    ];

    const source = createMockSource(entries);
    const collection = defineCollection({
      name: "posts",
      source,
      schema: z.object({ title: z.string() }),
    });

    const ssg = createSSG({
      outDir: "./dist",
      collections: [collection],
    });

    const result = await ssg.getCollection("posts");

    expect(result).toHaveLength(1);
    expect(result[0].data.title).toBe("First Post");
  });

  it("should get single entry", async () => {
    const entries: CollectionEntry<{ title: string }>[] = [
      {
        id: "post-1",
        slug: "post-1",
        data: { title: "First Post" },
        body: "Content",
        render: vi.fn(),
      },
    ];

    const source = createMockSource(entries);
    const collection = defineCollection({
      name: "posts",
      source,
      schema: z.object({ title: z.string() }),
    });

    const ssg = createSSG({
      outDir: "./dist",
      collections: [collection],
    });

    const entry = await ssg.getEntry("posts", "post-1");

    expect(entry).not.toBeNull();
    expect(entry?.data.title).toBe("First Post");
  });

  it("should throw on missing collection", async () => {
    const ssg = createSSG({
      outDir: "./dist",
    });

    await expect(ssg.getCollection("missing")).rejects.toThrow('Collection "missing" not found');
  });

  it("should validate schema", async () => {
    const entries: CollectionEntry<unknown>[] = [
      {
        id: "post-1",
        slug: "post-1",
        data: { invalid: true }, // Missing title
        body: "Content",
        render: vi.fn(),
      },
    ];

    const source = createMockSource(entries);
    const collection = defineCollection({
      name: "posts",
      source,
      schema: z.object({ title: z.string() }),
    });

    const ssg = createSSG({
      outDir: "./dist",
      collections: [collection],
    });

    await expect(ssg.getCollection("posts")).rejects.toThrow("Validation error");
  });
});

describe("SSG plugin resolution", () => {
  it("should merge plugin collections with user collections", async () => {
    const pluginSource = createMockSource<{ title: string }>([
      { id: "a", slug: "a", data: { title: "A" }, body: "", render: vi.fn() },
    ]);
    const userSource = createMockSource<{ name: string }>([
      { id: "b", slug: "b", data: { name: "B" }, body: "", render: vi.fn() },
    ]);

    const plugin: SSGPlugin = {
      name: "test-plugin",
      config() {
        return {
          collections: [
            defineCollection({
              name: "docs",
              source: pluginSource,
              schema: z.object({ title: z.string() }),
            }),
          ],
        };
      },
    };

    const ssg = createSSG({
      outDir: "./dist",
      plugins: [plugin],
      collections: [
        defineCollection({
          name: "posts",
          source: userSource,
          schema: z.object({ name: z.string() }),
        }),
      ],
    });

    // Both plugin and user collections should be available
    const docs = await ssg.getCollection("docs");
    expect(docs).toHaveLength(1);
    expect(docs[0].data.title).toBe("A");

    const posts = await ssg.getCollection("posts");
    expect(posts).toHaveLength(1);
    expect(posts[0].data.name).toBe("B");
  });

  it("should merge plugin routes with user routes", () => {
    const pluginRoute = { path: "/docs", component: () => <div>docs</div> };
    const userRoute = { path: "/about", component: () => <div>about</div> };

    const plugin: SSGPlugin = {
      name: "test-plugin",
      config() {
        return { routes: [pluginRoute] };
      },
    };

    // Routes are merged in constructor — verify via configResolved
    let resolvedRoutes: unknown[] = [];
    const inspector: SSGPlugin = {
      name: "inspector",
      enforce: "post",
      configResolved(config) {
        resolvedRoutes = config.routes ?? [];
      },
    };

    createSSG({
      outDir: "./dist",
      plugins: [plugin, inspector],
      routes: [userRoute],
    });

    expect(resolvedRoutes).toHaveLength(2);
    expect((resolvedRoutes[0] as { path: string }).path).toBe("/docs");
    expect((resolvedRoutes[1] as { path: string }).path).toBe("/about");
  });

  it("should let user document override plugin document", () => {
    const pluginDoc = () => (
      <html>
        <body>plugin</body>
      </html>
    );
    const userDoc = () => (
      <html>
        <body>user</body>
      </html>
    );

    const plugin: SSGPlugin = {
      name: "theme",
      config() {
        return { document: pluginDoc };
      },
    };

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
      plugins: [plugin, inspector],
      document: userDoc,
    });

    // User document wins
    expect(resolvedDoc).toBe(userDoc);
  });

  it("should use plugin document when user does not provide one", () => {
    const pluginDoc = () => (
      <html>
        <body>theme</body>
      </html>
    );

    const plugin: SSGPlugin = {
      name: "theme",
      config() {
        return { document: pluginDoc };
      },
    };

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
      plugins: [plugin, inspector],
    });

    expect(resolvedDoc).toBe(pluginDoc);
  });

  it("should respect enforce ordering for plugins", () => {
    const order: string[] = [];

    const prePlugin: SSGPlugin = {
      name: "pre",
      enforce: "pre",
      config() {
        order.push("pre");
      },
    };
    const normalPlugin: SSGPlugin = {
      name: "normal",
      config() {
        order.push("normal");
      },
    };
    const postPlugin: SSGPlugin = {
      name: "post",
      enforce: "post",
      config() {
        order.push("post");
      },
    };

    // Pass in reverse order — enforce should re-sort them
    createSSG({
      outDir: "./dist",
      plugins: [postPlugin, normalPlugin, prePlugin],
    });

    expect(order).toEqual(["pre", "normal", "post"]);
  });

  it("should flatten nested plugin arrays (Vite-style)", () => {
    const order: string[] = [];

    const pluginA: SSGPlugin = {
      name: "a",
      config() {
        order.push("a");
      },
    };
    const pluginB: SSGPlugin = {
      name: "b",
      config() {
        order.push("b");
      },
    };
    const pluginC: SSGPlugin = {
      name: "c",
      config() {
        order.push("c");
      },
    };

    // Pass [pluginA, pluginB] as a nested array (Vite-style factory return)
    createSSG({
      outDir: "./dist",
      plugins: [[pluginA, pluginB], pluginC],
    });

    expect(order).toEqual(["a", "b", "c"]);
  });

  it("should merge mdx components from multiple plugins", () => {
    const Comp1 = () => <div>1</div>;
    const Comp2 = () => <div>2</div>;
    const UserComp = () => <div>user</div>;

    const plugin1: SSGPlugin = {
      name: "p1",
      config() {
        return { mdx: { components: { Comp1 } } };
      },
    };
    const plugin2: SSGPlugin = {
      name: "p2",
      config() {
        return { mdx: { components: { Comp2 } } };
      },
    };

    let resolvedComponents: Record<string, unknown> = {};
    const inspector: SSGPlugin = {
      name: "inspector",
      enforce: "post",
      configResolved(config) {
        resolvedComponents = (config.mdx?.components as Record<string, unknown>) ?? {};
      },
    };

    createSSG({
      outDir: "./dist",
      plugins: [plugin1, plugin2, inspector],
      mdx: { components: { UserComp } },
    });

    expect(resolvedComponents.Comp1).toBe(Comp1);
    expect(resolvedComponents.Comp2).toBe(Comp2);
    expect(resolvedComponents.UserComp).toBe(UserComp);
  });
});
