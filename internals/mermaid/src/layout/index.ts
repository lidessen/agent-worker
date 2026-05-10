import { flowchartLayout } from "./flowchart";
import { sequenceLayout } from "./sequence";
import type { LayoutEngine } from "../types";

export const builtinLayout: LayoutEngine = {
  flowchart: flowchartLayout,
  sequence: sequenceLayout,
};

export { flowchartLayout } from "./flowchart";
export { sequenceLayout } from "./sequence";
export { estimateTextSize, canvasMeasureText, measureNode, measureLabel } from "./measure";
