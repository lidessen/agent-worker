/** @jsxImportSource semajsx/dom */

/**
 * Brand icons for AI runtimes.
 *
 * Official logos rendered as inline SVG with fill="currentColor".
 * Sources: Simple Icons (claude, cursor), OpenAI brand assets.
 */

import { Native } from "semajsx/dom";
import type { VNode } from "semajsx";

interface BrandIconProps {
  size?: number;
  class?: string;
  style?: string;
}

function createBrandSvg(
  viewBox: string,
  pathD: string,
  props: BrandIconProps,
): SVGSVGElement {
  const size = String(props.size ?? 16);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "currentColor");
  if (props.class) svg.setAttribute("class", props.class);
  if (props.style) svg.setAttribute("style", props.style);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);

  return svg;
}

/** Anthropic Claude — sparkle mark */
const CLAUDE_PATH =
  "m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z";

/** Cursor AI editor */
const CURSOR_PATH =
  "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23";

/** OpenAI (codex) */
const OPENAI_PATH =
  "M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 10.68.086 6.047 6.047 0 0 0 4.93 4.084a6.008 6.008 0 0 0-3.976 2.928 6.042 6.042 0 0 0 .749 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.516 2.898A5.985 5.985 0 0 0 13.32 23.906a6.045 6.045 0 0 0 5.75-3.998 6.008 6.008 0 0 0 3.976-2.928 6.045 6.045 0 0 0-.763-7.16zM13.32 22.396a4.493 4.493 0 0 1-2.876-1.04l.141-.081 4.779-2.759a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.716 18.257a4.49 4.49 0 0 1-.535-3.014l.142.085 4.783 2.759a.77.77 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.024-1.693zM2.716 7.847A4.49 4.49 0 0 1 5.07 5.862v5.683a.78.78 0 0 0 .392.676l5.747 3.317-2.02 1.163a.076.076 0 0 1-.071.006L4.16 13.868a4.504 4.504 0 0 1-1.444-6.02zm17.143 4.003-5.84-3.37 2.02-1.166a.076.076 0 0 1 .071-.006l4.957 2.842a4.5 4.5 0 0 1-.7 8.115v-5.734a.78.78 0 0 0-.39-.68h-.118zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L10.33 9.33V6.998a.073.073 0 0 1 .031-.062l4.957-2.857a4.498 4.498 0 0 1 6.681 4.66l-.12.086zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.17a4.5 4.5 0 0 1 7.375-3.453l-.142.08L9.58 5.57a.78.78 0 0 0-.395.677zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z";

export function ClaudeIcon(props: BrandIconProps = {}): VNode {
  return Native({ element: createBrandSvg("0 0 24 24", CLAUDE_PATH, props) });
}

export function CursorIcon(props: BrandIconProps = {}): VNode {
  return Native({ element: createBrandSvg("0 0 24 24", CURSOR_PATH, props) });
}

export function OpenAIIcon(props: BrandIconProps = {}): VNode {
  return Native({ element: createBrandSvg("0 0 24 24", OPENAI_PATH, props) });
}

/** Vercel triangle (ai-sdk) */
const VERCEL_PATH = "M12 1L24 22H0z";

export function VercelIcon(props: BrandIconProps = {}): VNode {
  return Native({ element: createBrandSvg("0 0 24 24", VERCEL_PATH, props) });
}

/** Telegram — paper plane only (no circle), official brand mark */
const TELEGRAM_PATH =
  "M9.028 16.267l-.405 5.72c.58 0 .832-.25 1.135-.553l2.725-2.621 5.647 4.163c1.035.58 1.765.275 2.045-.958l3.71-17.5c.329-1.544-.588-2.148-1.666-1.77L1.098 10.456c-1.502.58-1.48 1.413-.257 1.791l4.894 1.531L17.67 6.112c.585-.388 1.118-.174.68.214L9.028 16.267z";

export function TelegramIcon(props: BrandIconProps = {}): VNode {
  return Native({ element: createBrandSvg("0 0 24 24", TELEGRAM_PATH, props) });
}

/** Slack — hashtag-like mark */
const SLACK_PATH =
  "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z";

export function SlackIcon(props: BrandIconProps = {}): VNode {
  return Native({ element: createBrandSvg("0 0 24 24", SLACK_PATH, props) });
}

/** Discord — game controller face */
const DISCORD_PATH =
  "M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z";

export function DiscordIcon(props: BrandIconProps = {}): VNode {
  return Native({ element: createBrandSvg("0 0 24 24", DISCORD_PATH, props) });
}

/** Platform config: icon factory + official brand color */
export const platformConfig: Record<string, {
  icon: ((props?: BrandIconProps) => VNode) | null;
  color: string;      // official brand color
  bgAlpha: string;    // low-opacity version for label background
}> = {
  telegram:  { icon: TelegramIcon,  color: "#26A5E4", bgAlpha: "rgba(38, 165, 228, 0.18)" },
  slack:     { icon: SlackIcon,     color: "#E01E5A", bgAlpha: "rgba(224, 30, 90, 0.18)" },
  discord:   { icon: DiscordIcon,   color: "#5865F2", bgAlpha: "rgba(88, 101, 242, 0.18)" },
};

export interface ParsedPlatform {
  platform: string | null;
  name: string;
  icon: ((props?: BrandIconProps) => VNode) | null;
  color: string | null;
  bgAlpha: string | null;
}

/**
 * Parse "platform:name" into { platform, name, icon, color, bgAlpha }.
 * If no colon, returns the raw string as name with no platform info.
 */
export function parsePlatformName(raw: string): ParsedPlatform {
  const idx = raw.indexOf(":");
  if (idx < 1) return { platform: null, name: raw, icon: null, color: null, bgAlpha: null };
  const platform = raw.slice(0, idx).toLowerCase();
  const name = raw.slice(idx + 1);
  const cfg = platformConfig[platform];
  if (!cfg) return { platform, name, icon: null, color: null, bgAlpha: null };
  return { platform, name, icon: cfg.icon, color: cfg.color, bgAlpha: cfg.bgAlpha };
}
