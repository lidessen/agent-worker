/** @jsxImportSource @semajsx/dom */
import type { JSXNode, RuntimeComponent } from "@semajsx/core";
import { unwrap } from "@semajsx/signal";
import { svgRoot } from "./root.style";
import { Defs } from "./components/defs";
import { builtinLayout } from "./layout";
import { MermaidLayout, MermaidRenderers } from "./provider";
import { defaultRenderers } from "./components";
import { defaultTheme } from "./tokens";
import type {
  SequenceProps,
  LayoutEngine,
  RendererMap,
  PositionedLifeline,
  PositionedBlock,
  PositionedActivation,
  PositionedNote,
  PositionedMessage,
  PositionedParticipant,
} from "./types";

export const Sequence: RuntimeComponent<SequenceProps> = (props, ctx): JSXNode => {
  const engine: LayoutEngine = ctx.inject(MermaidLayout) ?? builtinLayout;
  const renderers: RendererMap = ctx.inject(MermaidRenderers) ?? defaultRenderers;

  const graphData = unwrap(props.graph);
  const positioned = engine.sequence(graphData);

  const LifelineComp = renderers.lifeline!;
  const BlockComp = renderers.block!;
  const ActivationComp = renderers.activation!;
  const NoteComp = renderers.note!;
  const MessageComp = renderers.message!;
  const ParticipantComp = renderers.participant!;

  return (
    <svg
      class={[svgRoot, props.class]}
      viewBox={positioned.viewBox}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{defaultTheme.__cssTemplate}</style>
      <Defs />

      {positioned.lifelines.map((l: PositionedLifeline) => (
        <LifelineComp participant={l.participant} x={l.x} y1={l.y1} y2={l.y2} />
      ))}

      {positioned.blocks.map((b: PositionedBlock) => (
        <BlockComp
          block={b.block}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          sectionDividers={b.sectionDividers}
        />
      ))}

      {positioned.activations.map((a: PositionedActivation) => (
        <ActivationComp
          participant={a.participant}
          x={a.x}
          y={a.y}
          width={a.width}
          height={a.height}
        />
      ))}

      {positioned.notes.map((n: PositionedNote) => (
        <NoteComp note={n.note} x={n.x} y={n.y} width={n.width} height={n.height} />
      ))}

      {positioned.messages.map((m: PositionedMessage) => (
        <MessageComp message={m.message} fromX={m.fromX} toX={m.toX} y={m.y} />
      ))}

      {positioned.participants.map((p: PositionedParticipant) => (
        <ParticipantComp
          participant={p.participant}
          x={p.x}
          y={p.y}
          width={p.width}
          height={p.height}
        />
      ))}
    </svg>
  );
};
