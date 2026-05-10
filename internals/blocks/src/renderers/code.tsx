/** @jsxImportSource @semajsx/dom */

import type { JSXNode } from "@semajsx/core";
import { classes, rule } from "@semajsx/style";
import type { ClassValue } from "../types";

const c = classes(["root", "header", "lang", "pre"] as const);

export const codeStyles = {
  root: rule`${c.root} {
    position: relative;
    margin: 8px 0;
  }`,
  header: rule`${c.header} {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 12px;
    font-size: 0.75em;
    opacity: 0.7;
  }`,
  lang: rule`${c.lang} {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }`,
  pre: rule`${c.pre} {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.875em;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    white-space: pre;
    line-height: 1.4;
    margin: 0;
  }`,
};

export interface CodeBlockData {
  code: string;
  language?: string;
}

/** Code block renderer with optional language label. */
export function CodeRenderer(props: { data: CodeBlockData; class?: ClassValue }): JSXNode {
  const { code, language } = props.data;

  return (
    <div class={[codeStyles.root, props.class]}>
      {language && (
        <div class={codeStyles.header}>
          <span class={codeStyles.lang}>{language}</span>
        </div>
      )}
      <pre class={codeStyles.pre}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
