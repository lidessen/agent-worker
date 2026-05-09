/** @jsxImportSource @semajsx/dom */

/**
 * CodeBlock component
 *
 * Displays code with a dark theme and optional language header.
 * Also exports `InlineCode` for inline code snippets.
 *
 * @example
 * ```tsx
 * import { CodeBlock, InlineCode } from "@semajsx/ui/code-block";
 *
 * <CodeBlock language="tsx">{`const x = signal(0);`}</CodeBlock>
 * <p>Use <InlineCode>signal()</InlineCode> for reactivity.</p>
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./code-block.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface CodeBlockProps {
  /** Programming language label */
  language?: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Code content (string or pre-highlighted JSX) */
  children?: JSXNode;
}

export interface InlineCodeProps {
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Content */
  children?: JSXNode;
}

export function CodeBlock(props: CodeBlockProps): JSXNode {
  return (
    <div class={[styles.root, props.class]}>
      {props.language && (
        <div class={styles.header}>
          <span class={styles.lang}>{props.language}</span>
        </div>
      )}
      <pre class={styles.pre}>
        <code>{props.children}</code>
      </pre>
    </div>
  );
}

export function InlineCode(props: InlineCodeProps): JSXNode {
  return <code class={[styles.inline, props.class]}>{props.children}</code>;
}
