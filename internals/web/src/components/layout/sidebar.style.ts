import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "sidebar",
  "sidebarCollapsed",
  "find",
  "findInput",
  "kbd",
  "section",
  "sectionLabel",
  "sectionAction",
  "item",
  "itemActive",
  "itemLabel",
  "itemCount",
  "itemChev",
  "collapsedGlyph",
  "dot",
  "dotRunning",
  "dotError",
  "dotIdle",
  "sub",
  "subActive",
  "subHash",
  "subName",
  "subCount",
  "divider",
  "bottom",
  "account",
  "avatar",
  "hiddenCollapsed",
] as const);

export const sidebar = rule`${c.sidebar} {
  border-right: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  padding: 8px 6px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-height: 0;
  min-width: 0;
}
@media (max-width: 900px) {
  ${c.sidebar} {
    display: none;
  }
}`;

export const sidebarCollapsed = rule`${c.sidebarCollapsed} {
  padding: 8px 4px;
}
${c.sidebarCollapsed} ${c.section} {
  justify-content: center;
  padding: 8px 0 4px;
}
${c.sidebarCollapsed} ${c.item},
${c.sidebarCollapsed} ${c.sub},
${c.sidebarCollapsed} ${c.account} {
  width: 36px;
  min-height: 28px;
  margin: 0 auto;
  padding: 0;
  justify-content: center;
  text-align: center;
}
${c.sidebarCollapsed} ${c.sub} {
  gap: 0;
}
${c.sidebarCollapsed} ${c.subHash} {
  width: auto;
}
${c.sidebarCollapsed} ${c.subName},
${c.sidebarCollapsed} ${c.subCount} {
  display: none;
}
${c.sidebarCollapsed} ${c.dot} {
  display: none;
}
${c.sidebarCollapsed} ${c.collapsedGlyph} {
  display: grid;
}`;

export const find = rule`${c.find} {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 3px 6px;
  padding: 5px 8px;
  border-radius: 5px;
  color: ${tokens.colors.textDim};
  font-size: 12px;
  cursor: text;
  border: none;
  background: transparent;
  font-family: inherit;
  width: calc(100% - 6px);
}
${c.find}:hover {
  background: ${tokens.colors.surface};
}`;

export const findInput = rule`${c.findInput} {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: ${tokens.colors.text};
  font-size: 12px;
  font-family: inherit;
}
${c.findInput}::placeholder {
  color: ${tokens.colors.textDim};
}`;

export const kbd = rule`${c.kbd} {
  font-family: ${tokens.fonts.mono};
  font-size: 9.5px;
  color: ${tokens.colors.textDim};
  padding: 1px 4px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 3px;
}`;

export const section = rule`${c.section} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 10px 4px;
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${tokens.colors.textDim};
}`;

export const sectionLabel = rule`${c.sectionLabel} {
  color: inherit;
}`;

export const sectionAction = rule`${c.sectionAction} {
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${tokens.colors.textDim};
  padding: 2px;
  border-radius: 3px;
  display: grid;
  place-items: center;
  font-family: inherit;
  font-size: 14px;
  line-height: 1;
}
${c.sectionAction}:hover {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
}
${c.sectionAction}:focus-visible {
  outline: none;
  box-shadow: ${tokens.shadows.focusRing};
}`;

export const item = rule`${c.item} {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 8px;
  margin: 0 3px;
  background: transparent;
  border: none;
  color: ${tokens.colors.textMuted};
  cursor: pointer;
  border-radius: 5px;
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  width: calc(100% - 6px);
  min-height: 26px;
  transition: background ${tokens.transitions.fast}, color ${tokens.transitions.fast};
}
${c.item}:hover {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
}
${c.item}:focus-visible {
  outline: none;
  box-shadow: ${tokens.shadows.focusRing};
}`;

export const itemActive = rule`${c.itemActive} {
  background: ${tokens.colors.surfaceHover};
  color: ${tokens.colors.text};
  font-weight: 500;
}`;

export const itemLabel = rule`${c.itemLabel} {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}`;

export const itemCount = rule`${c.itemCount} {
  margin-left: auto;
  font-family: ${tokens.fonts.mono};
  font-size: 10px;
  color: ${tokens.colors.textDim};
  flex-shrink: 0;
}`;

export const itemChev = rule`${c.itemChev} {
  margin-left: auto;
  color: ${tokens.colors.textDim};
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}`;

export const collapsedGlyph = rule`${c.collapsedGlyph} {
  display: none;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  place-items: center;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.border};
  color: ${tokens.colors.textMuted};
  font-family: ${tokens.fonts.mono};
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
  text-transform: uppercase;
}`;

export const dot = rule`${c.dot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const dotRunning = rule`${c.dotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const dotError = rule`${c.dotError} {
  background: ${tokens.colors.agentError};
}`;

export const dotIdle = rule`${c.dotIdle} {
  background: ${tokens.colors.agentIdle};
}`;

export const sub = rule`${c.sub} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 4px 26px;
  margin: 0 3px;
  background: transparent;
  border: none;
  color: ${tokens.colors.textDim};
  cursor: pointer;
  border-radius: 5px;
  font-family: inherit;
  font-size: 12px;
  text-align: left;
  width: calc(100% - 6px);
  min-height: 24px;
}
${c.sub}:hover {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
}
${c.sub}:focus-visible {
  outline: none;
  box-shadow: ${tokens.shadows.focusRing};
}`;

export const subActive = rule`${c.subActive} {
  background: ${tokens.colors.surfaceHover};
  color: ${tokens.colors.text};
}`;

export const subHash = rule`${c.subHash} {
  color: ${tokens.colors.agentIdle};
  font-family: ${tokens.fonts.mono};
  font-size: 12px;
  width: 12px;
  text-align: center;
}`;

export const subName = rule`${c.subName} {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
}`;

export const subCount = rule`${c.subCount} {
  margin-left: auto;
  font-family: ${tokens.fonts.mono};
  font-size: 10px;
  color: ${tokens.colors.textDim};
  flex-shrink: 0;
}`;

export const divider = rule`${c.divider} {
  height: 1px;
  background: ${tokens.colors.border};
  margin: 8px 8px;
}`;

export const bottom = rule`${c.bottom} {
  margin-top: auto;
  border-top: 1px solid ${tokens.colors.border};
  padding-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}`;

export const account = rule`${c.account} {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 5px 8px;
  margin: 0 3px;
  background: transparent;
  border: none;
  color: ${tokens.colors.textMuted};
  cursor: pointer;
  border-radius: 5px;
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  width: calc(100% - 6px);
  min-height: 26px;
}
${c.account}:hover {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
}
${c.account}:focus-visible {
  outline: none;
  box-shadow: ${tokens.shadows.focusRing};
}`;

export const avatar = rule`${c.avatar} {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${tokens.colors.surface};
  border: 1px solid ${tokens.colors.borderStrong};
  color: ${tokens.colors.textMuted};
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-family: ${tokens.fonts.mono};
  font-size: 10px;
  font-weight: 500;
  line-height: 1;
}
${c.avatar}::before {
  content: "L";
}`;

export const hiddenCollapsed = rule`${c.hiddenCollapsed} {
  display: none;
}`;
