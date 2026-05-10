import { createTheme, defineTokens } from "@semajsx/style";
import type { StyleToken, TokenRefs } from "@semajsx/style";

const tokenDefinition = {
  // Node
  nodeFill: "#e8f4f8",
  nodeStroke: "#23395d",
  nodeText: "#1d1d1f",
  nodeRadius: "8",

  // Edge
  edgeStroke: "#666",
  edgeWidth: "2",
  edgeLabelBg: "#fff",
  edgeLabelText: "#333",

  // Arrow
  arrowFill: "#666",

  // Animation
  animatedDashArray: "5",
  animatedDuration: "0.5s",
  animatedDashOffset: "10",

  // Subgraph
  subgraphFill: "#f8f9fa",
  subgraphStroke: "#ccc",
  subgraphTitleBg: "#eee",
  subgraphTitleText: "#333",

  // Sequence
  actorFill: "#e8f4f8",
  actorStroke: "#23395d",
  lifelineStroke: "#999",
  activationFill: "#d4e6f1",
  messageStroke: "#333",
  blockFill: "rgba(200,200,200,0.1)",
  blockStroke: "#aaa",
  noteBg: "#fffacd",
  noteStroke: "#e6d800",
  noteText: "#333",

  // Background
  bgColor: "#ffffff",
  gridDotColor: "rgba(0, 0, 0, 0.1)",
  gridDotGap: "20",
  gridDotRadius: "1",

  // General
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
  fontSize: "14",
} as const;

export const tokens: TokenRefs<typeof tokenDefinition> = defineTokens(tokenDefinition);

/**
 * Default mermaid theme — sets CSS custom properties on :root.
 * Embed its __cssTemplate in an SVG <style> for self-contained rendering.
 */
export const defaultTheme: StyleToken = createTheme(tokens);
