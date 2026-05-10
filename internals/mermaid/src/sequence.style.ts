import { classes, rule } from "@semajsx/style";
import type { StyleToken, ClassRefs } from "@semajsx/style";
import { tokens } from "./tokens";
import { textLabel, boxShape } from "./base.style";

const SEQUENCE_CLASSES = [
  "participantBox",
  "participantLabel",
  "lifeline",
  "activation",
  "messageLine",
  "messageDotted",
  "messageText",
  "blockBg",
  "blockLabel",
  "blockLabelText",
  "blockSectionLine",
  "blockSectionLabel",
  "noteBg",
  "noteText",
] as const;

const c: ClassRefs<typeof SEQUENCE_CLASSES> = classes(SEQUENCE_CLASSES);

export const participantBox: StyleToken = rule`${c.participantBox} {
  ${boxShape(tokens.actorFill, tokens.actorStroke, 2)}
}`;

export const participantLabel: StyleToken = rule`${c.participantLabel} {
  ${textLabel(tokens.nodeText, `${tokens.fontSize}px`)}
}`;

export const lifeline: StyleToken = rule`${c.lifeline} {
  stroke: ${tokens.lifelineStroke};
  stroke-width: 1;
  stroke-dasharray: 6, 4;
}`;

export const activation: StyleToken = rule`${c.activation} {
  ${boxShape(tokens.activationFill, tokens.actorStroke, 1)}
}`;

export const messageLine: StyleToken = rule`${c.messageLine} {
  stroke: ${tokens.messageStroke};
  stroke-width: 1.5;
  fill: none;
}`;

export const messageDotted: StyleToken = rule`${c.messageDotted} {
  stroke-dasharray: 6, 4;
}`;

export const messageText: StyleToken = rule`${c.messageText} {
  ${textLabel(tokens.nodeText, "12px")}
}`;

export const blockBg: StyleToken = rule`${c.blockBg} {
  ${boxShape(tokens.blockFill, tokens.blockStroke, 1)}
}`;

export const blockLabel: StyleToken = rule`${c.blockLabel} {
  fill: ${tokens.blockStroke};
}`;

export const blockLabelText: StyleToken = rule`${c.blockLabelText} {
  ${textLabel(tokens.nodeText, "11px")}
  font-weight: 600;
}`;

export const blockSectionLine: StyleToken = rule`${c.blockSectionLine} {
  stroke: ${tokens.blockStroke};
  stroke-width: 1;
  stroke-dasharray: 6, 4;
}`;

export const blockSectionLabel: StyleToken = rule`${c.blockSectionLabel} {
  ${textLabel(tokens.nodeText, "11px")}
  font-weight: 600;
  font-style: italic;
}`;

export const noteBg: StyleToken = rule`${c.noteBg} {
  ${boxShape(tokens.noteBg, tokens.noteStroke, 1)}
}`;

export const noteText: StyleToken = rule`${c.noteText} {
  ${textLabel(tokens.noteText, "12px")}
}`;

export { c };
