/** @jsxImportSource semajsx/prompt */

import type { JSXNode } from "semajsx";
import { renderToString } from "semajsx/prompt";

export type PromptSectionNode = JSXNode;

export function renderPromptDocument(sections: PromptSectionNode[]): string {
  const nodes: JSXNode[] = [];

  for (let index = 0; index < sections.length; index++) {
    const section = sections[index];
    if (!section) continue;
    if (nodes.length > 0) {
      nodes.push(<separator key={`sep.${index}`} />);
    }
    nodes.push(section);
  }

  return renderToString(<>{nodes}</>);
}
