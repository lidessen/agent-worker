/** @jsxImportSource @semajsx/dom */

import type { JSXNode } from "@semajsx/core";
import { classes, rule } from "@semajsx/style";
import type { ClassValue } from "../types";

const c = classes(["root", "code", "codeBlock", "blockquote"] as const);

export const textStyles = {
  root: rule`${c.root} {
    white-space: pre-wrap;
    line-height: 1.6;
  }`,
  code: rule`${c.code} {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.85em;
    padding: 1px 4px;
    border-radius: 3px;
  }`,
  codeBlock: rule`${c.codeBlock} {
    display: block;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.875em;
    padding: 12px;
    border-radius: 6px;
    margin: 8px 0;
    overflow-x: auto;
    white-space: pre;
    line-height: 1.4;
  }`,
  blockquote: rule`${c.blockquote} {
    border-left: 3px solid currentColor;
    padding-left: 12px;
    opacity: 0.7;
    margin: 8px 0;
    font-style: italic;
  }`,
};

export interface TextBlockData {
  text: string;
}

/**
 * Minimal markdown-to-HTML renderer.
 * Handles: fenced code blocks, inline code, bold, italic, blockquotes.
 */
function renderMarkdown(text: string): string {
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Fenced code blocks: ```lang\ncode\n```
  html = html.replace(
    /```(?:\w*)\n([\s\S]*?)```/g,
    (_match, code) =>
      `<pre class="${textStyles.codeBlock}"><code>${code.replace(/\n$/, "")}</code></pre>`,
  );

  // Inline code: `code`
  html = html.replace(
    /`([^`\n]+)`/g,
    (_match, code) => `<code class="${textStyles.code}">${code}</code>`,
  );

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *text* (but not inside **)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Blockquotes: > text (at start of line)
  html = html.replace(/^&gt; (.+)$/gm, `<div class="${textStyles.blockquote}">$1</div>`);

  return html;
}

/** Generic text/markdown block renderer. */
export function TextRenderer(props: { data: TextBlockData; class?: ClassValue }): JSXNode {
  const { text } = props.data;

  const hasMarkdown =
    text.includes("```") ||
    text.includes("`") ||
    text.includes("**") ||
    text.includes("*") ||
    /^> /m.test(text);

  if (hasMarkdown) {
    const el = document.createElement("div");
    el.className = String(textStyles.root);
    if (props.class) el.className += ` ${props.class}`;
    el.innerHTML = renderMarkdown(text);
    return el as unknown as JSXNode;
  }

  return <div class={[textStyles.root, props.class]}>{text}</div>;
}
