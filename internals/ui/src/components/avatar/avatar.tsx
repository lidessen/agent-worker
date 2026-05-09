/** @jsxImportSource @semajsx/dom */

/**
 * Avatar component
 *
 * Displays a user avatar with image or initials fallback.
 *
 * @example
 * ```tsx
 * import { Avatar } from "@semajsx/ui/components/avatar";
 *
 * <Avatar src="/photo.jpg" alt="John" />
 * <Avatar initials="JD" />
 * <Avatar initials="AB" size="lg" />
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./avatar.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** Initials to display when no image is provided */
  initials?: string;
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Additional CSS class(es) */
  class?: ClassValue;
}

const sizeStyles = {
  sm: styles.sm,
  md: styles.md,
  lg: styles.lg,
} as const;

export function Avatar(props: AvatarProps): JSXNode {
  const size = props.size ?? "md";

  return (
    <div
      class={[styles.root, sizeStyles[size], props.class]}
      role="img"
      aria-label={props.alt ?? props.initials ?? "Avatar"}
    >
      {props.src ? (
        <img class={styles.image} src={props.src} alt={props.alt ?? ""} />
      ) : (
        <span class={styles.fallback}>{props.initials ?? "?"}</span>
      )}
    </div>
  );
}
