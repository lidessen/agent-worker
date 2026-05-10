/**
 * Client-side resource utilities for dynamic CSS and asset loading
 */

/**
 * Client manifest structure
 */
export interface ClientManifest {
  css: Record<string, string>;
  assets: Record<string, string>;
}

// Global manifest storage
let _manifest: ClientManifest | null = null;

// Track loaded stylesheets to avoid duplicates
const loadedStyles = new Set<string>();

/**
 * Set the client manifest (called during initialization)
 */
export function setManifest(manifest: ClientManifest): void {
  _manifest = manifest;
}

/**
 * Get the current manifest
 */
export function getManifest(): ClientManifest | null {
  return _manifest;
}

/**
 * Resolve a CSS path using the manifest
 */
export function resolveCSS(href: string): string {
  if (!_manifest) {
    return href;
  }

  // Try to find in manifest (remove leading slash for lookup)
  const lookupPath = href.startsWith("/") ? href.slice(1) : href;
  return _manifest.css[lookupPath] || href;
}

/**
 * Resolve an asset path using the manifest
 */
export function resolveAsset(src: string): string {
  if (!_manifest) {
    return src;
  }

  // Try to find in manifest (remove leading slash for lookup)
  const lookupPath = src.startsWith("/") ? src.slice(1) : src;
  return _manifest.assets[lookupPath] || src;
}

/**
 * Dynamically load a stylesheet
 */
export function loadStylesheet(href: string): Promise<void> {
  const resolvedHref = resolveCSS(href);

  // Skip if already loaded
  if (loadedStyles.has(resolvedHref)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Check if already in document
    const existing = document.querySelector(`link[href="${resolvedHref}"]`);
    if (existing) {
      loadedStyles.add(resolvedHref);
      resolve();
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = resolvedHref;

    link.onload = () => {
      loadedStyles.add(resolvedHref);
      resolve();
    };

    link.onerror = () => {
      reject(new Error(`Failed to load stylesheet: ${resolvedHref}`));
    };

    document.head.appendChild(link);
  });
}

/**
 * Style component props
 */
export interface StyleProps {
  href: string;
}

/**
 * Asset component props
 */
export interface AssetProps {
  src: string;
}

/**
 * Client-side resource tools
 */
export interface ClientResourceTools {
  /** Load and inject a CSS stylesheet */
  Style: (props: StyleProps) => null;
  /** Resolve asset URL from manifest */
  url: (path: string) => string;
}

/**
 * Create client-side resource tools
 *
 * @example
 * ```tsx
 * import { clientResource } from '@semajsx/ssr/client';
 *
 * const { Style, url } = clientResource();
 *
 * export default function Counter() {
 *   return (
 *     <>
 *       <Style href="./counter.css" />
 *       <img src={url('./icon.png')} />
 *     </>
 *   );
 * }
 * ```
 */
export function clientResource(): ClientResourceTools {
  return {
    Style({ href }: StyleProps): null {
      // Load stylesheet on mount
      if (typeof document !== "undefined") {
        loadStylesheet(href);
      }
      return null;
    },

    url(path: string): string {
      return resolveAsset(path);
    },
  };
}
