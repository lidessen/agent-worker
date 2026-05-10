import type { BlockRegistry, BlockRenderer } from "./types";

/**
 * Create a new block registry.
 * Each consumer should create their own registry — this is NOT a singleton.
 */
export function createRegistry(): BlockRegistry {
  const renderers = new Map<string, BlockRenderer>();

  return {
    register<D>(type: string, renderer: BlockRenderer<D>): void {
      renderers.set(type, renderer as BlockRenderer);
    },

    get(type: string): BlockRenderer | undefined {
      return renderers.get(type);
    },

    has(type: string): boolean {
      return renderers.has(type);
    },
  };
}
