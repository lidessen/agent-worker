import type { VNode } from "@semajsx/core";
import type { IslandMetadata } from "./shared/types";
import { isIslandVNode, getIslandMetadata } from "./client/island";
import { Fragment, createComponentAPI } from "@semajsx/core";
import type { ContextMap } from "@semajsx/core";

/**
 * Island collector - traverses VNode tree and collects island metadata
 */
export class IslandCollector {
  private islands: IslandMetadata[] = [];
  private counter = 0;

  /**
   * Collect all islands from a VNode tree
   */
  collect(vnode: VNode): IslandMetadata[] {
    this.islands = [];
    this.counter = 0;
    this.traverse(vnode, new Map());
    return this.islands;
  }

  /**
   * Traverse VNode tree and collect islands
   */
  private traverse(vnode: VNode | null | undefined, parentContext: ContextMap): void {
    if (!vnode) return;

    // Check if this VNode is an island
    if (isIslandVNode(vnode)) {
      const metadata = getIslandMetadata(vnode);
      if (metadata) {
        this.islands.push({
          id: `island-${this.counter++}`,
          path: metadata.modulePath,
          props: this.serializeProps(metadata.props),
          componentName: typeof vnode.type === "function" ? vnode.type.name : undefined,
        });
      }
      // Don't traverse into island children - they will be rendered on client
      return;
    }

    // Handle fragments
    if (vnode.type === Fragment) {
      for (const child of vnode.children) {
        this.traverse(child, parentContext);
      }
      return;
    }

    // Handle function components - need to render them first
    if (typeof vnode.type === "function") {
      try {
        const props =
          vnode.children && vnode.children.length > 0
            ? { ...vnode.props, children: vnode.children }
            : vnode.props || {};
        const currentContext = resolveComponentContext(vnode.type, props, parentContext);
        const result = vnode.type(props, createComponentAPI(currentContext));
        // If result is a VNode, traverse it
        if (result && typeof result === "object" && "type" in result) {
          this.traverse(result as VNode, currentContext);
        }
      } catch (error) {
        console.warn("Error rendering component during collection:", error);
      }
      return;
    }

    // Traverse children
    if (vnode.children && Array.isArray(vnode.children)) {
      for (const child of vnode.children) {
        this.traverse(child, parentContext);
      }
    }
  }

  /**
   * Serialize props for client-side hydration
   * Handles common types and warns about non-serializable values
   */
  private serializeProps(props: any): Record<string, any> {
    if (!props || typeof props !== "object") {
      return {};
    }

    const serialized: Record<string, any> = {};

    for (const [key, value] of Object.entries(props)) {
      // Skip functions (event handlers, callbacks)
      if (typeof value === "function") {
        continue;
      }

      // Skip symbols
      if (typeof value === "symbol") {
        continue;
      }

      // Skip undefined
      if (value === undefined) {
        continue;
      }

      // Handle null, boolean, number, string
      if (
        value === null ||
        typeof value === "boolean" ||
        typeof value === "number" ||
        typeof value === "string"
      ) {
        serialized[key] = value;
        continue;
      }

      // Handle arrays and plain objects
      if (Array.isArray(value) || isPlainObject(value)) {
        try {
          // Test if it's JSON-serializable
          JSON.stringify(value);
          serialized[key] = value;
        } catch (error) {
          console.warn(`Cannot serialize prop "${key}":`, error);
        }
        continue;
      }

      console.warn(`Skipping non-serializable prop "${key}" of type ${typeof value}`);
    }

    return serialized;
  }
}

function resolveComponentContext(
  component: Function,
  props: Record<string, any>,
  parentContext: ContextMap,
): ContextMap {
  const isContextProvider = (component as any).__isContextProvider;
  if (!isContextProvider) {
    return parentContext;
  }

  const currentContext = new Map(parentContext);
  const provide = (props as any).provide;
  if (!provide) {
    return currentContext;
  }

  const isSingle = provide.length === 2 && typeof provide[0] === "symbol";
  if (isSingle) {
    const [context, value] = provide;
    currentContext.set(context, value);
    return currentContext;
  }

  for (const [context, value] of provide) {
    currentContext.set(context, value);
  }
  return currentContext;
}

/**
 * Check if a value is a plain object
 */
function isPlainObject(value: any): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Create a new island collector
 */
export function createIslandCollector(): IslandCollector {
  return new IslandCollector();
}
