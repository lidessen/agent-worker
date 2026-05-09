import type { VNode } from "@semajsx/core";

export interface MDXConfig {
  /** Remark plugins for markdown processing */
  remarkPlugins?: unknown[];
  /** Rehype plugins for HTML processing */
  rehypePlugins?: unknown[];
  /** Component mapping for MDX elements */
  components?: Record<string, (props: Record<string, unknown>) => VNode>;
}

export interface MDXCompileResult {
  /** Compiled JSX component */
  Content: (props?: Record<string, unknown>) => VNode;
  /** Extracted frontmatter */
  frontmatter: Record<string, unknown>;
  /** Table of contents (headings) */
  headings: Heading[];
}

export interface Heading {
  depth: number;
  text: string;
  slug: string;
}
