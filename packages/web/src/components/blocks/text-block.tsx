/** @jsxImportSource semajsx/dom */

import { inject } from "semajsx/style";
import type { DaemonEvent } from "../../api/types.ts";
import * as styles from "./text-block.style.ts";

// Eagerly inject CSS for styles used in innerHTML (not via JSX class prop)
inject([styles.codeBlock, styles.code, styles.blockquote]);

/**
 * Minimal markdown-to-HTML renderer.
 * Handles: fenced code blocks, inline code, bold, italic, blockquotes.
 * No external library — just regex replacements.
 */
function renderMarkdown(text: string): string {
  // Escape HTML entities first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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
  html = html.replace(
    /^&gt; (.+)$/gm,
    `<div class="${styles.blockquote}">$1</div>`,
  );

  return html;
}

export function TextBlock(props: { event: DaemonEvent }) {
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
