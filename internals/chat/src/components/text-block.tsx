/** @jsxImportSource @semajsx/dom */

import type { ChatEvent } from "../types";
import * as styles from "./text-block.style";

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
      `<pre class="${styles.codeBlock}"><code>${code.replace(/\n$/, "")}</code></pre>`,
  );

  // Inline code: `code`
  html = html.replace(
    /`([^`\n]+)`/g,
    (_match, code) => `<code class="${styles.code}">${code}</code>`,
  );

  // Bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic: *text* (but not inside **)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");

  // Blockquotes: > text (at start of line)
  html = html.replace(/^&gt; (.+)$/gm, `<div class="${styles.blockquote}">$1</div>`);

  return html;
}

export function TextBlock(props: { event: ChatEvent }) {
  const text = (props.event.text as string) ?? (props.event.content as string) ?? "";

  const hasMarkdown =
    text.includes("```") ||
    text.includes("`") ||
    text.includes("**") ||
    text.includes("*") ||
    /^> /m.test(text);

  if (hasMarkdown) {
    return (
      <div
        class={styles.block}
        ref={(el: HTMLDivElement | null) => {
          if (!el) return;
          el.innerHTML = renderMarkdown(text);
        }}
      />
    );
  }

  return <div class={styles.block}>{text}</div>;
}
