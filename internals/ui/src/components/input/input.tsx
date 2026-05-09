/** @jsxImportSource @semajsx/dom */

/**
 * Input component
 *
 * A text input field with optional label and size variants.
 *
 * @example
 * ```tsx
 * import { Input } from "@semajsx/ui/components/input";
 *
 * <Input placeholder="Enter your name" />
 * <Input label="Email" type="email" size="lg" />
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./input.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface InputProps {
  /** Input type */
  type?: "text" | "email" | "password" | "number" | "search" | "url" | "tel";
  /** Label text displayed above the input */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Disabled state */
  disabled?: boolean;
  /** Read-only state */
  readOnly?: boolean;
  /** HTML name attribute */
  name?: string;
  /** HTML id attribute */
  id?: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
}

const sizeStyles = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
} as const;

export function Input(props: InputProps): JSXNode {
  const size = props.size ?? "md";
  const inputId = props.id ?? props.name;

  const input = (
    <input
      type={props.type ?? "text"}
      id={inputId}
      name={props.name}
      placeholder={props.placeholder}
      value={props.value}
      disabled={props.disabled}
      readOnly={props.readOnly}
      class={[styles.root, styles.rootStates, sizeStyles[size], props.class]}
    />
  );

  if (props.label) {
    return (
      <div class={styles.wrapper}>
        <label class={styles.label} for={inputId}>
          {props.label}
        </label>
        {input}
      </div>
    );
  }

  return input;
}
