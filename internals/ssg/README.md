# @semajsx/ssg

Static Site Generation with Collections and MDX support for SemaJSX.

## Overview

`@semajsx/ssg` is a static site generator that builds on top of `@semajsx/ssr`, providing:

- **Collections** - Type-safe content management with multiple data sources
- **MDX Support** - Write content in MDX with custom components
- **Incremental Builds** - Only rebuild what changed
- **Watch Mode** - Auto-rebuild on content changes

## Installation

```bash
bun add @semajsx/ssg
```

## Quick Start

```typescript
import { createSSG, defineCollection, fileSource, z } from "@semajsx/ssg";

// Define a blog collection
const blog = defineCollection({
  name: "blog",
  source: fileSource({
    directory: "content/blog",
    watch: true,
  }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    tags: z.array(z.string()).optional(),
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

## API Reference

### `createSSG(config)`

Create an SSG instance.

```typescript
interface SSGConfig {
  outDir: string; // Output directory
  base?: string; // Base URL path (default: '/')
  collections?: Collection[]; // Collections to include
  routes?: RouteConfig[]; // Route definitions
  mdx?: MDXConfig; // MDX configuration
}
```

### `defineCollection(config)`

Define a collection with schema validation.

```typescript
const posts = defineCollection({
  name: "posts",
  source: fileSource({ directory: "content/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
  }),
});
```

### Collection Methods

```typescript
// Get all entries
const posts = await ssg.getCollection("blog");

// Get single entry
const post = await ssg.getEntry("blog", "hello-world");
```

### Build Methods

```typescript
// Full build
await ssg.build();

// Incremental build
const result = await ssg.build({
  incremental: true,
  state: previousState,
});

// Watch mode
const watcher = ssg.watch({
  onRebuild: (result) => console.log(`Built ${result.paths.length} pages`),
});

watcher.close(); // Stop watching
```

## Data Sources

### File Source

Load content from the filesystem (Markdown/MDX files).

```typescript
import { fileSource } from '@semajsx/ssg'

const blog = defineCollection({
  name: 'blog',
  source: fileSource({
    directory: 'content/blog',  // Directory path
    include: '**/*.{md,mdx}',   // Glob pattern (default)
    watch: true,                // Enable file watching
  }),
  schema: z.object({...}),
})
```

### Git Source

Load data from Git history.

```typescript
import { gitSource } from "@semajsx/ssg";

// From commits
const changelog = defineCollection({
  name: "changelog",
  source: gitSource({
    type: "commits",
    filter: {
      paths: ["packages/**"],
      since: "2024-01-01",
    },
    limit: 100,
  }),
  schema: z.object({
    hash: z.string(),
    message: z.string(),
    author: z.string(),
    date: z.date(),
  }),
});

// From tags
const releases = defineCollection({
  name: "releases",
  source: gitSource({
    type: "tags",
    pattern: "v*",
  }),
  schema: z.object({
    tag: z.string(),
    date: z.date(),
  }),
});
```

### Remote Source

Load content from remote APIs.

```typescript
import { remoteSource } from '@semajsx/ssg'

const posts = defineCollection({
  name: 'posts',
  source: remoteSource({
    // Fetch all entries
    fetch: async () => {
      const res = await fetch('https://api.example.com/posts')
      return res.json()
    },

    // Fetch single entry (optional)
    fetchOne: async (id) => {
      const res = await fetch(`https://api.example.com/posts/${id}`)
      return res.json()
    },

    // Incremental fetch (optional)
    fetchChanges: async (cursor) => {
      const res = await fetch(`https://api.example.com/posts/changes?since=${cursor}`)
      return res.json()
    },

    // Webhook config (optional)
    webhook: {
      path: '/webhook/posts',
      secret: process.env.WEBHOOK_SECRET,
    },

    // Polling for development (optional)
    pollInterval: 60000,
  }),
  schema: z.object({...}),
})
```

### Custom Source

Create custom data sources.

```typescript
import { createSource } from "@semajsx/ssg";

const customSource = createSource({
  id: "my-source",

  async getEntries() {
    return [
      /* your data */
    ];
  },

  async getEntry(id) {
    return; /* single item */
  },

  watch(callback) {
    // Subscribe to changes
    const unsubscribe = myEmitter.on("change", callback);
    return unsubscribe;
  },

  async getChanges(cursor) {
    return {
      cursor: newCursor,
      added: [],
      updated: [],
      deleted: [],
    };
  },
});
```

## Routes

### Static Routes

```typescript
{
  path: '/about',
  component: AboutPage,
  props: { title: 'About Us' },
}
```

### Dynamic Routes

```typescript
{
  path: '/blog/:slug',
  component: BlogPost,
  getStaticPaths: async (ssg) => {
    const posts = await ssg.getCollection('blog')
    return posts.map(post => ({
      params: { slug: post.slug },
      props: { post },
    }))
  },
}
```

### Async Props

```typescript
{
  path: '/blog',
  component: BlogIndex,
  props: async (ssg) => ({
    posts: await ssg.getCollection('blog'),
  }),
}
```

## MDX Support

```typescript
const ssg = createSSG({
  outDir: "./dist",
  collections: [blog],
  mdx: {
    remarkPlugins: [remarkGfm, remarkMath],
    rehypePlugins: [rehypeHighlight],
    components: {
      h1: CustomH1,
      code: CodeBlock,
      Callout,
    },
  },
});
```

## Incremental Builds

Track build state for efficient incremental builds:

```typescript
import { readFile, writeFile } from "fs/promises";

// Load previous state
let state;
try {
  state = JSON.parse(await readFile(".ssg-state.json", "utf-8"));
} catch {
  state = undefined;
}

// Build
const result = await ssg.build({
  incremental: true,
  state,
});

// Save state for next build
await writeFile(".ssg-state.json", JSON.stringify(result.state));

console.log(result.stats);
// { added: 2, updated: 1, deleted: 0, unchanged: 47 }
```

## Watch Mode

Auto-rebuild on content changes:

```typescript
const watcher = ssg.watch({
  onRebuild: (result) => {
    console.log(`Rebuilt ${result.paths.length} pages`);
  },
  onError: (error) => {
    console.error("Build failed:", error);
  },
});

// Stop watching
process.on("SIGINT", () => {
  watcher.close();
  process.exit();
});
```

## Architecture

```
Content Sources (File/Git/Remote/Custom)
    ↓
Collection Loader (schema validation)
    ↓
MDX Processor (if applicable)
    ↓
Route Generation (getStaticPaths)
    ↓
SSR Rendering (@semajsx/ssr)
    ↓
Static HTML + Island Bundles
```

## Build Output

```
dist/
├── index.html
├── about/index.html
├── blog/index.html
├── blog/hello-world/index.html
├── blog/another-post/index.html
├── _islands/              # Island bundles
│   └── counter-xxx.js
└── _assets/               # Static assets
```

## Types

### CollectionEntry

```typescript
interface CollectionEntry<T> {
  id: string; // Unique identifier
  slug: string; // URL-friendly slug
  data: T; // Validated frontmatter
  body: string; // Raw content body
  render: () => Promise<{ Content: () => VNode }>;
}
```

### ChangeSet

```typescript
interface ChangeSet<T> {
  cursor: string;
  added: CollectionEntry<T>[];
  updated: CollectionEntry<T>[];
  deleted: string[];
}
```

### BuildResult

```typescript
interface BuildResult {
  state: BuildState;
  paths: string[];
  stats: {
    added: number;
    updated: number;
    deleted: number;
    unchanged: number;
  };
}
```

## License

MIT
