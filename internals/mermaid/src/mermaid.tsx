/** @jsxImportSource @semajsx/dom */
import type { JSXNode } from "@semajsx/core";
import { unwrap } from "@semajsx/signal";
import { parse } from "./parser";
import { Flowchart } from "./flowchart";
import { Sequence } from "./sequence";
import type { MermaidProps } from "./types";

export function Mermaid(props: MermaidProps): JSXNode {
  const code = unwrap(props.code);
  const diagram = parse(code);

  if ("message" in diagram) {
    props.onError?.(diagram);
    return null;
  }

  if (diagram.type === "flowchart") {
    return <Flowchart graph={diagram} class={props.class} />;
  }

  if (diagram.type === "sequence") {
    return <Sequence graph={diagram} class={props.class} />;
  }

  return null;
}
