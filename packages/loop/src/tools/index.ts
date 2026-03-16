/**
 * Built-in loop tools: grep, web_fetch, web_search, web_browse.
 */
import type { ToolSet } from "ai";
import { createGrepTool } from "./grep.ts";
import { createWebFetchTool } from "./web_fetch.ts";
import { createWebSearchTool, type WebSearchOptions } from "./web_search.ts";
import { createWebBrowseTool, closeBrowser } from "./web_browse.ts";

export { createGrepTool } from "./grep.ts";
export { createWebFetchTool } from "./web_fetch.ts";
export { createWebSearchTool, type WebSearchOptions } from "./web_search.ts";
export { createWebBrowseTool, closeBrowser } from "./web_browse.ts";

export interface LoopToolsOptions {
  /** Enable grep tool (default: true) */
  grep?: boolean;
  /** Enable web_fetch tool (default: true) */
  web_fetch?: boolean;
  /** Enable web_search tool (default: true if BRAVE_SEARCH_API_KEY is set) */
  web_search?: boolean | WebSearchOptions;
  /** Enable web_browse tool (default: false — requires playwright) */
  web_browse?: boolean;
  /** Working directory for grep */
  cwd?: string;
}

/**
 * Create the standard set of loop tools based on options.
 */
export function createLoopTools(opts: LoopToolsOptions = {}): ToolSet {
  const tools: ToolSet = {};

  if (opts.grep !== false) {
    tools.grep = createGrepTool({ cwd: opts.cwd });
  }

  if (opts.web_fetch !== false) {
    tools.web_fetch = createWebFetchTool();
  }

  if (opts.web_search !== false) {
    const searchOpts =
      typeof opts.web_search === "object" ? opts.web_search : {};
    // Only include by default if API key is available
    if (opts.web_search === true || searchOpts.apiKey || process.env.BRAVE_SEARCH_API_KEY) {
      tools.web_search = createWebSearchTool(searchOpts);
    }
  }

  if (opts.web_browse) {
    tools.web_browse = createWebBrowseTool();
  }

  return tools;
}
