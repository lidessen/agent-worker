import { shapeMap } from "./nodes";
import { Edge } from "./edge";
import { SubgraphBox } from "./subgraph";
import { Label } from "./label";
import { Participant } from "./sequence/participant";
import { Message } from "./sequence/message";
import { Lifeline } from "./sequence/lifeline";
import { Activation } from "./sequence/activation";
import { Block } from "./sequence/block";
import { Note } from "./sequence/note";
import type { RendererMap } from "../types";

export const defaultRenderers: RendererMap = {
  node: shapeMap.rect,
  edge: Edge,
  subgraph: SubgraphBox,
  label: Label,
  participant: Participant,
  message: Message,
  lifeline: Lifeline,
  activation: Activation,
  block: Block,
  note: Note,
};

export { shapeMap } from "./nodes";
export { Edge } from "./edge";
export { Defs } from "./defs";
export { SubgraphBox } from "./subgraph";
export { Label } from "./label";
export * from "./sequence";
