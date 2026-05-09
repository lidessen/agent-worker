/**
 * JSX automatic runtime for Terminal (development)
 * Use with: @jsxImportSource @semajsx/terminal
 */

import { h } from "@semajsx/core";

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

  if (children !== undefined) {
    const childArray = Array.isArray(children) ? children : [children];
    return h(type, restProps, ...childArray);
  }

  return h(type, restProps);
}
