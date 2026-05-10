import { parseFlowchart } from "./flowchart";
import { parseSequence } from "./sequence";
import type { ParseResult } from "../types";

/**
 * Parse a Mermaid DSL string into a structured diagram IR.
 *
 * Returns a FlowchartDiagram, SequenceDiagram, or ParseError.
 * Check for errors with: `if ("message" in result)`
 */
export function parse(input: string): ParseResult {
  const trimmed = input.trim();

  if (trimmed.startsWith("sequenceDiagram")) {
    return parseSequence(trimmed);
  }

  if (trimmed.startsWith("graph") || trimmed.startsWith("flowchart")) {
    return parseFlowchart(trimmed);
  }

  return {
    message: `Unknown diagram type. Expected 'graph', 'flowchart', or 'sequenceDiagram'.`,
    line: 1,
    column: 1,
  };
}

export { parseFlowchart } from "./flowchart";
export { parseSequence } from "./sequence";
export { tokenize } from "./tokenizer";
