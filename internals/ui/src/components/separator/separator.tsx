/** @jsxImportSource @semajsx/dom */

/**
 * Separator component
 *
 * A visual divider between content sections.
 *
 * @example
 * ```tsx
 * import { Separator } from "@semajsx/ui/components/separator";
 *
 * <Separator />
 * <Separator orientation="vertical" />
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./separator.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface SeparatorProps {
  /** Orientation of the separator */
  orientation?: "horizontal" | "vertical";
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Inline style string */
  style?: string;
}

export function Separator(props: SeparatorProps): JSXNode {
  const orientation = props.orientation ?? "horizontal";

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      class={[
        styles.root,
        styles.horizontal,
        orientation === "vertical" && styles.vertical,
        props.class,
      ]}
      style={props.style}
    />
  );
}
