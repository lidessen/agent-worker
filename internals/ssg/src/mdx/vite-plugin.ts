import { compile } from "@mdx-js/mdx";
import type { Plugin, PluginOption } from "vite";
import type { Pluggable } from "unified";

/**
 * MDX plugin options
 */
export interface MDXPluginOptions {
  /** Remark plugins */
  remarkPlugins?: unknown[];
  /** Rehype plugins */
  rehypePlugins?: unknown[];
}

/**
 * Vite plugin for MDX support
 * Transforms .mdx files to JSX modules
 */
export function viteMDXPlugin(options: MDXPluginOptions = {}): PluginOption {
  const plugin: Plugin = {
    name: "semajsx-mdx",

    async transform(code: string, id: string) {
      // Only transform .mdx files
      if (!id.endsWith(".mdx")) {
        return null;
      }

      try {
        // Compile MDX to JavaScript (not JSX)
        const compiled = await compile(code, {
          jsxImportSource: "semajsx/dom",
          outputFormat: "program",
          development: false,
          remarkPlugins: (options.remarkPlugins ?? []) as Pluggable[],
          rehypePlugins: (options.rehypePlugins ?? []) as Pluggable[],
        });

        return {
          code: String(compiled),
          map: null,
        };
      } catch (error) {
        const err = error as Error;
        throw new Error(`MDX compilation failed for ${id}: ${err.message}`);
      }
    },
  };

  return plugin;
}
