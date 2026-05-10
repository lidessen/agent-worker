import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import type { SSGConfig, SSGPlugin, SSGInstance, CollectionEntry } from "../../types";
import type { LlmsOptions } from "./types";

export type { LlmsOptions, LlmsSection, LlmsLink } from "./types";

// =============================================================================
// Helpers
// =============================================================================

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function resolveUrl(base: string | undefined, path: string): string {
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path}`;
}

function getEntryTitle(entry: CollectionEntry): string {
  const data = entry.data as Record<string, unknown>;
  return (data.title as string) ?? entry.slug;
}

function getEntryDescription(entry: CollectionEntry): string | undefined {
  const data = entry.data as Record<string, unknown>;
  return data.description as string | undefined;
}

function formatLink(title: string, url: string, description?: string): string {
  return description ? `- [${title}](${url}): ${description}` : `- [${title}](${url})`;
}

// =============================================================================
// llms.txt Generator
// =============================================================================

/**
 * Generate llms.txt content following the llms.txt specification.
 *
 * Format:
 * - H1: site title (required)
 * - Blockquote: site description (optional)
 * - H2 sections: collection entries as markdown links
 * - ## Optional: additional links
 *
 * @see https://llmstxt.org/
 */
function generateLlmsTxt(
  options: LlmsOptions,
  sectionEntries: Map<string, CollectionEntry[]>,
): string {
  const lines: string[] = [];

  lines.push(`# ${options.title}`);
  lines.push("");

  if (options.description) {
    lines.push(`> ${options.description}`);
    lines.push("");
  }

  for (const section of options.sections ?? []) {
    const entries = sectionEntries.get(section.collection) ?? [];
    if (entries.length === 0) continue;

    const basePath = normalizePath(section.basePath);
    lines.push(`## ${section.title}`);
    lines.push("");

    for (const entry of entries) {
      const title = getEntryTitle(entry);
      const url = resolveUrl(options.url, `${basePath}/${entry.slug}`);
      const desc = getEntryDescription(entry);
      lines.push(formatLink(title, url, desc));
    }

    lines.push("");
  }

  if (options.links?.length) {
    lines.push("## Optional");
    lines.push("");
    for (const link of options.links) {
      lines.push(formatLink(link.title, link.url, link.description));
    }
    lines.push("");
  }

  return lines.join("\n");
}

// =============================================================================
// llms-full.txt Generator
// =============================================================================

/**
 * Generate llms-full.txt with complete content for each entry.
 * Includes the full markdown body of every collection entry.
 */
function generateLlmsFullTxt(
  options: LlmsOptions,
  sectionEntries: Map<string, CollectionEntry[]>,
): string {
  const lines: string[] = [];

  lines.push(`# ${options.title}`);
  lines.push("");

  if (options.description) {
    lines.push(`> ${options.description}`);
    lines.push("");
  }

  for (const section of options.sections ?? []) {
    const entries = sectionEntries.get(section.collection) ?? [];
    if (entries.length === 0) continue;

    const basePath = normalizePath(section.basePath);
    lines.push(`## ${section.title}`);
    lines.push("");

    for (const entry of entries) {
      const title = getEntryTitle(entry);
      const url = resolveUrl(options.url, `${basePath}/${entry.slug}`);
      const desc = getEntryDescription(entry);

      lines.push(`### ${title}`);

      if (desc) {
        lines.push("");
        lines.push(`> ${desc}`);
      }

      lines.push("");
      lines.push(`Source: ${url}`);
      lines.push("");
      lines.push(entry.body.trim());
      lines.push("");
      lines.push("---");
      lines.push("");
    }
  }

  return lines.join("\n");
}

// =============================================================================
// Per-Entry Markdown Generator
// =============================================================================

function generateEntryMarkdown(entry: CollectionEntry): string {
  const title = getEntryTitle(entry);
  const desc = getEntryDescription(entry);
  const lines: string[] = [];

  lines.push(`# ${title}`);

  if (desc) {
    lines.push("");
    lines.push(`> ${desc}`);
  }

  lines.push("");
  lines.push(entry.body.trim());
  lines.push("");

  return lines.join("\n");
}

// =============================================================================
// Plugin
// =============================================================================

/**
 * LLMs plugin for SSG.
 *
 * Generates `llms.txt`, `llms-full.txt`, and per-page `.md` files
 * following the llms.txt specification, making your site easily
 * consumable by LLMs and AI agents.
 *
 * @see https://llmstxt.org/
 *
 * @example
 * ```tsx
 * import { createSSG } from "@semajsx/ssg";
 * import { llms } from "@semajsx/ssg/plugins/llms";
 *
 * const ssg = createSSG({
 *   outDir: "./dist",
 *   plugins: [
 *     llms({
 *       title: "My Project",
 *       description: "Documentation for My Project",
 *       url: "https://docs.myproject.com",
 *       sections: [
 *         { title: "Documentation", collection: "docs", basePath: "/docs" },
 *       ],
 *     }),
 *   ],
 * });
 * ```
 */
export function llms(options: LlmsOptions): SSGPlugin {
  let outDir = "";

  return {
    name: "llms",
    enforce: "post",

    configResolved(config: SSGConfig) {
      outDir = config.outDir ?? "./dist";
    },

    async buildEnd(_result, ssg: SSGInstance) {
      const genLlmsTxt = options.llmsTxt !== false;
      const genLlmsFullTxt = options.llmsFullTxt !== false;
      const genMarkdownPages = options.markdownPages !== false;

      // Collect entries for each configured section
      const sectionEntries = new Map<string, CollectionEntry[]>();

      for (const section of options.sections ?? []) {
        try {
          const entries = await ssg.getCollection(section.collection);
          sectionEntries.set(section.collection, entries);
        } catch {
          // Collection not found — skip silently
          sectionEntries.set(section.collection, []);
        }
      }

      await mkdir(outDir, { recursive: true });

      // Generate llms.txt
      if (genLlmsTxt) {
        const content = generateLlmsTxt(options, sectionEntries);
        await writeFile(join(outDir, "llms.txt"), content, "utf-8");
      }

      // Generate llms-full.txt
      if (genLlmsFullTxt) {
        const content = generateLlmsFullTxt(options, sectionEntries);
        await writeFile(join(outDir, "llms-full.txt"), content, "utf-8");
      }

      // Generate per-entry .md files
      if (genMarkdownPages) {
        for (const section of options.sections ?? []) {
          const basePath = normalizePath(section.basePath);
          const entries = sectionEntries.get(section.collection) ?? [];
          for (const entry of entries) {
            const mdPath = `${basePath}/${entry.slug}.md`;
            const fullPath = join(outDir, mdPath.slice(1)); // strip leading /
            const content = generateEntryMarkdown(entry);

            await mkdir(dirname(fullPath), { recursive: true });
            await writeFile(fullPath, content, "utf-8");
          }
        }
      }
    },
  };
}

// Export generators for testing
export { generateLlmsTxt as _generateLlmsTxt, generateLlmsFullTxt as _generateLlmsFullTxt };
