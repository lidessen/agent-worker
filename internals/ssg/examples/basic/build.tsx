/** @jsxImportSource @semajsx/dom */

import { createSSG, defineCollection, fileSource, z } from "@semajsx/ssg";
import { resource } from "@semajsx/ssr";
import type { VNode } from "@semajsx/core";

// Import MDX components
import { Callout, CodeBlock, Counter } from "./components";

// Get the directory where this script is located
const rootDir = import.meta.dir;

// Create resource tools for CSS
const { Style } = resource(import.meta.url);

// Define blog collection
const blog = defineCollection({
  name: "blog",
  source: fileSource(
    {
      directory: "content/blog",
    },
    rootDir,
  ),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

// Components
const HomePage = (): VNode => (
  <div>
    <Style href="./styles.css" />
    <h1>Welcome to My Blog</h1>
    <p>This is a static site built with @semajsx/ssg</p>
  </div>
);

const BlogIndex = ({
  posts,
}: {
  posts: Array<{ slug: string; data: { title: string; date: Date } }>;
}): VNode => (
  <div>
    <Style href="./styles.css" />
    <h1>Blog Posts</h1>
    <ul>
      {posts.map((post) => (
        <li key={post.slug}>
          <a href={`/blog/${post.slug}`}>{post.data.title}</a>
          <span>- {post.data.date.toLocaleDateString()}</span>
        </li>
      ))}
    </ul>
  </div>
);

const BlogPost = ({
  post,
  content,
}: {
  post: { data: { title: string }; body: string };
  content: VNode;
}): VNode => (
  <article>
    <Style href="./styles.css" />
    <h1>{post.data.title}</h1>
    <div>{content}</div>
  </article>
);

// Create SSG instance
const ssg = createSSG({
  rootDir,
  outDir: "./dist",
  collections: [blog],
  // MDX configuration with custom components
  mdx: {
    components: {
      Callout,
      CodeBlock,
      Counter,
    },
  },
  routes: [
    {
      path: "/",
      component: HomePage,
      props: { title: "Home" },
    },
    {
      path: "/blog",
      component: BlogIndex as (props: Record<string, unknown>) => VNode,
      props: async (ssg) => ({
        title: "Blog",
        posts: await ssg.getCollection("blog"),
      }),
    },
    {
      path: "/blog/:slug",
      component: BlogPost as (props: Record<string, unknown>) => VNode,
      getStaticPaths: async (ssg) => {
        const posts = await ssg.getCollection("blog");
        return Promise.all(
          posts.map(async (post) => {
            const { Content } = await post.render();
            return {
              params: { slug: post.slug },
              props: { post, content: Content(), title: post.data.title },
            };
          }),
        );
      },
    },
  ],
});

// Build
async function main() {
  console.log("Building static site...");
  const result = await ssg.build();
  console.log(`Built ${result.paths.length} pages:`);
  console.log(result.stats);
}

main().catch(console.error);
