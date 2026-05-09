import type { Component, VNode, JSXNode } from "@semajsx/core";
import type { CollectionSource, CollectionEntry } from "../../types";
import type { LucidePluginOptions } from "../lucide/index";
import type { LlmsLink } from "../llms/types";

// =============================================================================
// Home Page Customization
// =============================================================================

/** Layout component exposed to custom home page functions */
export type LayoutComponent = (props: { children: JSXNode }) => VNode;

/** Props passed to a custom home page component */
export interface HomePageProps {
  /** Theme Layout component (nav + footer wrapper) */
  Layout: LayoutComponent;
  /** All docs entries (empty array if docs not configured) */
  docs: CollectionEntry[];
  /** All guides entries (empty array if guides not configured) */
  guides: CollectionEntry[];
}

/**
 * Home page configuration.
 *
 * - `false` — disable the homepage route entirely
 * - `"docs-index"` — render a minimal document index instead of the marketing page
 * - `(props: HomePageProps) => VNode` — custom component for full control
 */
export type HomeOption = false | "docs-index" | ((props: HomePageProps) => VNode);

// =============================================================================
// Navigation
// =============================================================================

export interface NavLink {
  /** Display label */
  label: string;
  /** URL path or external URL */
  href: string;
  /** Opens in new tab */
  external?: boolean;
}

// =============================================================================
// Home Page Sections
// =============================================================================

export interface HeroAction {
  /** Button label */
  label: string;
  /** Link URL */
  href: string;
  /** Use primary (filled) button style */
  primary?: boolean;
}

export interface FeatureItem {
  /** Lucide icon name in kebab-case (e.g., "zap", "package", "shield-check") */
  icon: string;
  /** Feature title */
  title: string;
  /** Feature description */
  description: string;
}

export interface QuickLinkItem {
  /** Card title */
  title: string;
  /** Card description */
  description: string;
  /** Link URL */
  href: string;
}

// =============================================================================
// Content Sections
// =============================================================================

export interface DocsConfig {
  /** Content source for docs */
  source: CollectionSource<unknown>;
  /** URL base path (default: "/docs") */
  basePath?: string;
  /** Index page heading (default: "Documentation") */
  heading?: string;
  /** Index page description */
  description?: string;
}

export interface GuidesConfig {
  /** Content source for guides */
  source: CollectionSource<unknown>;
  /** URL base path (default: "/guides") */
  basePath?: string;
  /** Index page heading (default: "Guides") */
  heading?: string;
  /** Index page description */
  description?: string;
}

export interface UIConfig {
  /** Content source for UI component docs */
  source: CollectionSource<unknown>;
  /** URL base path (default: "/ui") */
  basePath?: string;
  /** Index page heading (default: "Components") */
  heading?: string;
  /** Index page description */
  description?: string;
}

// =============================================================================
// Theme Options
// =============================================================================

export interface DocsThemeOptions {
  /** Site title (used in <title> tags and footer copyright) */
  title: string;

  /** Site description for meta tags */
  description?: string;

  /** Navigation bar configuration */
  nav: {
    /** Logo text displayed in the nav bar */
    logo: string;
    /** Navigation links */
    links: NavLink[];
  };

  /**
   * Home page configuration.
   *
   * - Omit or leave `undefined` for the default marketing homepage (hero, features, quickLinks)
   * - `false` to disable the homepage route entirely
   * - `"docs-index"` for a minimal document listing page
   * - A component function `(props: HomePageProps) => VNode` for full control
   *
   * @example
   * ```tsx
   * // Disable homepage
   * docsTheme({ home: false, ... })
   *
   * // Minimal docs index
   * docsTheme({ home: "docs-index", ... })
   *
   * // Custom homepage
   * docsTheme({
   *   home: ({ Layout, docs }) => (
   *     <Layout>
   *       <h1>Welcome</h1>
   *       <ul>{docs.map(d => <li>{d.data.title}</li>)}</ul>
   *     </Layout>
   *   ),
   *   ...
   * })
   * ```
   */
  home?: HomeOption;

  /** Home page hero section (omit to skip hero) */
  hero?: {
    /** Hero heading text */
    title: string;
    /** Hero subtitle text */
    subtitle: string;
    /** Call-to-action buttons */
    actions?: HeroAction[];
  };

  /** Home page features section (omit to skip features) */
  features?: {
    /** Section heading */
    title: string;
    /** Section subtitle */
    subtitle: string;
    /** Feature cards */
    items: FeatureItem[];
  };

  /** Home page quick links section (omit to skip) */
  quickLinks?: {
    /** Section heading */
    title: string;
    /** Section subtitle */
    subtitle: string;
    /** Link cards */
    items: QuickLinkItem[];
  };

  /** Footer configuration */
  footer?: {
    /** Footer links */
    links?: NavLink[];
    /** Copyright holder name (year is auto-generated) */
    copyright?: string;
  };

  /** Docs collection (omit to disable docs section) */
  docs?: DocsConfig;

  /** Guides collection (omit to disable guides section) */
  guides?: GuidesConfig;

  /** UI components showcase (omit to disable UI section) */
  ui?: UIConfig;

  /** Additional MDX plugins and components */
  mdx?: {
    remarkPlugins?: unknown[];
    rehypePlugins?: unknown[];
    /** Extra MDX components (merged with theme defaults) */
    components?: Record<string, Component>;
  };

  /** Lucide icon plugin options. Set to `false` to disable. Enabled by default. */
  lucide?: LucidePluginOptions | false;

  /**
   * LLMs plugin options (llms.txt). Set to `false` to disable.
   * Enabled by default when docs or guides are configured.
   *
   * Sections are auto-derived from docs/guides collections.
   * Pass an object to customize URL, additional links, or toggle individual outputs.
   */
  llms?: LlmsThemeOptions | false;
}

/**
 * Options for the llms plugin when used within docs-theme.
 * Title, description, and sections are auto-derived from the theme config.
 */
export interface LlmsThemeOptions {
  /** Site base URL for absolute links (e.g., "https://docs.example.com") */
  url?: string;
  /** Additional links for the "Optional" section of llms.txt */
  links?: LlmsLink[];
  /** Generate llms.txt (default: true) */
  llmsTxt?: boolean;
  /** Generate llms-full.txt (default: true) */
  llmsFullTxt?: boolean;
  /** Generate per-entry .md files (default: true) */
  markdownPages?: boolean;
}
