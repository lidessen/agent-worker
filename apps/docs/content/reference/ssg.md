---
title: Static Site Generation (SSG)
description: Build fast static sites with SemaJSX SSG
order: 10
category: Advanced
---

# Static Site Generation

`semajsx/ssg` provides a powerful static site generator with collections, MDX support, and incremental builds.

## Installation

```bash
bun add semajsx
```

## Quick Start

Create a build script (`build.tsx`):

```tsx
import { createSSG, defineCollection, fileSource, z } from "semajsx/ssg";

// Define a collection
const blog = defineCollection({
  name: "blog",
  source: fileSource({
    directory: "content/blog",
  }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
  }),
});

// Create SSG instance
const ssg = createSSG({
  outDir: "./dist",
  collections: [blog],
  routes: [
    { path: "/", component: HomePage },
    {
      path: "/blog/:slug",
      component: BlogPost,
      getStaticPaths: async (ssg) => {
        const posts = await ssg.getCollection("blog");
        return posts.map((post) => ({
          params: { slug: post.slug },
          props: { post },
        }));
      },
    },
  ],
});

// Build
await ssg.build();
```

## Collections

Collections are type-safe content sources with schema validation:

```tsx
import { defineCollection, fileSource, z } from "semajsx/ssg";

const docs = defineCollection({
  name: "docs",
  source: fileSource({
    directory: "content/docs",
    include: "**/*.{md,mdx}",
  }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    order: z.number().default(999),
  }),
});
```

## Data Sources

### File Source

Load content from Markdown/MDX files:

```tsx
import { fileSource } from "semajsx/ssg";

const source = fileSource({
  directory: "content/blog",
  include: "**/*.{md,mdx}",
  watch: true,
});
```

### Git Source

Load data from Git history:

```tsx
import { gitSource } from "semajsx/ssg";

// From commits
const changelog = gitSource({
  type: "commits",
  filter: { since: "2024-01-01" },
  limit: 100,
});

// From tags
const releases = gitSource({
  type: "tags",
  pattern: "v*",
});
```

### Remote Source

Fetch content from APIs:

```tsx
import { remoteSource } from "semajsx/ssg";

const posts = remoteSource({
  fetch: async () => {
    const res = await fetch("https://api.example.com/posts");
    return res.json();
  },
  pollInterval: 60000, // Poll every minute in dev
});
```

## Routes

### Static Routes

```tsx
{
  path: "/about",
  component: AboutPage,
  props: { title: "About Us" },
}
```

### Dynamic Routes

```tsx
{
  path: "/blog/:slug",
  component: BlogPost,
  getStaticPaths: async (ssg) => {
    const posts = await ssg.getCollection("blog");
    return posts.map(post => ({
      params: { slug: post.slug },
      props: { post },
    }));
  },
}
```

## MDX Support

Use MDX with custom components:

```tsx
const ssg = createSSG({
  outDir: "./dist",
  collections: [blog],
  mdx: {
    components: {
      Callout,
      CodeBlock,
      Counter, // Interactive islands!
    },
  },
});
```

## Incremental Builds

Track build state for faster rebuilds:

```tsx
import { readFile, writeFile } from "fs/promises";

// Load previous state
let state;
try {
  state = JSON.parse(await readFile(".ssg-state.json", "utf-8"));
} catch {
  state = undefined;
}

// Build incrementally
const result = await ssg.build({
  incremental: true,
  state,
});

// Save state
await writeFile(".ssg-state.json", JSON.stringify(result.state));

console.log(result.stats);
// { added: 2, updated: 1, deleted: 0, unchanged: 47 }
```

<Callout type="tip" title="Development workflow">
Use incremental builds in CI/CD to dramatically reduce build times for large sites.
</Callout>

## Watch Mode

Auto-rebuild on content changes:

```tsx
const watcher = ssg.watch({
  onRebuild: (result) => {
    console.log(`Rebuilt ${result.paths.length} pages`);
  },
});

// Stop watching
process.on("SIGINT", () => {
  watcher.close();
  process.exit();
});
```

## Build Output

SSG generates static HTML with Island architecture:

```
dist/
├── index.html
├── blog/
│   ├── hello-world/
│   │   └── index.html
│   └── getting-started/
│       └── index.html
├── _islands/          # Interactive island bundles
│   └── counter-xxx.js
└── _assets/           # Static assets
```

## Next Steps

- Explore [SSR](/reference/ssr) for server-side rendering
- Learn about [Components](/reference/components) for building reusable UI
- Check out the [SSG Example](https://github.com/semajsx/semajsx/tree/main/packages/ssg/examples)
