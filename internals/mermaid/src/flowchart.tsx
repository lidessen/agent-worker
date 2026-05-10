/** @jsxImportSource @semajsx/dom */
import type { JSXNode, RuntimeComponent } from "@semajsx/core";
import { unwrap } from "@semajsx/signal";
import { svgRoot } from "./root.style";
import { Defs } from "./components/defs";
import { shapeMap } from "./components/nodes";
import { Edge } from "./components/edge";
import { SubgraphBox } from "./components/subgraph";
import { builtinLayout } from "./layout";
import { MermaidLayout, MermaidRenderers } from "./provider";
import { defaultRenderers } from "./components";
import { defaultTheme } from "./tokens";
import type {
  FlowchartProps,
  LayoutEngine,
  RendererMap,
  PositionedSubgraph,
  PositionedEdge,
  PositionedNode,
  NodeShape,
} from "./types";

export const Flowchart: RuntimeComponent<FlowchartProps> = (props, ctx): JSXNode => {
  const engine: LayoutEngine = ctx.inject(MermaidLayout) ?? builtinLayout;
  const renderers: RendererMap = ctx.inject(MermaidRenderers) ?? defaultRenderers;

  const graphData = unwrap(props.graph);
  const positioned = engine.flowchart(graphData);

  return (
    <svg
      class={[svgRoot, props.class]}
      viewBox={positioned.viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{defaultTheme.__cssTemplate}</style>
      <Defs />

      {/* Grid dot background */}
      <rect x={0} y={0} width={positioned.width} height={positioned.height} fill="url(#mmd-grid)" />

      {positioned.subgraphs.map((s: PositionedSubgraph) => {
        const Comp = renderers.subgraph ?? SubgraphBox;
        return <Comp positioned={s} />;
      })}

      {positioned.edges.map((e: PositionedEdge) => {
        const key = `edge:${e.edge.lineStyle}` as keyof RendererMap;
        const Comp = (renderers[key] as typeof Edge) ?? renderers.edge ?? Edge;
        return <Comp positioned={e} />;
      })}

      {positioned.nodes.map((n: PositionedNode) => {
        const key = `node:${n.node.shape}` as keyof RendererMap;
        const Comp =
          (renderers[key] as typeof shapeMap.rect) ??
          renderers.node ??
          shapeMap[n.node.shape as NodeShape] ??
          shapeMap.rect;
        return <Comp positioned={n} />;
      })}
    </svg>
  );
};
