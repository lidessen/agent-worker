import { ISLAND_MARKER, type Component, type JSXNode, type VNode } from "@semajsx/core";
import type { IslandMarker } from "../shared/types";

/**
 * Symbol markers for resource types
 */
export const STYLE_MARKER: symbol = Symbol.for("semajsx.style");
export const LINK_MARKER: symbol = Symbol.for("semajsx.link");
export const ASSET_MARKER: symbol = Symbol.for("semajsx.asset");

/**
 * Style component props
 */
export interface StyleProps {
  href: string;
}

/**
 * Link component props
 */
export interface LinkProps {
  href: string;
  rel?: string;
  as?: string;
}

/**
 * Asset component props
 */
export interface AssetProps {
  src: string;
  type?: "image" | "font" | "script";
}

/**
 * Resource tools returned by resource()
 */
export interface ResourceTools {
  /** CSS stylesheet declaration */
  Style: (props: StyleProps) => VNode;
  /** External resource link */
  Link: (props: LinkProps) => VNode;
  /** Static asset declaration */
  Asset: (props: AssetProps) => VNode;
  /** Resolve relative path to absolute */
  url: (path: string) => string;
  /** Create an island component */
  island: <T extends Component<any>>(component: T, name?: string) => T;
}

/**
 * Create resource tools bound to a module path
 *
 * @param baseUrl - The module URL (use import.meta.url)
 * @returns Resource tools with resolved paths
 *
 * @example
 * ```tsx
 * import { resource } from '@semajsx/ssr';
 *
 * const { Style, Link, Asset, url, island } = resource(import.meta.url);
 *
 * export default function Page() {
 *   return (
 *     <>
 *       <Style href="./page.css" />
 *       <img src={url('./hero.png')} />
 *       <Counter />
 *     </>
 *   );
 * }
 *
 * const Counter = island(function Counter({ initial = 0 }) {
 *   return <button>{initial}</button>;
 * });
 * ```
 */
export function resource(baseUrl: string): ResourceTools {
  /**
   * Resolve a relative path against the base URL
   */
  const resolve = (href: string): string => {
    if (href.startsWith("./") || href.startsWith("../")) {
      const url = new URL(href, baseUrl);
      return url.pathname + url.search + url.hash;
    }
    return href;
  };

  return {
    Style({ href }: StyleProps): VNode {
      return {
        type: STYLE_MARKER as unknown as string,
        props: { href: resolve(href) },
        children: [],
      };
    },

    Link({ href, rel = "stylesheet", as: asType }: LinkProps): VNode {
      return {
        type: LINK_MARKER as unknown as string,
        props: { href: resolve(href), rel, as: asType },
        children: [],
      };
    },

    Asset({ src, type = "image" }: AssetProps): VNode {
      return {
        type: ASSET_MARKER as unknown as string,
        props: { src: resolve(src), type },
        children: [],
      };
    },

    url(path: string): string {
      return resolve(path);
    },

    island<T extends Component<any>>(component: T, name?: string): T {
      const componentName = name || component.name || "Anonymous";

      const wrappedComponent = ((props: Record<string, unknown>): JSXNode => {
        const vnode: VNode & { [ISLAND_MARKER]?: IslandMarker } = {
          type: component,
          props: props || {},
          children: [],
          [ISLAND_MARKER]: {
            modulePath: baseUrl,
            component,
            props,
          },
        };

        return vnode;
      }) as T;

      // Mark the wrapper function for static analysis
      (wrappedComponent as Record<symbol, unknown>)[ISLAND_MARKER] = {
        modulePath: baseUrl,
        component,
      };

      // Preserve component name
      Object.defineProperty(wrappedComponent, "name", {
        value: componentName,
        configurable: true,
      });

      return wrappedComponent;
    },
  };
}

/**
 * Check if a VNode is a Style resource
 */
export function isStyleVNode(vnode: VNode): boolean {
  return vnode.type === STYLE_MARKER;
}

/**
 * Check if a VNode is a Link resource
 */
export function isLinkVNode(vnode: VNode): boolean {
  return vnode.type === LINK_MARKER;
}

/**
 * Check if a VNode is an Asset resource
 */
export function isAssetVNode(vnode: VNode): boolean {
  return vnode.type === ASSET_MARKER;
}
