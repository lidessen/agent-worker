/** @jsxImportSource @semajsx/dom */

/**
 * Button component
 *
 * A polymorphic button with variant, size, and color support.
 * All styles are driven by theme tokens for automatic theme switching.
 *
 * @example
 * ```tsx
 * import { Button } from "@semajsx/ui/button";
 *
 * <Button>Default</Button>
 * <Button variant="outline">Outline</Button>
 * <Button variant="ghost" size="sm">Small Ghost</Button>
 * <Button color="danger">Delete</Button>
 * <Button disabled>Disabled</Button>
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./button.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface ButtonProps {
  /** Visual variant */
  variant?: "solid" | "outline" | "ghost";
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Color scheme - "danger" applies destructive styling */
  color?: "default" | "danger";
  /** Disabled state */
  disabled?: boolean;
  /** HTML button type attribute */
  type?: "button" | "submit" | "reset";
  /** Click handler */
  onClick?: (e: Event) => void;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Accessible label when button content isn't descriptive */
  "aria-label"?: string;
  /** Content */
  children?: JSXNode;
}

const variantStyles = {
  solid: [styles.solid, styles.solidStates],
  outline: [styles.outline, styles.outlineStates],
  ghost: [styles.ghost, styles.ghostStates],
} as const;

const sizeStyles = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
} as const;

export function Button(props: ButtonProps): JSXNode {
  const variant = props.variant ?? "solid";
  const size = props.size ?? "md";
  const color = props.color ?? "default";

  return (
    <button
      type={props.type ?? "button"}
      disabled={props.disabled}
      class={[
        styles.root,
        styles.rootStates,
        ...variantStyles[variant],
        sizeStyles[size],
        color === "danger" && [styles.danger, styles.dangerStates],
        props.class,
      ]}
      onClick={props.onClick}
      aria-label={props["aria-label"]}
    >
      {props.children}
    </button>
  );
}
