import type { Signal } from "@semajsx/signal";
import type { Component, JSXNode } from "@semajsx/core";
import type { StyleToken } from "@semajsx/style";

// ── Common ─────────────────────────────────────────────

export type DiagramType = "flowchart" | "sequence";
export type Direction = "TB" | "TD" | "BT" | "LR" | "RL";

// ── Flowchart IR ───────────────────────────────────────

export interface FlowchartDiagram {
  type: "flowchart";
  direction: Direction;
  nodes: FlowNode[];
  edges: FlowEdge[];
  subgraphs: Subgraph[];
}

export type NodeShape =
  | "rect"
  | "round"
  | "stadium"
  | "subroutine"
  | "cylinder"
  | "circle"
  | "asymmetric"
  | "rhombus"
  | "hexagon"
  | "parallelogram"
  | "trapezoid"
  | "double-circle";

export interface FlowNode {
  id: string;
  label: string;
  shape: NodeShape;
  class?: string;
  url?: string;
}

export type EdgeLineStyle = "solid" | "dotted" | "thick";
export type EdgeMarker = "arrow" | "dot" | "cross" | "none";

/** @deprecated Use EdgeLineStyle + EdgeMarker instead */
export type EdgeType = "arrow" | "open" | "dotted" | "thick" | "invisible" | "animated";

export interface FlowEdge {
  source: string;
  target: string;
  label?: string;
  lineStyle: EdgeLineStyle;
  sourceMarker: EdgeMarker;
  targetMarker: EdgeMarker;
}

export interface Subgraph {
  id: string;
  label: string;
  nodes: string[];
  subgraphs?: Subgraph[];
  direction?: Direction;
}

// ── Sequence IR ────────────────────────────────────────

export interface SequenceDiagram {
  type: "sequence";
  participants: Participant[];
  messages: Message[];
  blocks: Block[];
  notes: Note[];
  /** @internal Message count before each note, for interleaved layout positioning */
  _noteMessageCounts?: number[];
}

export interface Participant {
  id: string;
  label: string;
  type: "participant" | "actor";
}

export type ArrowType =
  | "solid"
  | "dotted"
  | "solidCross"
  | "dottedCross"
  | "solidOpen"
  | "dottedOpen";

export interface Message {
  from: string;
  to: string;
  text: string;
  arrow: ArrowType;
  activate?: boolean;
  deactivate?: boolean;
}

export type BlockType = "loop" | "alt" | "opt" | "par" | "critical" | "break";

export interface Block {
  type: BlockType;
  label: string;
  messages: Message[];
  sections?: { label: string; messages: Message[] }[];
}

export type NotePosition = "left of" | "right of" | "over";

export interface Note {
  position: NotePosition;
  participants: string[];
  text: string;
}

// ── Layout Output ──────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface PositionedNode {
  node: FlowNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedEdge {
  edge: FlowEdge;
  /** SVG path data string (e.g. "M 0 0 C 10 20 30 40 50 60") */
  path: string;
  labelPosition?: Point;
  /** Measured label size — used by Edge component for background rect */
  labelSize?: Size;
}

export interface PositionedSubgraph {
  subgraph: Subgraph;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlowchartLayout {
  width: number;
  height: number;
  viewBox: string;
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  subgraphs: PositionedSubgraph[];
}

export interface SequenceLayout {
  width: number;
  height: number;
  viewBox: string;
  participants: PositionedParticipant[];
  messages: PositionedMessage[];
  lifelines: PositionedLifeline[];
  activations: PositionedActivation[];
  blocks: PositionedBlock[];
  notes: PositionedNote[];
}

export interface PositionedParticipant {
  participant: Participant;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedMessage {
  message: Message;
  fromX: number;
  toX: number;
  y: number;
}

export interface PositionedLifeline {
  participant: Participant;
  x: number;
  y1: number;
  y2: number;
}

export interface PositionedActivation {
  participant: Participant;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedBlock {
  block: Block;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Y-coordinates of section dividers (for alt/par blocks with else/and clauses) */
  sectionDividers?: { y: number; label: string }[];
}

export interface PositionedNote {
  note: Note;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Layout Engine ──────────────────────────────────────

export interface LayoutOptions {
  nodeSpacing: number;
  rankSpacing: number;
  nodeWidth: number;
  nodeHeight: number;
  nodePadding: number;
  diagramPadding: number;
  edgeRouting: "polyline" | "bezier" | "orthogonal";
  measureText?: (text: string, fontSize: number) => Size;
}

export interface LayoutEngine {
  flowchart(diagram: FlowchartDiagram, options?: Partial<LayoutOptions>): FlowchartLayout;
  sequence(diagram: SequenceDiagram, options?: Partial<LayoutOptions>): SequenceLayout;
}

// ── Component Props (Render Layer) ─────────────────────

export type ClassValue = string | StyleToken | ClassValue[] | false | null | undefined;

export interface NodeRenderProps {
  positioned: PositionedNode;
  class?: ClassValue;
}

export interface EdgeRenderProps {
  positioned: PositionedEdge;
  class?: ClassValue;
}

export interface SubgraphRenderProps {
  positioned: PositionedSubgraph;
  children?: JSXNode;
  class?: ClassValue;
}

export interface LabelRenderProps {
  text: string;
  x: number;
  y: number;
  class?: ClassValue;
}

export interface ParticipantRenderProps {
  participant: Participant;
  x: number;
  y: number;
  width: number;
  height: number;
  class?: ClassValue;
}

export interface MessageRenderProps {
  message: Message;
  fromX: number;
  toX: number;
  y: number;
  class?: ClassValue;
}

export interface NoteRenderProps {
  note: Note;
  x: number;
  y: number;
  width: number;
  height: number;
  class?: ClassValue;
}

export interface LifelineRenderProps {
  participant: Participant;
  x: number;
  y1: number;
  y2: number;
  class?: ClassValue;
}

export interface ActivationRenderProps {
  participant: Participant;
  x: number;
  y: number;
  width: number;
  height: number;
  class?: ClassValue;
}

export interface BlockRenderProps {
  block: Block;
  x: number;
  y: number;
  width: number;
  height: number;
  sectionDividers?: { y: number; label: string }[];
  class?: ClassValue;
}

// ── Renderer Map ───────────────────────────────────────

export interface RendererMap {
  node: Component<NodeRenderProps>;
  edge: Component<EdgeRenderProps>;
  subgraph: Component<SubgraphRenderProps>;
  label: Component<LabelRenderProps>;
  "node:rect"?: Component<NodeRenderProps>;
  "node:round"?: Component<NodeRenderProps>;
  "node:rhombus"?: Component<NodeRenderProps>;
  "node:circle"?: Component<NodeRenderProps>;
  "node:stadium"?: Component<NodeRenderProps>;
  "node:hexagon"?: Component<NodeRenderProps>;
  "node:cylinder"?: Component<NodeRenderProps>;
  "edge:solid"?: Component<EdgeRenderProps>;
  "edge:dotted"?: Component<EdgeRenderProps>;
  "edge:thick"?: Component<EdgeRenderProps>;
  participant?: Component<ParticipantRenderProps>;
  message?: Component<MessageRenderProps>;
  lifeline?: Component<LifelineRenderProps>;
  activation?: Component<ActivationRenderProps>;
  block?: Component<BlockRenderProps>;
  note?: Component<NoteRenderProps>;
}

// ── Component Props ────────────────────────────────────

export interface MermaidProps {
  code: string | Signal<string>;
  class?: ClassValue;
  onError?: (error: ParseError) => void;
}

export interface FlowchartProps {
  graph: FlowchartDiagram | Signal<FlowchartDiagram>;
  class?: ClassValue;
  padding?: number;
}

export interface SequenceProps {
  graph: SequenceDiagram | Signal<SequenceDiagram>;
  class?: ClassValue;
  padding?: number;
}

// ── Parse Types ────────────────────────────────────────

export interface ParseError {
  message: string;
  line?: number;
  column?: number;
}

export type ParseResult = FlowchartDiagram | SequenceDiagram | ParseError;
