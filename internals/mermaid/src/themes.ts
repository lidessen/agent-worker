import { createTheme } from "@semajsx/style";
import type { StyleToken } from "@semajsx/style";
import { tokens } from "./tokens";

export const lightTheme: StyleToken = createTheme(tokens);

export const darkTheme: StyleToken = createTheme(tokens, {
  nodeFill: "#2d3748",
  nodeStroke: "#63b3ed",
  nodeText: "#e2e8f0",
  edgeStroke: "#a0aec0",
  edgeLabelBg: "#1a202c",
  edgeLabelText: "#e2e8f0",
  arrowFill: "#a0aec0",
  subgraphFill: "#1a202c",
  subgraphStroke: "#4a5568",
  subgraphTitleBg: "#2d3748",
  subgraphTitleText: "#e2e8f0",
  actorFill: "#2d3748",
  actorStroke: "#63b3ed",
  lifelineStroke: "#4a5568",
  activationFill: "#2d3748",
  messageStroke: "#a0aec0",
  blockFill: "rgba(100,100,100,0.15)",
  blockStroke: "#4a5568",
  noteBg: "#4a4528",
  noteStroke: "#b8a900",
  noteText: "#e2e8f0",
  bgColor: "#1a202c",
  gridDotColor: "rgba(255, 255, 255, 0.08)",
});
