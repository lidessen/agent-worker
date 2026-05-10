/**
 * Pre-built animation utilities for @semajsx/style
 *
 * Provides ready-to-use keyframes and animation StyleTokens for common
 * animations like fade, slide, scale, spin, and bounce.
 *
 * @example
 * ```ts
 * import { fadeInKf, fadeIn, slideUpKf, slideUp } from "@semajsx/style";
 *
 * // Use keyframes in custom rules
 * const custom = rule`${c.root} {
 *   animation: ${fadeInKf} 0.5s ease-out;
 * }`;
 *
 * // Or use pre-built animation classes
 * <div class={[myStyle, fadeIn]}>Fading in!</div>
 * ```
 */

import { keyframes, keyframesToken } from "./keyframes";
import type { KeyframeRef } from "./keyframes";
import { classes } from "./classes";
import { rule, rules } from "./rule";
import type { StyleToken } from "./types";

// ──── Keyframe Definitions ──────────────────────────────────────────

/** Fade in from transparent */
export const fadeInKf: KeyframeRef = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

/** Fade out to transparent */
export const fadeOutKf: KeyframeRef = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

/** Slide up from below */
export const slideUpKf: KeyframeRef = keyframes`
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

/** Slide down from above */
export const slideDownKf: KeyframeRef = keyframes`
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
`;

/** Slide in from left */
export const slideLeftKf: KeyframeRef = keyframes`
  from { transform: translateX(-10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

/** Slide in from right */
export const slideRightKf: KeyframeRef = keyframes`
  from { transform: translateX(10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
`;

/** Scale in from smaller */
export const scaleInKf: KeyframeRef = keyframes`
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
`;

/** Scale out to smaller */
export const scaleOutKf: KeyframeRef = keyframes`
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.95); opacity: 0; }
`;

/** Spin 360 degrees */
export const spinKf: KeyframeRef = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/** Ping effect (for notifications) */
export const pingKf: KeyframeRef = keyframes`
  75%, 100% { transform: scale(2); opacity: 0; }
`;

/** Pulse effect */
export const pulseKf: KeyframeRef = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

/** Bounce effect */
export const bounceKf: KeyframeRef = keyframes`
  0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
  50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
`;

// ──── Animation Class Tokens ────────────────────────────────────────

const c = classes([
  "fadeIn",
  "fadeOut",
  "slideUp",
  "slideDown",
  "slideLeft",
  "slideRight",
  "scaleIn",
  "scaleOut",
  "spin",
  "ping",
  "pulse",
  "bounce",
] as const);

/** Fade in animation (0.3s ease-out) */
export const fadeIn: StyleToken = rules(
  keyframesToken(fadeInKf),
  rule`${c.fadeIn} { animation: ${fadeInKf} 0.3s ease-out; }`,
);

/** Fade out animation (0.3s ease-in) */
export const fadeOut: StyleToken = rules(
  keyframesToken(fadeOutKf),
  rule`${c.fadeOut} { animation: ${fadeOutKf} 0.3s ease-in; }`,
);

/** Slide up animation (0.3s ease-out) */
export const slideUp: StyleToken = rules(
  keyframesToken(slideUpKf),
  rule`${c.slideUp} { animation: ${slideUpKf} 0.3s ease-out; }`,
);

/** Slide down animation (0.3s ease-out) */
export const slideDown: StyleToken = rules(
  keyframesToken(slideDownKf),
  rule`${c.slideDown} { animation: ${slideDownKf} 0.3s ease-out; }`,
);

/** Slide in from left animation (0.3s ease-out) */
export const slideLeft: StyleToken = rules(
  keyframesToken(slideLeftKf),
  rule`${c.slideLeft} { animation: ${slideLeftKf} 0.3s ease-out; }`,
);

/** Slide in from right animation (0.3s ease-out) */
export const slideRight: StyleToken = rules(
  keyframesToken(slideRightKf),
  rule`${c.slideRight} { animation: ${slideRightKf} 0.3s ease-out; }`,
);

/** Scale in animation (0.2s ease-out) */
export const scaleIn: StyleToken = rules(
  keyframesToken(scaleInKf),
  rule`${c.scaleIn} { animation: ${scaleInKf} 0.2s ease-out; }`,
);

/** Scale out animation (0.2s ease-in) */
export const scaleOut: StyleToken = rules(
  keyframesToken(scaleOutKf),
  rule`${c.scaleOut} { animation: ${scaleOutKf} 0.2s ease-in; }`,
);

/** Spin animation (1s linear infinite) */
export const spin: StyleToken = rules(
  keyframesToken(spinKf),
  rule`${c.spin} { animation: ${spinKf} 1s linear infinite; }`,
);

/** Ping animation (1s cubic-bezier infinite) */
export const ping: StyleToken = rules(
  keyframesToken(pingKf),
  rule`${c.ping} { animation: ${pingKf} 1s cubic-bezier(0, 0, 0.2, 1) infinite; }`,
);

/** Pulse animation (2s ease-in-out infinite) */
export const pulse: StyleToken = rules(
  keyframesToken(pulseKf),
  rule`${c.pulse} { animation: ${pulseKf} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }`,
);

/** Bounce animation (1s infinite) */
export const bounce: StyleToken = rules(
  keyframesToken(bounceKf),
  rule`${c.bounce} { animation: ${bounceKf} 1s infinite; }`,
);
