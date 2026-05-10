/** @jsxImportSource @semajsx/dom */

/**
 * Kbd component
 *
 * Displays a keyboard key or shortcut.
 *
 * @example
 * ```tsx
 * import { Kbd } from "@semajsx/ui/components/kbd";
 *
 * <Kbd>Ctrl</Kbd>
 * <p>Press <Kbd>Cmd</Kbd> + <Kbd>K</Kbd> to search</p>
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./kbd.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface KbdProps {
  /** Key label */
  children?: JSXNode;
  /** Additional CSS class(es) */
  class?: ClassValue;
}

export function Kbd(props: KbdProps): JSXNode {
  return <kbd class={[styles.root, props.class]}>{props.children}</kbd>;
}
