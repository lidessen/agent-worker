import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { llms, _generateLlmsTxt, _generateLlmsFullTxt } from "./index";
import type { CollectionEntry, SSGInstance, SSGConfig, BuildResult } from "../../types";

// =============================================================================
// Test helpers
// =============================================================================

function mockEntry(overrides: Partial<CollectionEntry> = {}): CollectionEntry {
  return {
    id: "getting-started",
    slug: "getting-started",
    data: { title: "Getting Started", description: "Learn the basics" },
    body: "## Installation\n\nRun `npm install myproject`.\n\n## Usage\n\nImport and use it.",
    render: vi.fn(),
    ...overrides,
  };
}

function mockSSG(collections: Record<string, CollectionEntry[]>): SSGInstance {
  return {
    getRootDir: () => "/tmp/test",
    getCollection: vi.fn().mockImplementation(async (name: string) => {
      const entries = collections[name];
      if (!entries) throw new Error(`Collection "${name}" not found`);
      return entries;
    }),
    getEntry: vi.fn(),
    build: vi.fn(),
    watch: vi.fn(),
  };
}

const mockBuildResult: BuildResult = {
  state: { cursors: {}, pageHashes: {}, timestamp: Date.now() },
  paths: ["/", "/docs/getting-started"],
  stats: { added: 2, updated: 0, deleted: 0, unchanged: 0 },
};

// =============================================================================
// llms.txt generation (pure functions)
// =============================================================================

describe("generateLlmsTxt", () => {
  it("should generate a minimal llms.txt with only title", () => {
    const result = _generateLlmsTxt({ title: "My Project" }, new Map());

    expect(result).toBe("# My Project\n");
  });

  it("should include description as blockquote", () => {
    const result = _generateLlmsTxt(
      { title: "My Project", description: "A great project" },
      new Map(),
    );

    expect(result).toContain("# My Project");
    expect(result).toContain("> A great project");
  });

  it("should list collection entries as markdown links", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [
      mockEntry(),
      mockEntry({
        id: "api-ref",
        slug: "api-reference",
        data: { title: "API Reference", description: "Full API docs" },
        body: "API content",
      }),
    ]);

    const result = _generateLlmsTxt(
      {
        title: "My Project",
        sections: [{ title: "Documentation", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain("## Documentation");
    expect(result).toContain("- [Getting Started](/docs/getting-started): Learn the basics");
    expect(result).toContain("- [API Reference](/docs/api-reference): Full API docs");
  });

  it("should resolve absolute URLs when url is provided", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [mockEntry()]);

    const result = _generateLlmsTxt(
      {
        title: "My Project",
        url: "https://docs.example.com",
        sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain(
      "- [Getting Started](https://docs.example.com/docs/getting-started): Learn the basics",
    );
  });

  it("should strip trailing slash from url", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [mockEntry()]);

    const result = _generateLlmsTxt(
      {
        title: "My Project",
        url: "https://docs.example.com/",
        sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain("https://docs.example.com/docs/getting-started");
    expect(result).not.toContain("https://docs.example.com//docs");
  });

  it("should include optional links section", () => {
    const result = _generateLlmsTxt(
      {
        title: "My Project",
        links: [
          { title: "GitHub", url: "https://github.com/my/project", description: "Source code" },
          { title: "Discord", url: "https://discord.gg/invite" },
        ],
      },
      new Map(),
    );

    expect(result).toContain("## Optional");
    expect(result).toContain("- [GitHub](https://github.com/my/project): Source code");
    expect(result).toContain("- [Discord](https://discord.gg/invite)");
  });

  it("should skip empty collections", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", []);

    const result = _generateLlmsTxt(
      {
        title: "My Project",
        sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).not.toContain("## Docs");
  });

  it("should render entries without description", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [
      mockEntry({
        data: { title: "Quick Start" },
      }),
    ]);

    const result = _generateLlmsTxt(
      {
        title: "My Project",
        sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain("- [Quick Start](/docs/getting-started)");
    expect(result).not.toContain(": undefined");
  });

  it("should handle multiple sections", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [mockEntry()]);
    entries.set("blog", [
      mockEntry({
        id: "hello-world",
        slug: "hello-world",
        data: { title: "Hello World" },
        body: "First post!",
      }),
    ]);

    const result = _generateLlmsTxt(
      {
        title: "My Site",
        sections: [
          { title: "Documentation", collection: "docs", basePath: "/docs" },
          { title: "Blog", collection: "blog", basePath: "/blog" },
        ],
      },
      entries,
    );

    expect(result).toContain("## Documentation");
    expect(result).toContain("## Blog");
    expect(result).toContain("/docs/getting-started");
    expect(result).toContain("/blog/hello-world");
  });

  it("should fall back to slug when entry has no title", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [mockEntry({ data: {} })]);

    const result = _generateLlmsTxt(
      {
        title: "My Project",
        sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain("- [getting-started](/docs/getting-started)");
  });
});

// =============================================================================
// llms-full.txt generation (pure functions)
// =============================================================================

describe("generateLlmsFullTxt", () => {
  it("should include full body content for each entry", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [mockEntry()]);

    const result = _generateLlmsFullTxt(
      {
        title: "My Project",
        sections: [{ title: "Documentation", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain("# My Project");
    expect(result).toContain("## Documentation");
    expect(result).toContain("### Getting Started");
    expect(result).toContain("> Learn the basics");
    expect(result).toContain("Source: /docs/getting-started");
    expect(result).toContain("## Installation");
    expect(result).toContain("Run `npm install myproject`.");
    expect(result).toContain("---");
  });

  it("should include description blockquote", () => {
    const result = _generateLlmsFullTxt(
      { title: "My Project", description: "The best project" },
      new Map(),
    );

    expect(result).toContain("> The best project");
  });

  it("should handle entries without description", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [mockEntry({ data: { title: "Intro" } })]);

    const result = _generateLlmsFullTxt(
      {
        title: "My Project",
        sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain("### Intro");
    // Should go directly to Source without blockquote
    const introIndex = result.indexOf("### Intro");
    const sourceIndex = result.indexOf("Source:");
    const blockquoteIndex = result.indexOf("> ", introIndex);
    expect(blockquoteIndex === -1 || blockquoteIndex > sourceIndex).toBe(true);
  });

  it("should trim body content", () => {
    const entries = new Map<string, CollectionEntry[]>();
    entries.set("docs", [mockEntry({ body: "\n\n  Content with whitespace  \n\n" })]);

    const result = _generateLlmsFullTxt(
      {
        title: "My Project",
        sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      },
      entries,
    );

    expect(result).toContain("Content with whitespace");
    expect(result).not.toContain("\n\n\n\n");
  });
});

// =============================================================================
// Plugin integration
// =============================================================================

describe("llms plugin", () => {
  let outDir: string;

  beforeEach(async () => {
    outDir = join(tmpdir(), `ssg-llms-test-${Date.now()}`);
  });

  afterEach(async () => {
    try {
      await rm(outDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("should have correct plugin metadata", () => {
    const plugin = llms({ title: "Test" });

    expect(plugin.name).toBe("llms");
    expect(plugin.enforce).toBe("post");
  });

  it("should generate llms.txt and llms-full.txt", async () => {
    const plugin = llms({
      title: "Test Project",
      description: "A test project",
      sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({ docs: [mockEntry()] });
    await plugin.buildEnd!(mockBuildResult, ssg);

    const llmsTxt = await readFile(join(outDir, "llms.txt"), "utf-8");
    expect(llmsTxt).toContain("# Test Project");
    expect(llmsTxt).toContain("> A test project");
    expect(llmsTxt).toContain("## Docs");
    expect(llmsTxt).toContain("- [Getting Started](/docs/getting-started): Learn the basics");

    const llmsFullTxt = await readFile(join(outDir, "llms-full.txt"), "utf-8");
    expect(llmsFullTxt).toContain("# Test Project");
    expect(llmsFullTxt).toContain("### Getting Started");
    expect(llmsFullTxt).toContain("## Installation");
  });

  it("should generate per-entry .md files", async () => {
    const plugin = llms({
      title: "Test Project",
      sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({ docs: [mockEntry()] });
    await plugin.buildEnd!(mockBuildResult, ssg);

    const mdFile = await readFile(join(outDir, "docs", "getting-started.md"), "utf-8");
    expect(mdFile).toContain("# Getting Started");
    expect(mdFile).toContain("> Learn the basics");
    expect(mdFile).toContain("## Installation");
  });

  it("should respect llmsTxt: false", async () => {
    const plugin = llms({
      title: "Test",
      llmsTxt: false,
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({});
    await plugin.buildEnd!(mockBuildResult, ssg);

    await expect(readFile(join(outDir, "llms.txt"), "utf-8")).rejects.toThrow();
  });

  it("should respect llmsFullTxt: false", async () => {
    const plugin = llms({
      title: "Test",
      llmsFullTxt: false,
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({});
    await plugin.buildEnd!(mockBuildResult, ssg);

    await expect(readFile(join(outDir, "llms-full.txt"), "utf-8")).rejects.toThrow();
  });

  it("should respect markdownPages: false", async () => {
    const plugin = llms({
      title: "Test",
      sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
      markdownPages: false,
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({ docs: [mockEntry()] });
    await plugin.buildEnd!(mockBuildResult, ssg);

    await expect(readFile(join(outDir, "docs", "getting-started.md"), "utf-8")).rejects.toThrow();
  });

  it("should handle missing collections gracefully", async () => {
    const plugin = llms({
      title: "Test",
      sections: [{ title: "Docs", collection: "nonexistent", basePath: "/docs" }],
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({});
    // Should not throw
    await plugin.buildEnd!(mockBuildResult, ssg);

    const llmsTxt = await readFile(join(outDir, "llms.txt"), "utf-8");
    expect(llmsTxt).toContain("# Test");
    // Should not contain the section since collection was empty
    expect(llmsTxt).not.toContain("## Docs");
  });

  it("should generate files with absolute URLs when url is set", async () => {
    const plugin = llms({
      title: "Test",
      url: "https://example.com",
      sections: [{ title: "Docs", collection: "docs", basePath: "/docs" }],
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({ docs: [mockEntry()] });
    await plugin.buildEnd!(mockBuildResult, ssg);

    const llmsTxt = await readFile(join(outDir, "llms.txt"), "utf-8");
    expect(llmsTxt).toContain("https://example.com/docs/getting-started");
  });

  it("should generate multiple sections and optional links", async () => {
    const plugin = llms({
      title: "Full Site",
      description: "Everything",
      sections: [
        { title: "Docs", collection: "docs", basePath: "/docs" },
        { title: "Blog", collection: "blog", basePath: "/blog" },
      ],
      links: [{ title: "GitHub", url: "https://github.com/test", description: "Source code" }],
    });

    const config = { outDir } as SSGConfig;
    plugin.configResolved!(config);

    const ssg = mockSSG({
      docs: [mockEntry()],
      blog: [
        mockEntry({
          id: "post-1",
          slug: "first-post",
          data: { title: "First Post" },
          body: "Hello world!",
        }),
      ],
    });

    await plugin.buildEnd!(mockBuildResult, ssg);

    const llmsTxt = await readFile(join(outDir, "llms.txt"), "utf-8");
    expect(llmsTxt).toContain("## Docs");
    expect(llmsTxt).toContain("## Blog");
    expect(llmsTxt).toContain("## Optional");
    expect(llmsTxt).toContain("[GitHub](https://github.com/test): Source code");
    expect(llmsTxt).toContain("/blog/first-post");

    // Both .md files should exist
    const docMd = await readFile(join(outDir, "docs", "getting-started.md"), "utf-8");
    expect(docMd).toContain("# Getting Started");

    const blogMd = await readFile(join(outDir, "blog", "first-post.md"), "utf-8");
    expect(blogMd).toContain("# First Post");
    expect(blogMd).toContain("Hello world!");
  });
});
