import { classes, rule } from "semajsx/style";
import { tokens } from "./theme/tokens.ts";

const c = classes([
  "mobileHome",
  "mobileIntro",
  "mobileTitle",
  "mobileSubtitle",
  "mobileSelect",
  "mobileStats",
  "mobileStatCard",
  "mobileStatLabel",
  "mobileStatValue",
  "mobileTabBar",
  "mobileTab",
  "mobileTabActive",
  "mobileResourceList",
  "mobileResourceEmpty",
  "mobileResourceButton",
  "mobileResourceIcon",
  "mobileResourceBody",
  "mobileResourceTitle",
  "mobileResourceMeta",
  "mobileFooterActions",
  "mobileFooterButton",
  "emptyState",
  "emptyHero",
  "emptyLogo",
  "emptyTitle",
  "emptyWorkspace",
  "emptyDescription",
  "emptyPanel",
  "emptyStats",
  "emptyStatCard",
  "emptyStatLabel",
  "emptyStatValue",
  "emptyActions",
  "emptyAction",
  "mobileBackBar",
  "mobileBackButton",
  "mobileBackTitle",
  "contentMount",
  "resourceRow",
  "resourceRowSelected",
] as const);

export const mobileHome = rule`${c.mobileHome} {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
  padding: ${tokens.space.md};
  gap: ${tokens.space.md};
  background: ${tokens.colors.backgroundElevated};
}`;

export const mobileIntro = rule`${c.mobileIntro} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
  padding: ${tokens.space.sm} ${tokens.space.xs};
}`;

export const mobileTitle = rule`${c.mobileTitle} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  color: ${tokens.colors.text};
  letter-spacing: -0.03em;
}`;

export const mobileSubtitle = rule`${c.mobileSubtitle} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  line-height: 1.5;
}`;

export const mobileSelect = rule`${c.mobileSelect} {
  width: 100%;
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  padding: ${tokens.space.sm} ${tokens.space.md};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.sm};
}`;

export const mobileStats = rule`${c.mobileStats} {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${tokens.space.xs};
}`;

export const mobileStatCard = rule`${c.mobileStatCard} {
  padding: ${tokens.space.sm};
  border-radius: ${tokens.radii.lg};
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  display: flex;
  flex-direction: column;
  gap: 2px;
}`;

export const mobileStatLabel = rule`${c.mobileStatLabel} {
  font-size: 0.65rem;
  color: ${tokens.colors.textDim};
  text-transform: uppercase;
  letter-spacing: 0.08em;
}`;

export const mobileStatValue = rule`${c.mobileStatValue} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const mobileTabBar = rule`${c.mobileTabBar} {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
}`;

export const mobileTab = rule`${c.mobileTab} {
  flex: 1;
  border: none;
  border-radius: ${tokens.radii.sm};
  padding: 9px ${tokens.space.xs};
  background: transparent;
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.xs};
  font-weight: ${tokens.fontWeights.medium};
}`;

export const mobileTabActive = rule`${c.mobileTabActive} {
  background: ${tokens.colors.surfaceActive};
  color: ${tokens.colors.text};
}`;

export const mobileResourceList = rule`${c.mobileResourceList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
  padding: ${tokens.space.xs};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  box-shadow: ${tokens.shadows.inset};
}`;

export const mobileResourceEmpty = rule`${c.mobileResourceEmpty} {
  padding: ${tokens.space.lg};
  color: ${tokens.colors.textDim};
  font-size: ${tokens.fontSizes.sm};
}`;

export const mobileResourceButton = rule`${c.mobileResourceButton} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  width: 100%;
  padding: ${tokens.space.md};
  border: none;
  border-radius: ${tokens.radii.lg};
  background: transparent;
  color: ${tokens.colors.text};
  font: inherit;
}`;

export const resourceRow = rule`${c.resourceRow} {
  background: transparent;
}`;

export const resourceRowSelected = rule`${c.resourceRowSelected} {
  background: ${tokens.colors.surface};
}`;

export const mobileResourceIcon = rule`${c.mobileResourceIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.surface};
  color: ${tokens.colors.textMuted};
  flex-shrink: 0;
}`;

export const mobileResourceBody = rule`${c.mobileResourceBody} {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  flex: 1;
}`;

export const mobileResourceTitle = rule`${c.mobileResourceTitle} {
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const mobileResourceMeta = rule`${c.mobileResourceMeta} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
}`;

export const mobileFooterActions = rule`${c.mobileFooterActions} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
  margin-top: auto;
  padding-top: ${tokens.space.sm};
}`;

export const mobileFooterButton = rule`${c.mobileFooterButton} {
  width: 100%;
  text-align: left;
  padding: ${tokens.space.sm} ${tokens.space.md};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.md};
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.sm};
}`;

export const emptyState = rule`${c.emptyState} {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: ${tokens.space.xxxl};
  gap: ${tokens.space.xxl};
}`;

export const emptyHero = rule`${c.emptyHero} {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.space.md};
  text-align: center;
  max-width: 560px;
  margin: 0 auto;
}`;

export const emptyLogo = rule`${c.emptyLogo} {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  box-shadow: ${tokens.shadows.glow};
  color: ${tokens.colors.textMuted};
}`;

export const emptyTitle = rule`${c.emptyTitle} {
  font-size: ${tokens.fontSizes.xxl};
  line-height: 1.04;
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.04em;
  color: ${tokens.colors.text};
}`;

export const emptyWorkspace = rule`${c.emptyWorkspace} {
  font-size: ${tokens.fontSizes.xl};
  line-height: 1.1;
  color: ${tokens.colors.textMuted};
  font-weight: ${tokens.fontWeights.semibold};
}`;

export const emptyDescription = rule`${c.emptyDescription} {
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.6;
  color: ${tokens.colors.textDim};
  max-width: 420px;
}`;

export const emptyPanel = rule`${c.emptyPanel} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.lg};
  width: min(100%, 860px);
  margin: 0 auto;
}`;

export const emptyStats = rule`${c.emptyStats} {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${tokens.space.md};
}`;

export const emptyStatCard = rule`${c.emptyStatCard} {
  padding: ${tokens.space.lg};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  box-shadow: ${tokens.shadows.inset};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const emptyStatLabel = rule`${c.emptyStatLabel} {
  font-size: ${tokens.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${tokens.colors.textDim};
}`;

export const emptyStatValue = rule`${c.emptyStatValue} {
  font-size: ${tokens.fontSizes.xxl};
  line-height: 1;
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const emptyActions = rule`${c.emptyActions} {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${tokens.space.sm};
}`;

export const emptyAction = rule`${c.emptyAction} {
  padding: ${tokens.space.sm} ${tokens.space.lg};
  border-radius: ${tokens.radii.pill};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  cursor: pointer;
}`;

export const mobileBackBar = rule`${c.mobileBackBar} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.sm} ${tokens.space.md};
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.backgroundElevated};
}`;

export const mobileBackButton = rule`${c.mobileBackButton} {
  border: none;
  background: transparent;
  color: ${tokens.colors.accent};
  font-family: ${tokens.fonts.base};
  font-size: ${tokens.fontSizes.sm};
  font-weight: ${tokens.fontWeights.medium};
  padding: 0;
}`;

export const mobileBackTitle = rule`${c.mobileBackTitle} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.text};
  font-weight: ${tokens.fontWeights.semibold};
}`;

export const contentMount = rule`${c.contentMount} {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}`;
