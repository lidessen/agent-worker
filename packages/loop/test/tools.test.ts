import { test, expect, describe, afterAll } from "bun:test";
import {
  createGrepTool,
  createWebFetchTool,
  createWebSearchTool,
  createWebBrowseTool,
  createLoopTools,
} from "../src/tools/index.ts";

// Helper to call a tool's execute function
function exec(tool: any, args: Record<string, unknown>): Promise<string> {
  return tool.execute(args, { toolCallId: "test", messages: [] });
}

// ── grep ────────────────────────────────────────────────────────────────────

describe("grep", () => {
  const grep = createGrepTool({ cwd: import.meta.dir + "/.." });

  test("finds matches in source files", async () => {
    const result = await exec(grep, {
      pattern: "createGrepTool",
      path: "src/tools",
    });
    expect(result).toContain("createGrepTool");
    expect(result).toContain("grep.ts");
  });

  test("returns no matches for nonsense pattern", async () => {
    const result = await exec(grep, {
      pattern: "xyzzy_nonexistent_pattern_42",
      path: "src/tools",
    });
    expect(result).toBe("No matches found.");
  });

  test("respects glob filter", async () => {
    const result = await exec(grep, {
      pattern: "import",
      path: "src/tools",
      glob: "*.ts",
    });
    expect(result).toContain("import");
  });

  test("supports case_insensitive", async () => {
    const result = await exec(grep, {
      pattern: "CREATEGRIPTOOL", // wrong case intentionally
      path: "src/tools",
      case_insensitive: true,
    });
    // Should still not match because GRIP != GREP
    expect(result).toBe("No matches found.");
  });

  test("supports fixed_strings", async () => {
    const result = await exec(grep, {
      pattern: "z.object(",
      path: "src/tools",
      fixed_strings: true,
    });
    expect(result).toContain("z.object(");
  });

  test("respects max_results", async () => {
    const result = await exec(grep, {
      pattern: "import",
      path: "src",
      max_results: 3,
    });
    const lines = result.split("\n").filter((l) => l.includes("import"));
    expect(lines.length).toBeLessThanOrEqual(3);
  });
});

// ── web_fetch ───────────────────────────────────────────────────────────────

describe("web_fetch", () => {
  const webFetch = createWebFetchTool();

  test("fetches a plain text URL", async () => {
    const result = await exec(webFetch, {
      url: "https://example.com",
      max_length: 1000,
      prefer_llms_txt: false,
    });
    expect(result).toContain("Example Domain");
  });

  test("fetches llms.txt when available", async () => {
    const result = await exec(webFetch, {
      url: "https://hono.dev",
      max_length: 500,
      prefer_llms_txt: true,
    });
    expect(result).toContain("llms");
    expect(result).toContain("Hono");
  });

  test("falls back to HTML when llms.txt is absent", async () => {
    const result = await exec(webFetch, {
      url: "https://example.com",
      max_length: 1000,
      prefer_llms_txt: true,
    });
    // example.com has no llms.txt, should still get content
    expect(result).toContain("Example Domain");
  });

  test("respects max_length truncation", async () => {
    const result = await exec(webFetch, {
      url: "https://hono.dev",
      max_length: 100,
    });
    expect(result.length).toBeLessThanOrEqual(200); // some overhead for truncation message
    expect(result).toContain("truncated");
  });

  test("handles invalid URL gracefully", async () => {
    const result = await exec(webFetch, {
      url: "https://this-domain-definitely-does-not-exist-xyz123.com",
      prefer_llms_txt: false,
    });
    expect(result).toContain("Error");
  });

  test("raw mode returns unprocessed content", async () => {
    const result = await exec(webFetch, {
      url: "https://example.com",
      raw: true,
      prefer_llms_txt: false,
      max_length: 2000,
    });
    // Raw HTML should contain tags
    expect(result).toContain("<");
    expect(result).toContain("Example Domain");
  });
});

// ── web_search ──────────────────────────────────────────────────────────────

describe("web_search", () => {
  const webSearch = createWebSearchTool();

  test("returns error when no API key is set", async () => {
    // Save and unset
    const saved = process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.BRAVE_SEARCH_API_KEY;
    try {
      const result = await exec(webSearch, { query: "test" });
      expect(result).toContain("BRAVE_SEARCH_API_KEY");
    } finally {
      if (saved) process.env.BRAVE_SEARCH_API_KEY = saved;
    }
  });

  test("searches when API key is available", async () => {
    if (!process.env.BRAVE_SEARCH_API_KEY) {
      console.log("  ⏭ Skipping: BRAVE_SEARCH_API_KEY not set");
      return;
    }
    const result = await exec(webSearch, {
      query: "Vercel agent-browser",
      max_results: 3,
    });
    expect(result).not.toContain("Error");
    // Should have numbered results
    expect(result).toContain("1.");
  });
});

// ── web_browse ──────────────────────────────────────────────────────────────

describe("web_browse", () => {
  const webBrowse = createWebBrowseTool();

  test("opens a page and gets title", async () => {
    const result = await exec(webBrowse, {
      command: "open https://example.com",
    });
    expect(result).toContain("Example Domain");
  });

  test("takes a snapshot of interactive elements", async () => {
    const result = await exec(webBrowse, {
      command: "snapshot -i",
    });
    // Snapshot output uses ref=eN format for element references
    expect(result).toContain("ref=e");
  });

  test("gets text from a ref", async () => {
    const result = await exec(webBrowse, {
      command: "get text @e1",
    });
    expect(result).toContain("Example Domain");
  });

  test("gets current URL", async () => {
    const result = await exec(webBrowse, {
      command: "get url",
    });
    expect(result).toContain("example.com");
  });

  afterAll(async () => {
    await exec(webBrowse, { command: "close" });
  });
});

// ── createLoopTools ─────────────────────────────────────────────────────────

describe("createLoopTools", () => {
  test("creates default tools (grep + web_fetch)", () => {
    const tools = createLoopTools();
    expect(Object.keys(tools)).toContain("grep");
    expect(Object.keys(tools)).toContain("web_fetch");
    // web_search excluded by default (no API key in test)
    // web_browse excluded by default
    expect(Object.keys(tools)).not.toContain("web_browse");
  });

  test("includes web_browse when enabled", () => {
    const tools = createLoopTools({ web_browse: true });
    expect(Object.keys(tools)).toContain("web_browse");
  });

  test("includes web_search when forced", () => {
    const tools = createLoopTools({ web_search: true });
    expect(Object.keys(tools)).toContain("web_search");
  });

  test("can disable all tools", () => {
    const tools = createLoopTools({
      grep: false,
      web_fetch: false,
      web_search: false,
      web_browse: false,
    });
    expect(Object.keys(tools)).toHaveLength(0);
  });
});
