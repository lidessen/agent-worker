import { classes, rule } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";

const c = classes([
  "container",
  "header",
  "headerInfo",
  "wsName",
  "badge",
  "badgeDot",
  "modeTag",
  "content",
  "hero",
  "heroCopy",
  "heroEyebrow",
  "heroTitle",
  "heroText",
  "statGrid",
  "statCard",
  "statLabel",
  "statValue",
  "statValueSmall",
  "section",
  "sectionHeader",
  "sectionTitle",
  "count",
  "agentList",
  "agentItem",
  "agentLabel",
  "agentRuntimeIcon",
  "agentDot",
  "channelList",
  "channelItem",
  "configBlock",
  "configRow",
  "configLabel",
  "configValue",
] as const);

export const container = rule`${c.container} {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.lg} ${tokens.space.xl} ${tokens.space.md};
  border-bottom: 1px solid ${tokens.colors.border};
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  flex-shrink: 0;
}
@media (max-width: 640px) {
  ${c.header} {
    padding: ${tokens.space.sm} ${tokens.space.md};
    gap: ${tokens.space.sm};
  }
}`;

export const headerInfo = rule`${c.headerInfo} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.sm};
  flex-wrap: wrap;
}`;

export const wsName = rule`${c.wsName} {
  font-size: ${tokens.fontSizes.xl};
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.03em;
  color: ${tokens.colors.text};
}`;

export const badge = rule`${c.badge} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.xs};
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 4px ${tokens.space.sm};
  background: ${tokens.colors.surfaceSecondary};
}`;

export const badgeDot = rule`${c.badgeDot} {
  width: 6px;
  height: 6px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
}`;

export const modeTag = rule`${c.modeTag} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textMuted};
  background: ${tokens.colors.surfaceSecondary};
  border: 1px solid ${tokens.colors.border};
  padding: 4px ${tokens.space.sm};
  border-radius: ${tokens.radii.pill};
}`;

export const content = rule`${c.content} {
  flex: 1;
  overflow-y: auto;
  padding: ${tokens.space.xl};
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xl};
}
@media (max-width: 640px) {
  ${c.content} {
    padding: ${tokens.space.md};
  }
}`;

export const hero = rule`${c.hero} {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: ${tokens.space.lg};
  align-items: stretch;
}
@media (max-width: 900px) {
  ${c.hero} {
    grid-template-columns: 1fr;
  }
}`;

export const heroCopy = rule`${c.heroCopy} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
  padding: ${tokens.space.xl};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  box-shadow: ${tokens.shadows.inset};
}`;

export const heroEyebrow = rule`${c.heroEyebrow} {
  font-size: ${tokens.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${tokens.colors.textDim};
}`;

export const heroTitle = rule`${c.heroTitle} {
  font-size: ${tokens.fontSizes.xxl};
  line-height: 1.02;
  font-weight: ${tokens.fontWeights.bold};
  letter-spacing: -0.04em;
  color: ${tokens.colors.text};
}`;

export const heroText = rule`${c.heroText} {
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.65;
  color: ${tokens.colors.textMuted};
  max-width: 48ch;
}`;

export const statGrid = rule`${c.statGrid} {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${tokens.space.md};
}
@media (max-width: 640px) {
  ${c.statGrid} {
    grid-template-columns: 1fr;
  }
}`;

export const statCard = rule`${c.statCard} {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: ${tokens.space.sm};
  min-height: 120px;
  padding: ${tokens.space.lg};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  box-shadow: ${tokens.shadows.inset};
}`;

export const statLabel = rule`${c.statLabel} {
  font-size: ${tokens.fontSizes.xs};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: ${tokens.colors.textDim};
}`;

export const statValue = rule`${c.statValue} {
  font-size: ${tokens.fontSizes.xxl};
  line-height: 1;
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const statValueSmall = rule`${c.statValueSmall} {
  font-size: ${tokens.fontSizes.sm};
  line-height: 1.5;
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.text};
}`;

export const section = rule`${c.section} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.md};
  padding: ${tokens.space.xl};
  border-radius: ${tokens.radii.xl};
  background: ${tokens.colors.panel};
  border: 1px solid ${tokens.colors.border};
  box-shadow: ${tokens.shadows.inset};
}`;

export const sectionHeader = rule`${c.sectionHeader} {
  display: flex;
  align-items: baseline;
  gap: ${tokens.space.sm};
}`;

export const sectionTitle = rule`${c.sectionTitle} {
  font-size: ${tokens.fontSizes.lg};
  font-weight: ${tokens.fontWeights.semibold};
  color: ${tokens.colors.text};
}`;

export const count = rule`${c.count} {
  font-size: ${tokens.fontSizes.xs};
  color: ${tokens.colors.textDim};
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid ${tokens.colors.border};
  border-radius: ${tokens.radii.pill};
  padding: 2px ${tokens.space.sm};
  line-height: 1.2;
}`;

export const agentList = rule`${c.agentList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const agentItem = rule`${c.agentItem} {
  display: flex;
  align-items: center;
  gap: ${tokens.space.md};
  padding: ${tokens.space.sm} 0;
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  cursor: pointer;
  transition: color ${tokens.transitions.fast};
}
${c.agentItem}:hover {
  color: ${tokens.colors.textMuted};
}`;

export const agentLabel = rule`${c.agentLabel} {
  display: inline-flex;
  align-items: center;
  gap: ${tokens.space.sm};
  min-width: 0;
}`;

export const agentRuntimeIcon = rule`${c.agentRuntimeIcon} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  color: ${tokens.colors.textMuted};
  flex: 0 0 auto;
  opacity: 0.9;
}`;

export const agentDot = rule`${c.agentDot} {
  width: 8px;
  height: 8px;
  border-radius: ${tokens.radii.pill};
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08);
}`;

export const channelList = rule`${c.channelList} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.xs};
}`;

export const channelItem = rule`${c.channelItem} {
  display: flex;
  align-items: center;
  padding: ${tokens.space.sm} 0;
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.text};
  cursor: pointer;
  transition: color ${tokens.transitions.fast};
}
${c.channelItem}:hover {
  color: ${tokens.colors.textMuted};
}`;

export const configBlock = rule`${c.configBlock} {
  display: flex;
  flex-direction: column;
  gap: ${tokens.space.sm};
}`;

export const configRow = rule`${c.configRow} {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: ${tokens.space.lg};
  padding: ${tokens.space.sm} 0;
}
@media (max-width: 640px) {
  ${c.configRow} {
    flex-direction: column;
    align-items: flex-start;
    gap: ${tokens.space.xs};
  }
}`;

export const configLabel = rule`${c.configLabel} {
  font-size: ${tokens.fontSizes.sm};
  color: ${tokens.colors.textMuted};
}`;

export const configValue = rule`${c.configValue} {
  font-size: ${tokens.fontSizes.sm};
  font-family: ${tokens.fonts.mono};
  color: ${tokens.colors.text};
}`;
