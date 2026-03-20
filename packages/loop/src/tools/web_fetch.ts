/**
 * web_fetch tool — fetch web content with llms.txt support.
 *
 * Strategy:
 *   1. If prefer_llms_txt is true (default), try {origin}/llms.txt first
 *   2. If llms.txt exists, return it directly (token-efficient)
 *   3. Otherwise fetch the actual URL and convert HTML → markdown
 */
import { tool } from "ai";
import { z } from "zod";

export function createWebFetchTool() {
  return tool({
    description:
      "Fetch content from a URL. Supports llms.txt convention — when available, returns " +
      "the site's LLM-optimized content instead of raw HTML. Falls back to HTML→markdown conversion.",
    inputSchema: z.object({
      url: z.string().describe("URL to fetch"),
      max_length: z
        .number()
        .optional()
        .describe("Max content length in characters (default: 20000)"),
      prefer_llms_txt: z
        .boolean()
        .optional()
        .describe("Try /llms.txt or /llms-full.txt at the origin first (default: true)"),
      llms_txt_variant: z
        .enum(["brief", "full"])
        .optional()
        .describe(
          'Which llms.txt variant to prefer: "brief" (/llms.txt) or "full" (/llms-full.txt). Default: "full"',
        ),
      raw: z.boolean().optional().describe("Return raw HTML without conversion (default: false)"),
    }),
    execute: async (args) => {
      const maxLength = args.max_length ?? 20_000;
      const preferLlmsTxt = args.prefer_llms_txt !== false;
      const variant = args.llms_txt_variant ?? "full";

      // SSRF protection: block private/internal URLs
      const urlError = validatePublicUrl(args.url);
      if (urlError) return urlError;

      try {
        // Step 1: Try llms.txt if preferred
        if (preferLlmsTxt) {
          const origin = new URL(args.url).origin;
          const llmsTxtContent = await tryLlmsTxt(origin, variant, maxLength);
          if (llmsTxtContent) return llmsTxtContent;
        }

        // Step 2: Fetch the actual URL
        const response = await fetchWithTimeout(args.url);
        if (!response.ok) {
          return `Error: HTTP ${response.status} ${response.statusText}`;
        }

        const contentType = response.headers.get("content-type") ?? "";
        const body = await response.text();

        // Non-HTML: return as-is
        if (!contentType.includes("html") || args.raw) {
          return truncate(body, maxLength);
        }

        // HTML → markdown
        const markdown = await htmlToMarkdown(body, args.url);
        return truncate(markdown, maxLength);
      } catch (err) {
        return `Error fetching ${args.url}: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });
}

async function tryLlmsTxt(
  origin: string,
  variant: "brief" | "full",
  maxLength: number,
): Promise<string | null> {
  // Try preferred variant first, then fallback
  const urls =
    variant === "full"
      ? [`${origin}/llms-full.txt`, `${origin}/llms.txt`]
      : [`${origin}/llms.txt`, `${origin}/llms-full.txt`];

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, 5_000);
      if (res.ok) {
        const text = await res.text();
        // Sanity check: llms.txt should be text, not HTML
        if (text.length > 0 && !text.trimStart().startsWith("<!")) {
          return `[via ${url}]\n\n${truncate(text, maxLength)}`;
        }
      }
    } catch {
      // Ignore — will fall back to regular fetch
    }
  }
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "agent-worker/1.0 (web_fetch tool)",
        Accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function htmlToMarkdown(html: string, url: string): Promise<string> {
  // Lazy-load heavy deps
  const { parseHTML } = await import("linkedom");
  const { Readability } = await import("@mozilla/readability");
  const TurndownService = (await import("turndown")).default;

  const { document } = parseHTML(html);

  // Set base URL for relative links
  try {
    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head.appendChild(base);
  } catch {
    // Ignore
  }

  // Extract readable content
  const reader = new Readability(document as any, { charThreshold: 0 });
  const article = reader.parse();

  if (!article?.content) {
    // Fallback: just get body text
    const body = document.querySelector("body");
    return body?.textContent?.trim() ?? "Could not extract content from page.";
  }

  // Convert to markdown
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });
  td.remove(["script", "style", "nav", "footer", "header"]);

  let markdown = td.turndown(article.content);

  // Prepend title if available
  if (article.title) {
    markdown = `# ${article.title}\n\n${markdown}`;
  }

  return markdown;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + `\n\n... [truncated at ${maxLength} chars]`;
}

/**
 * Validate that a URL points to a public internet address (SSRF protection).
 * Returns an error string if blocked, null if OK.
 */
function validatePublicUrl(urlStr: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return `Error: Invalid URL: ${urlStr}`;
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `Error: Only http/https URLs are allowed, got ${parsed.protocol}`;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  ) {
    return "Error: Fetching localhost/loopback addresses is not allowed.";
  }

  // Block cloud metadata endpoints
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return "Error: Fetching cloud metadata endpoints is not allowed.";
  }

  // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 10 ||
      (a === 172 && b! >= 16 && b! <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    ) {
      return "Error: Fetching private network addresses is not allowed.";
    }
  }

  return null;
}
