import { ISLAND_MARKER, type Component, type JSXNode, type VNode } from "@semajsx/core";
import type { IslandMarker } from "../shared/types";

/**
 * Mark a component as an Island that should be hydrated on the client
 *
 * @param component - The component function to mark as an island
 * @param modulePath - The module path to the component file (use import.meta.url or relative path)
 * @returns A wrapped component that can be used in SSR
 *
 * @example
 * ```tsx
 * // Using import.meta.url (recommended)
 * export const Counter = island(
 *   function Counter({ initial = 0 }) {
 *     const count = signal(initial)
 *     return <button onClick={() => count.value++}>{count}</button>
 *   },
 *   import.meta.url
 * )
 *
 * // Using relative path
 * export const TodoList = island(
 *   TodoListComponent,
 *   './components/TodoList.tsx'
 * )
 * ```
 */
export function island<T extends Component<any>>(component: T, modulePath: string): T {
  // Create a wrapped component that marks itself as an island
  const wrappedComponent = ((props: any): JSXNode => {
    // Create a VNode with island marker
    const vnode: VNode & { [ISLAND_MARKER]?: IslandMarker } = {
      type: component,
      props: props || {},
      children: [],
      [ISLAND_MARKER]: {
        modulePath,
        component,
        props,
      },
    };

    return vnode;
  }) as T;

  // Also mark the wrapper function itself for static analysis
  (wrappedComponent as any)[ISLAND_MARKER] = {
    modulePath,
    component,
  };

  // Preserve component name for debugging
  Object.defineProperty(wrappedComponent, "name", {
    value: component.name || "IslandComponent",
    configurable: true,
  });

  return wrappedComponent;
}

/**
 * Check if a component is marked as an Island
 */
export function isIslandComponent(component: any): boolean {
  return component && ISLAND_MARKER in component;
}

/**
 * Check if a VNode is an Island instance
 */
export function isIslandVNode(vnode: VNode): vnode is VNode & {
  [ISLAND_MARKER]: IslandMarker;
} {
  return ISLAND_MARKER in vnode;
}

/**
 * Get island metadata from a VNode
 */
export function getIslandMetadata(vnode: VNode): IslandMarker | undefined {
  if (isIslandVNode(vnode)) {
    return vnode[ISLAND_MARKER];
  }
  return undefined;
}
