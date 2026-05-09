/** @jsxImportSource @semajsx/terminal */
import type { JSXNode } from "@semajsx/core";

export interface BlankLineProps {
  /**
   * Number of blank lines to render
   * @default 1
   */
  count?: number;
}

/**
 * BlankLine component - renders one or more empty lines
 *
 * Useful for adding vertical spacing between terminal UI elements.
 *
 * @example
 * ```tsx
 * <box flexDirection="column">
 *   <text>First line</text>
 *   <BlankLine />
 *   <text>After one blank line</text>
 *   <BlankLine count={2} />
 *   <text>After two blank lines</text>
 * </box>
 * ```
 */
export function BlankLine({ count = 1 }: BlankLineProps): JSXNode {
  const lines = Array.from({ length: count }, (_, i) => <text key={i}> </text>);

  return <>{lines}</>;
}
