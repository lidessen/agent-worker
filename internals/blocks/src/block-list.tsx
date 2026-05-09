/** @jsxImportSource @semajsx/dom */

import type { JSXNode } from "@semajsx/core";
import { BlockView } from "./block-view";
import type { Block, BlockRegistry, ClassValue } from "./types";

/** Renders an array of blocks using the given registry. */
export function BlockList(props: {
  registry: BlockRegistry;
  blocks: Block[];
  class?: ClassValue;
}): JSXNode {
  const { registry, blocks } = props;

  return (
    <div>
      {blocks.map((block) => (
        <BlockView
          key={block.id ?? `${block.type}-${blocks.indexOf(block)}`}
          registry={registry}
          block={block}
          class={props.class}
        />
      ))}
    </div>
  );
}
