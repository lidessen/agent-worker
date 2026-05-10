/** @jsxImportSource @semajsx/dom */

import type { JSXNode } from "@semajsx/core";
import { classes, rule } from "@semajsx/style";
import type { ClassValue } from "../types";

const c = classes(["root", "type", "data"] as const);

export const fallbackStyles = {
  root: rule`${c.root} {
    padding: 8px 12px;
    border-radius: 6px;
    margin: 8px 0;
    opacity: 0.6;
    font-size: 0.875em;
  }`,
  type: rule`${c.type} {
    font-weight: 600;
    margin-bottom: 4px;
  }`,
  data: rule`${c.data} {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.85em;
    white-space: pre-wrap;
    word-break: break-all;
  }`,
};

export interface FallbackBlockData {
  type: string;
  data: unknown;
}

/** Default renderer for unknown block types — shows type + JSON data. */
export function FallbackRenderer(props: { data: FallbackBlockData; class?: ClassValue }): JSXNode {
  const { type, data } = props.data;

  return (
    <div class={[fallbackStyles.root, props.class]}>
      <div class={fallbackStyles.type}>Unknown block: {type}</div>
      <pre class={fallbackStyles.data}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
