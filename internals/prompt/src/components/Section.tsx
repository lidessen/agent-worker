/** @jsxImportSource @semajsx/prompt */

import type { JSXNode } from "@semajsx/core";
import type { SignalOr } from "@semajsx/core";

export interface SectionProps {
  title: SignalOr<string>;
  viewport?: SignalOr<string>;
  children?: JSXNode;
}

/**
 * Section component - a named content block
 *
 * @example
 * <Section title="AWARENESS">
 *   <item>Prioritize unread messages</item>
 *   <item>Only visible content is guaranteed</item>
 * </Section>
 * // [AWARENESS]
 * // - Prioritize unread messages
 * // - Only visible content is guaranteed
 */
export function Section(props: SectionProps): JSXNode {
  const { title, viewport, children } = props;
  return (
    <section title={title} viewport={viewport}>
      {children}
    </section>
  );
}
