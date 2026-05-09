/**
 * JSX automatic runtime for DOM (development)
 * Use with: @jsxImportSource @semajsx/dom
 */

import { h, ISLAND_MARKER } from "@semajsx/core";

export { Fragment } from "./jsx-runtime";
export type * from "./jsx-runtime";

export function jsxDEV(
  type: any,
  props: any,
  key?: any,
  _isStaticChildren?: boolean,
  _source?: any,
  _self?: any,
): any {
  const { children, ...restProps } = props || {};

  if (key !== undefined) {
    restProps.key = key;
  }

  // Check if this is an island component
  // Island components are functions with ISLAND_MARKER symbol
  if (typeof type === "function" && ISLAND_MARKER in type) {
    // Call the island wrapper directly with all props
    const islandProps = children !== undefined ? { ...restProps, children } : restProps;
    return type(islandProps);
  }

  if (children !== undefined) {
    const childArray = Array.isArray(children) ? children : [children];
    return h(type, restProps, ...childArray);
  }

  return h(type, restProps);
}
