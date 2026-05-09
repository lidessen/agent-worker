import { compile } from "@mdx-js/mdx";
import type { Pluggable } from "unified";
import type { VNode } from "@semajsx/core";
import type { MDXConfig, MDXCompileResult, Heading } from "./types";

/**
 * MDX Processor for compiling MDX content to JSX components
 */
export class MDXProcessor {
  private config: MDXConfig;

  constructor(config: MDXConfig = {}) {
    this.config = config;
  }

  /**
   * Compile MDX content to a JSX component
   */
  async compile(
    content: string,
    frontmatter: Record<string, unknown> = {},
  ): Promise<MDXCompileResult> {
    // Extract headings for table of contents
    const headings = this.extractHeadings(content);

    // Compile MDX to JavaScript
    const compiled = await compile(content, {
      outputFormat: "function-body",
      development: false,
      remarkPlugins: (this.config.remarkPlugins ?? []) as Pluggable[],
      rehypePlugins: (this.config.rehypePlugins ?? []) as Pluggable[],
      // Use SemaJSX runtime
      jsxImportSource: "semajsx/dom",
    });

    // Dynamic import of JSX runtime
    const jsxRuntime = await import("semajsx/dom/jsx-runtime");

    // Create the Content component
    const Content = this.createComponent(
      String(compiled),
      this.config.components ?? {},
      jsxRuntime,
    );

    return {
      Content,
      frontmatter,
      headings,
    };
  }

  /**
   * Create a component from compiled MDX code
   */
  private createComponent(
    code: string,
    components: Record<string, (props: Record<string, unknown>) => VNode>,
    jsxRuntime: unknown,
  ): (props?: Record<string, unknown>) => VNode {
    // Import JSX runtime
    // This will be resolved at runtime
    return (props: Record<string, unknown> = {}) => {
      try {
        // Create a function from the MDX compiled code
        // MDX compiled code expects jsx runtime in arguments[0]
        // By using new Function() with no parameters, we can pass
        // the runtime via call() and it becomes arguments[0]
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function(code + "\nreturn MDXContent;");

        // Call with jsxRuntime as arguments[0]
        // MDX returns an object with default export
        const result = fn.call(null, jsxRuntime) as {
          default: (props: Record<string, unknown>) => VNode;
        };
        return result.default({ ...props, components });
      } catch (e) {
        // Fallback for when runtime is not available
        throw new Error(`MDX rendering failed: ${(e as Error).message}`);
      }
    };
  }

  /**
   * Extract headings from markdown content
   */
  private extractHeadings(content: string): Heading[] {
    const headings: Heading[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;

    let match;
    while ((match = headingRegex.exec(content)) !== null) {
      const hashes = match[1];
      const rawText = match[2];
      if (!hashes || !rawText) continue;

      const depth = hashes.length;
      const text = rawText.trim();
      const slug = this.slugify(text);

      headings.push({ depth, text, slug });
    }

    return headings;
  }

  /**
   * Convert text to URL-friendly slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }
}

/**
 * Create an MDX processor instance
 */
export function createMDXProcessor(config?: MDXConfig): MDXProcessor {
  return new MDXProcessor(config);
}
