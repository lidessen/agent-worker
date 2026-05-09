/** @jsxImportSource @semajsx/dom */

/**
 * Badge component
 *
 * A small pill-shaped label for status, category, or metadata.
 *
 * @example
 * ```tsx
 * import { Badge } from "@semajsx/ui/badge";
 *
 * <Badge color="success">Beginner</Badge>
 * <Badge color="warning">Intermediate</Badge>
 * <Badge color="danger">Advanced</Badge>
 * <Badge>Default</Badge>
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./badge.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export type BadgeColor = "default" | "success" | "warning" | "danger" | "info" | "tip";

export interface BadgeProps {
  /** Semantic color */
  color?: BadgeColor;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Content */
  children?: JSXNode;
}

const badgeColors: Record<BadgeColor, { bg: string; fg: string }> = {
  default: { bg: "rgba(0, 0, 0, 0.06)", fg: "#1d1d1f" },
  success: { bg: "rgba(52, 199, 89, 0.12)", fg: "#248a3d" },
  warning: { bg: "rgba(255, 159, 10, 0.12)", fg: "#b25000" },
  danger: { bg: "rgba(255, 69, 58, 0.12)", fg: "#d70015" },
  info: { bg: "rgba(0, 122, 255, 0.1)", fg: "#0055b3" },
  tip: { bg: "rgba(175, 82, 222, 0.1)", fg: "#8944ab" },
};

export function Badge(props: BadgeProps): JSXNode {
  const color = props.color ?? "default";
  const config = badgeColors[color];

  return (
    <span
      class={[styles.root, props.class]}
      style={`background: ${config.bg}; color: ${config.fg}`}
    >
      {props.children}
    </span>
  );
}
