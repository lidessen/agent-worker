/**
 * web_search tool — search the web using Brave Search API.
 *
 * Requires BRAVE_SEARCH_API_KEY env var.
 */
import { tool } from "ai";
import { z } from "zod";

const BRAVE_API_URL = "https://api.search.brave.com/res/v1/web/search";

export interface WebSearchOptions {
  /** Override the default Brave Search API key (reads from BRAVE_SEARCH_API_KEY env). */
  apiKey?: string;
}

export function createWebSearchTool(opts: WebSearchOptions = {}) {
  return tool({
    description:
      "Search the web using Brave Search. Returns titles, URLs, and snippets. " +
      "Requires BRAVE_SEARCH_API_KEY environment variable.",
    inputSchema: z.object({
      query: z.string().describe("Search query"),
      max_results: z
        .number()
        .optional()
        .describe("Max number of results (default: 5, max: 20)"),
      country: z
        .string()
        .optional()
        .describe('Country code for localized results (e.g. "US", "CN")'),
      freshness: z
        .enum(["pd", "pw", "pm", "py"])
        .optional()
        .describe(
          "Time filter: pd=past day, pw=past week, pm=past month, py=past year",
        ),
    }),
    execute: async (args) => {
      const apiKey = opts.apiKey ?? process.env.BRAVE_SEARCH_API_KEY;
      if (!apiKey) {
        return "Error: BRAVE_SEARCH_API_KEY not set. Get a free key at https://brave.com/search/api/";
      }

      const maxResults = Math.min(args.max_results ?? 5, 20);

      const params = new URLSearchParams({
        q: args.query,
        count: String(maxResults),
      });
      if (args.country) params.set("country", args.country);
      if (args.freshness) params.set("freshness", args.freshness);

      try {
        const response = await fetch(`${BRAVE_API_URL}?${params}`, {
          headers: {
            Accept: "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": apiKey,
          },
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          return `Error: Brave Search API returned ${response.status} ${response.statusText}`;
        }

        const data = (await response.json()) as BraveSearchResponse;
        const results = data.web?.results ?? [];

        if (results.length === 0) {
          return `No results found for "${args.query}".`;
        }

        return results
          .map((r, i) => {
            const parts = [`${i + 1}. **${r.title}**`, `   ${r.url}`];
            if (r.description) parts.push(`   ${r.description}`);
            return parts.join("\n");
          })
          .join("\n\n");
      } catch (err) {
        return `Error searching: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description?: string;
    }>;
  };
}
