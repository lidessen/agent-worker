/** @jsxImportSource @semajsx/dom */

/**
 * Card component
 *
 * A content container with two variants matching the docs design:
 * - `feature` (default): Large card with icon, heading, and description
 * - `link`: Smaller clickable card for navigation
 *
 * @example
 * ```tsx
 * import { Card } from "@semajsx/ui/card";
 *
 * <Card icon="⚡" heading="Fast" description="Built for speed" />
 * <Card variant="link" heading="Guide" description="Get started" href="/docs" />
 * ```
 */

import type { JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./card.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface CardProps {
  /** Card variant */
  variant?: "feature" | "link";
  /** Icon content (emoji or JSX) */
  icon?: JSXNode;
  /** Card heading */
  heading?: string;
  /** Card description */
  description?: string;
  /** Link URL (for "link" variant) */
  href?: string;
  /** Inline style string */
  style?: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Content */
  children?: JSXNode;
}

export function Card(props: CardProps): JSXNode {
  const variant = props.variant ?? "feature";

  const content = (
    <>
      {props.icon && <div class={styles.icon}>{props.icon}</div>}
      {props.heading && (
        <h3 class={[styles.heading, variant === "link" && styles.headingLink]}>{props.heading}</h3>
      )}
      {props.description && (
        <p class={[styles.desc, variant === "link" && styles.descLink]}>{props.description}</p>
      )}
      {props.children}
    </>
  );

  if (variant === "link") {
    return (
      <a
        href={props.href}
        class={[styles.root, styles.link, styles.linkStates, props.class]}
        style={props.style}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      class={[styles.root, styles.feature, styles.featureStates, props.class]}
      style={props.style}
    >
      {content}
    </div>
  );
}
