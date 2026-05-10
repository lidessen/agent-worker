// ── Main Components ───────────────────────────────────
export { Mermaid } from "./mermaid";
export { Flowchart } from "./flowchart";
export { Sequence } from "./sequence";

// ── Provider & Context ────────────────────────────────
export { MermaidProvider, MermaidRenderers, MermaidLayout } from "./provider";

// ── Parser ────────────────────────────────────────────
export { parse } from "./parser";
export { parseFlowchart } from "./parser/flowchart";
export { parseSequence } from "./parser/sequence";

// ── Layout ────────────────────────────────────────────
export { builtinLayout, flowchartLayout, sequenceLayout } from "./layout";
export { estimateTextSize, canvasMeasureText, measureNode, measureLabel } from "./layout/measure";

// ── Tokens & Themes ───────────────────────────────────
export { tokens } from "./tokens";
export { lightTheme, darkTheme } from "./themes";

// ── Default Renderers ─────────────────────────────────
export { defaultRenderers, shapeMap } from "./components";
export { Defs } from "./components/defs";
export { Edge } from "./components/edge";
export { SubgraphBox } from "./components/subgraph";
export { Label } from "./components/label";

// ── Node Shapes ───────────────────────────────────────
export {
  RectNode,
  RoundNode,
  CircleNode,
  RhombusNode,
  HexagonNode,
  StadiumNode,
  CylinderNode,
  SubroutineNode,
  AsymmetricNode,
  ParallelogramNode,
  TrapezoidNode,
  DoubleCircleNode,
} from "./components/nodes";

// ── Sequence Components ───────────────────────────────
export { Participant, Lifeline, Message, Activation, Block, Note } from "./components/sequence";

// ── Shared Primitives ────────────────────────────────
export { MARKER_URL, sequenceMarker, isDottedArrow } from "./components/markers";
export { textLabel, boxShape } from "./base.style";

// ── Styles (for custom renderers) ─────────────────────
export * as nodeStyles from "./node.style";
export * as edgeStyles from "./edge.style";
export * as subgraphStyles from "./subgraph.style";
export * as sequenceStyles from "./sequence.style";
export * as rootStyles from "./root.style";

// ── Types ─────────────────────────────────────────────
export type {
  // Diagram IR
  DiagramType,
  Direction,
  FlowchartDiagram,
  FlowNode,
  FlowEdge,
  NodeShape,
  EdgeType,
  EdgeLineStyle,
  EdgeMarker,
  Subgraph,
  SequenceDiagram,
  Participant as ParticipantType,
  Message as MessageType,
  ArrowType,
  BlockType,
  Block as BlockIR,
  Note as NoteType,
  NotePosition,
  // Layout output
  Point,
  Size,
  PositionedNode,
  PositionedEdge,
  PositionedSubgraph,
  FlowchartLayout,
  SequenceLayout,
  PositionedParticipant,
  PositionedMessage,
  PositionedLifeline,
  PositionedActivation,
  PositionedBlock,
  PositionedNote,
  // Engine
  LayoutOptions,
  LayoutEngine,
  // Render props
  NodeRenderProps,
  EdgeRenderProps,
  SubgraphRenderProps,
  LabelRenderProps,
  ParticipantRenderProps,
  MessageRenderProps,
  NoteRenderProps,
  LifelineRenderProps,
  ActivationRenderProps,
  BlockRenderProps,
  RendererMap,
  // Component props
  MermaidProps,
  FlowchartProps,
  SequenceProps,
  // Parse
  ParseError,
  ParseResult,
} from "./types";
