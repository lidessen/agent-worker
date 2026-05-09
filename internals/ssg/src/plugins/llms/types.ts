// =============================================================================
// LLMs Plugin Types
// =============================================================================

/**
 * A section in llms.txt that maps to a collection.
 * Each section becomes an H2 heading with links to collection entries.
 */
export interface LlmsSection {
  /** Section heading in llms.txt (e.g., "Documentation", "Blog") */
  title: string;
  /** Collection name to pull entries from */
  collection: string;
  /** Base URL path for entries (e.g., "/docs", "/blog") */
  basePath: string;
}

/**
 * An additional link to include in llms.txt.
 * Placed in the "Optional" section per the llms.txt spec.
 */
export interface LlmsLink {
  /** Link title */
  title: string;
  /** Link URL (absolute or relative) */
  url: string;
  /** Optional description shown after the link */
  description?: string;
}

/**
 * Configuration options for the llms plugin.
 *
 * @example
 * ```tsx
 * llms({
 *   title: "My Project",
 *   description: "Documentation for My Project",
 *   url: "https://docs.myproject.com",
 *   sections: [
 *     { title: "Documentation", collection: "docs", basePath: "/docs" },
 *     { title: "Blog", collection: "blog", basePath: "/blog" },
 *   ],
 * })
 * ```
 */
export interface LlmsOptions {
  /** Site title — used as H1 in llms.txt (required) */
  title: string;
  /** Site description — rendered as blockquote under the H1 */
  description?: string;
  /** Site base URL for generating absolute links (e.g., "https://docs.example.com") */
  url?: string;
  /** Sections that map to collections */
  sections?: LlmsSection[];
  /** Additional links placed in the "Optional" section of llms.txt */
  links?: LlmsLink[];
  /** Generate llms.txt index file (default: true) */
  llmsTxt?: boolean;
  /** Generate llms-full.txt with complete content (default: true) */
  llmsFullTxt?: boolean;
  /** Generate per-entry .md files alongside HTML pages (default: true) */
  markdownPages?: boolean;
}
