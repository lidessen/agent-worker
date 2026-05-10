/** @jsxImportSource @semajsx/dom */

import type { JSXNode } from "@semajsx/core";
import type { Block, BlockRegistry, ClassValue } from "./types";

/** Renders a single block by looking up its renderer in the registry. */
export function BlockView(props: {
  registry: BlockRegistry;
  block: Block;
  class?: ClassValue;
}): JSXNode {
  const { registry, block } = props;
  const renderer = registry.get(block.type);

  if (!renderer) {
    return (
      <div data-block-type={block.type} style="opacity:0.6;font-style:italic">
        Unknown block: {block.type}
      </div>
    );
  }

  return <>{renderer({ data: block.data, class: props.class })}</>;
}
