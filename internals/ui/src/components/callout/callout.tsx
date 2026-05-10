/** @jsxImportSource @semajsx/dom */

/**
 * Callout component
 *
 * A styled box for highlighting important content with semantic variants.
 *
 * @example
 * ```tsx
 * import { Callout } from "@semajsx/ui/callout";
 *
 * <Callout type="info" title="Note">This is informational.</Callout>
 * <Callout type="warning">Be careful with this.</Callout>
 * <Callout type="tip" title="Pro tip">Use signals for reactivity.</Callout>
 * ```
 */

import type { JSXNode, VNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";
import * as styles from "./callout.style";

type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export type CalloutType = "info" | "warning" | "success" | "error" | "tip";

export interface CalloutProps {
  /** Semantic type controlling color and icon */
  type?: CalloutType;
  /** Optional title displayed above content */
  title?: string;
  /** Additional CSS class(es) */
  class?: ClassValue;
  /** Content */
  children?: JSXNode;
}

const SVG_ATTRS = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "18",
  height: "18",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

function InfoIcon(): VNode {
  return (
    <svg {...SVG_ATTRS}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function WarningIcon(): VNode {
  return (
    <svg {...SVG_ATTRS}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function SuccessIcon(): VNode {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function ErrorIcon(): VNode {
  return (
    <svg {...SVG_ATTRS}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function TipIcon(): VNode {
  return (
    <svg {...SVG_ATTRS}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

const calloutConfig: Record<CalloutType, { bg: string; accent: string; icon: () => VNode }> = {
  info: { bg: "rgba(0, 122, 255, 0.06)", accent: "#007aff", icon: InfoIcon },
  warning: { bg: "rgba(255, 159, 10, 0.08)", accent: "#ff9f0a", icon: WarningIcon },
  success: { bg: "rgba(52, 199, 89, 0.08)", accent: "#34c759", icon: SuccessIcon },
  error: { bg: "rgba(255, 69, 58, 0.08)", accent: "#ff453a", icon: ErrorIcon },
  tip: { bg: "rgba(175, 82, 222, 0.06)", accent: "#af52de", icon: TipIcon },
};

export function Callout(props: CalloutProps): JSXNode {
  const type = props.type ?? "info";
  const config = calloutConfig[type];
  const IconComponent = config.icon;

  return (
    <div class={[styles.root, props.class]} style={`background: ${config.bg}`} role="note">
      {props.title && (
        <div class={styles.title} style={`color: ${config.accent}`}>
          <span class={styles.icon}>
            <IconComponent />
          </span>
          {props.title}
        </div>
      )}
      <div class={styles.content}>{props.children}</div>
    </div>
  );
}
