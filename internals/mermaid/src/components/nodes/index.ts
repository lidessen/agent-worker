import type { Component } from "@semajsx/core";
import type { NodeRenderProps, NodeShape } from "../../types";
import { RectNode } from "./rect";
import { RoundNode } from "./round";
import { CircleNode } from "./circle";
import { RhombusNode } from "./rhombus";
import { HexagonNode } from "./hexagon";
import { StadiumNode } from "./stadium";
import { CylinderNode } from "./cylinder";
import { SubroutineNode } from "./subroutine";
import { AsymmetricNode } from "./asymmetric";
import { ParallelogramNode } from "./parallelogram";
import { TrapezoidNode } from "./trapezoid";
import { DoubleCircleNode } from "./double-circle";

export const shapeMap: Record<NodeShape, Component<NodeRenderProps>> = {
  rect: RectNode,
  round: RoundNode,
  stadium: StadiumNode,
  circle: CircleNode,
  rhombus: RhombusNode,
  hexagon: HexagonNode,
  cylinder: CylinderNode,
  subroutine: SubroutineNode,
  asymmetric: AsymmetricNode,
  parallelogram: ParallelogramNode,
  trapezoid: TrapezoidNode,
  "double-circle": DoubleCircleNode,
};

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
};
