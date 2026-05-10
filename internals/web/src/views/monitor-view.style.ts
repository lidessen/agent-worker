import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "view",
  "header",
  "title",
  "subtitle",
  "uptime",
  "summaryStrip",
  "summaryItem",
  "summaryLabel",
  "summaryValue",
  "summaryStatus",
  "criterionGrid",
  "card",
  "cardHeader",
  "cardTitle",
  "cardSubtitle",
  "cardBody",
  "metricRow",
  "metricLabel",
  "metricValue",
  "metricMeta",
  "thresholdLine",
  "thresholdOk",
  "thresholdWarn",
  "thresholdNeutral",
  "bar",
  "barTrack",
  "barFill",
  "barFillEq2",
  "barFillEq1",
  "barFillEq0",
  "barLabel",
  "sparkline",
  "spark",
  "sparkBar",
  "sparkBarRunning",
  "placeholder",
  "placeholderTitle",
  "placeholderBody",
  "thresholdNote",
  "interventionList",
  "interventionRow",
  "interventionType",
  "interventionTypeRescue",
  "interventionTypeAuth",
  "interventionTypeAccept",
  "interventionTypeOther",
  "interventionTs",
  "interventionTarget",
  "interventionReason",
  "bindingTable",
  "bindingRow",
  "bindingHead",
  "bindingCell",
  "bindingOk",
  "bindingMiss",
  "bindingUnknown",
]);

export const view = rule`${c.view} {
  padding: ${tokens.space.xl} ${tokens.space.xl};
  max-width: 1200px;
  margin: 0 auto;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${tokens.space.lg};
  margin-bottom: ${tokens.space.lg};
}`;

export const title = rule`${c.title} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
  letter-spacing: -0.01em;
}`;

export const subtitle = rule`${c.subtitle} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
  margin-top: ${tokens.space.xs};
}`;

export const uptime = rule`${c.uptime} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.fonts.mono};
}`;

export const summaryStrip = rule`${c.summaryStrip} {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${tokens.space.md};
  margin-bottom: ${tokens.space.xl};
  padding: ${tokens.space.md} ${tokens.space.lg};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
}`;

export const summaryItem = rule`${c.summaryItem} {
  display: flex;
  flex-direction: column;
  gap: 2px;
}`;

export const summaryLabel = rule`${c.summaryLabel} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  font-weight: ${tokens.fontWeights.medium};
}`;

export const summaryValue = rule`${c.summaryValue} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.mono};
  font-weight: ${tokens.fontWeights.medium};
}`;

export const summaryStatus = rule`${c.summaryStatus} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const criterionGrid = rule`${c.criterionGrid} {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: ${tokens.space.lg};
}`;

export const card = rule`${c.card} {
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.lg};
}`;

export const cardHeader = rule`${c.cardHeader} {
  margin-bottom: ${tokens.space.md};
}`;

export const cardTitle = rule`${c.cardTitle} {
  font-size: ${tokens.fontSizes.md};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const cardSubtitle = rule`${c.cardSubtitle} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  margin-top: 2px;
}`;

export const cardBody = rule`${c.cardBody} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.md};
}`;

export const metricRow = rule`${c.metricRow} {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${tokens.space.md};
}`;

export const metricLabel = rule`${c.metricLabel} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
}`;

export const metricValue = rule`${c.metricValue} {
  font-size: ${tokens.fontSizes.lg};
  font-family: ${tokens.fonts.mono};
  font-weight: ${tokens.fontWeights.medium};
  color: ${tokens.colors.text};
}`;

export const metricMeta = rule`${c.metricMeta} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.fonts.mono};
}`;

export const thresholdLine = rule`${c.thresholdLine} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const thresholdOk = rule`${c.thresholdOk} {
  color: ${tokens.colors.successTextStrong};
}`;

export const thresholdWarn = rule`${c.thresholdWarn} {
  color: ${tokens.colors.warning};
}`;

export const thresholdNeutral = rule`${c.thresholdNeutral} {
  color: ${tokens.colors.textMuted};
}`;

export const bar = rule`${c.bar} {
  display: flex;
  flex-direction: column;
  gap: 4px;
}`;

export const barTrack = rule`${c.barTrack} {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: ${tokens.colors.surfaceOverlay};
}`;

export const barFill = rule`${c.barFill} {
  background: ${tokens.colors.successBorder};
  height: 100%;
}`;

export const barFillEq2 = rule`${c.barFillEq2} {
  background: ${tokens.colors.accent};
  height: 100%;
}`;

export const barFillEq1 = rule`${c.barFillEq1} {
  background: ${tokens.colors.warningBorder};
  height: 100%;
}`;

export const barFillEq0 = rule`${c.barFillEq0} {
  background: ${tokens.colors.surfaceOverlay};
  height: 100%;
}`;

export const barLabel = rule`${c.barLabel} {
  display: flex;
  justify-content: space-between;
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.fonts.mono};
}`;

export const sparkline = rule`${c.sparkline} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const spark = rule`${c.spark} {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 32px;
}`;

export const sparkBar = rule`${c.sparkBar} {
  flex: 1;
  background: ${tokens.colors.border};
  border-radius: 1px;
  min-height: 2px;
  transition: height 200ms ease;
}`;

export const sparkBarRunning = rule`${c.sparkBarRunning} {
  background: ${tokens.colors.accent};
}`;

export const placeholder = rule`${c.placeholder} {
  background: ${tokens.colors.surface};
  border: 1px dashed ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.lg};
  text-align: center;
}`;

export const placeholderTitle = rule`${c.placeholderTitle} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  font-weight: ${tokens.fontWeights.medium};
  margin-bottom: ${tokens.space.xs};
}`;

export const placeholderBody = rule`${c.placeholderBody} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const thresholdNote = rule`${c.thresholdNote} {
  margin-top: ${tokens.space.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  background: ${tokens.colors.surfaceOverlay};
  border-radius: ${tokens.radii.sm};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
}`;

export const interventionList = rule`${c.interventionList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const interventionRow = rule`${c.interventionRow} {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: ${tokens.space.sm};
  align-items: baseline;
  padding: ${tokens.space.xs} 0;
  border-bottom: 1px solid ${tokens.colors.border};
  font-size: ${tokens.fontSizes.xs};
}`;

export const interventionType = rule`${c.interventionType} {
  display: inline-block;
  padding: 1px ${tokens.space.sm};
  border-radius: ${tokens.radii.pill};
  font-family: ${tokens.fonts.mono};
  font-size: ${tokens.fontSizes.xxs};
  font-weight: ${tokens.fontWeights.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
}`;

export const interventionTypeRescue = rule`${c.interventionTypeRescue} {
  background: ${tokens.colors.dangerSurface};
  color: ${tokens.colors.danger};
  border: 1px solid ${tokens.colors.dangerBorder};
}`;

export const interventionTypeAuth = rule`${c.interventionTypeAuth} {
  background: ${tokens.colors.warningSurface};
  color: ${tokens.colors.warning};
  border: 1px solid ${tokens.colors.warningBorder};
}`;

export const interventionTypeAccept = rule`${c.interventionTypeAccept} {
  background: ${tokens.colors.successSurface};
  color: ${tokens.colors.successTextStrong};
  border: 1px solid ${tokens.colors.successBorder};
}`;

export const interventionTypeOther = rule`${c.interventionTypeOther} {
  background: ${tokens.colors.surfaceOverlay};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
}`;

export const interventionTs = rule`${c.interventionTs} {
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.textMuted};
  font-size: ${tokens.fontSizes.xxs};
  grid-column: 2;
}`;

export const interventionTarget = rule`${c.interventionTarget} {
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.textDim};
  font-size: ${tokens.fontSizes.xxs};
  grid-row: 2;
  grid-column: 1 / -1;
}`;

export const interventionReason = rule`${c.interventionReason} {
  color: ${tokens.colors.text};
  grid-row: 2;
  grid-column: 1 / -1;
}`;

export const bindingTable = rule`${c.bindingTable} {
  display: flex;
  flex-direction: column;
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.sm};
  overflow: hidden;
  margin-top: ${tokens.space.sm};
}`;

export const bindingRow = rule`${c.bindingRow} {
  display: grid;
  grid-template-columns: 1.4fr 1.6fr 0.7fr 0.6fr;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.xs} ${tokens.space.sm};
  border-bottom: 1px solid ${tokens.colors.border};
  font-size: ${tokens.fontSizes.xs};
  font-family: ${tokens.fonts.mono};
  align-items: baseline;
}`;

export const bindingHead = rule`${c.bindingHead} {
  background: ${tokens.colors.surfaceOverlay};
  color: ${tokens.colors.textMuted};
  font-weight: ${tokens.fontWeights.medium};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: ${tokens.fontSizes.xxs};
}`;

export const bindingCell = rule`${c.bindingCell} {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}`;

export const bindingOk = rule`${c.bindingOk} {
  color: ${tokens.colors.successTextStrong};
}`;

export const bindingMiss = rule`${c.bindingMiss} {
  color: ${tokens.colors.danger};
}`;

export const bindingUnknown = rule`${c.bindingUnknown} {
  color: ${tokens.colors.textMuted};
}`;
