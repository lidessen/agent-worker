/** @jsxImportSource @semajsx/prompt */

import type { JSXNode } from "@semajsx/core";
import type { SignalOr } from "@semajsx/core";

export interface ScreenProps {
  name?: SignalOr<string>;
  time?: SignalOr<string>;
  event?: SignalOr<string>;
  focus?: SignalOr<string>;
  children?: JSXNode;
}

/**
 * Screen component - top-level wrapper for a prompt screen
 *
 * Renders a header block followed by children sections.
 *
 * @example
 * <Screen name="Support Inbox" time="2026-03-12" focus="thread:A">
 *   <Section title="ROLE">
 *     <line>Support Agent</line>
 *   </Section>
 * </Screen>
 */
export function Screen(props: ScreenProps): JSXNode {
  const { name, time, event, focus, children } = props;

  return (
    <>
      <header name={name} time={time} event={event} focus={focus} />
      {children}
    </>
  );
}
