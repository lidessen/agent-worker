/** @jsxImportSource ../../../../vendor/semajsx/packages/semajsx/src/prompt */

import type { JSXNode } from "../../../../vendor/semajsx/packages/semajsx/src/index.ts";
import {
  renderToString,
  Section,
} from "../../../../vendor/semajsx/packages/semajsx/src/prompt/index.ts";

export type PromptBlock =
  | { kind: "line"; text: string; prefix?: string }
  | { kind: "item"; text: string; marker?: string; index?: number }
  | { kind: "field"; label: string; value: string }
  | { kind: "raw"; text: string }
  | { kind: "break" }
  | { kind: "indent"; size?: number; blocks: PromptBlock[] };

export interface PromptSectionNode {
  title: string;
  viewport?: string;
  blocks: PromptBlock[];
}

function renderBlock(block: PromptBlock, key: string): JSXNode {
  switch (block.kind) {
    case "line":
      return (
        <line key={key} prefix={block.prefix}>
          {block.text}
        </line>
      );
    case "item":
      return (
        <item key={key} marker={block.marker} index={block.index}>
          {block.text}
        </item>
      );
    case "field":
      return <field key={key} label={block.label} value={block.value} />;
    case "raw":
      return <raw key={key}>{block.text}</raw>;
    case "break":
      return <br key={key} />;
    case "indent":
      return (
        <indent key={key} size={block.size}>
          {block.blocks.map((child, index) => renderBlock(child, `${key}.${index}`))}
        </indent>
      );
  }
}

function renderSectionNode(section: PromptSectionNode, key: string): JSXNode {
  return (
    <Section key={key} title={section.title} viewport={section.viewport}>
      {section.blocks.map((block, index) => renderBlock(block, `${key}.${index}`))}
    </Section>
  );
}

export function renderPromptDocument(sections: PromptSectionNode[]): string {
  const nodes: JSXNode[] = [];

  for (let index = 0; index < sections.length; index++) {
    if (index > 0) {
      nodes.push(<separator key={`sep.${index}`} />);
    }
    const section = sections[index];
    if (!section) continue;
    nodes.push(renderSectionNode(section, `section.${index}`));
  }

  return renderToString(<>{nodes}</>);
}
