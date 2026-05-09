/**
 * Virtual modules plugin for Vite
 *
 * Allows build entries to be virtual (in-memory) instead of on disk.
 */

import { resolve, dirname } from "path";
import type { Plugin } from "vite";

export interface VirtualModulesOptions {
  [id: string]: string;
}

/**
 * Create a Vite plugin for virtual modules
 */
export function virtualModules(modules: VirtualModulesOptions): Plugin {
  // Map to store resolved paths (will be built in configResolved)
  const resolvedIds = new Map<string, string>();

  // Find module content by trying multiple id variations
  function find(id: string): string | undefined {
    return (
      modules[id] || modules[id.replace(/^\//, "")] || modules[`/${id}`] || resolvedIds.get(id)
    );
  }

  let viteRoot = process.cwd();

  return {
    name: "semajsx-virtual-modules",
    enforce: "pre",

    configResolved(config) {
      viteRoot = config.root;

      // Build resolvedIds with the correct root
      Object.keys(modules).forEach((id) => {
        const resolved = resolve(viteRoot, id);
        resolvedIds.set(resolved, modules[id]!);
      });
    },

    resolveId(id, importer) {
      // Direct match or variations
      const content = find(id);
      if (content) {
        // Return resolved absolute path relative to Vite root
        return resolve(viteRoot, id);
      }

      // Try resolving relative imports from importer first
      if (importer) {
        const abs = resolve(dirname(importer), id);
        if (resolvedIds.has(abs)) {
          return abs;
        }
      }

      // For bare specifiers (not starting with /, ./, or ../),
      // try resolving against viteRoot
      if (!id.startsWith("/") && !id.startsWith("./") && !id.startsWith("../")) {
        const absoluteId = resolve(viteRoot, id);
        if (modules[absoluteId] || resolvedIds.has(absoluteId)) {
          return absoluteId;
        }
      }

      return null;
    },

    load(id) {
      // First try direct find
      let content = find(id);
      if (content) {
        return content;
      }

      // Try finding by the resolved path
      if (resolvedIds.has(id)) {
        return resolvedIds.get(id);
      }

      return null;
    },
  };
}
