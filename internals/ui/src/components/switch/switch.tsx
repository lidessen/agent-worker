/** @jsxImportSource @semajsx/dom */

/**
 * Switch component
 *
 * A toggle switch for boolean settings.
 *
 * @example
 * ```tsx
 * import { Switch } from "@semajsx/ui/components/switch";
 *
 * <Switch label="Dark mode" />
 * <Switch label="Notifications" checked />
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./switch.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface SwitchProps {
  /** Label text */
  label?: string;
  /** Checked state */
  checked?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** HTML name attribute */
  name?: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
}

export function Switch(props: SwitchProps): JSXNode {
  const checked = props.checked ?? false;

  return (
    <div
      role="switch"
      aria-checked={checked ? "true" : "false"}
      aria-disabled={props.disabled ? "true" : undefined}
      class={[styles.root, styles.rootDisabled, props.class]}
    >
      <div class={[styles.track, checked && styles.trackOn]}>
        <div class={[styles.thumb, checked && styles.thumbOn]} />
      </div>
      {props.label && <span class={styles.label}>{props.label}</span>}
    </div>
  );
}
