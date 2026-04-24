import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "topbar",
  "brand",
  "logo",
  "brandName",
  "pill",
  "sep",
  "crumb",
  "crumbCurrent",
  "crumbLabel",
  "crumbMono",
  "crumbDot",
  "crumbDotRunning",
  "crumbDotError",
  "crumbDotIdle",
  "right",
  "iconBtn",
  "iconBtnDot",
  "daemon",
  "daemonDot",
  "daemonDotOk",
  "daemonDotErr",
  "daemonDotIdle",
  "daemonLabel",
  "daemonMono",
] as const);

export const topbar = rule`${c.topbar} {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 10px 0 8px;
  border-bottom: 1px solid ${tokens.colors.border};
  background: ${tokens.colors.background};
  font-size: 12.5px;
  position: relative;
  z-index: 5;
  min-width: 0;
}
@media (max-width: 900px) {
  ${c.topbar} {
    display: none;
  }
}`;

export const brand = rule`${c.brand} {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 5px;
  flex-shrink: 0;
}`;

export const logo = rule`${c.logo} {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: ${tokens.colors.text};
  color: ${tokens.colors.background};
  display: grid;
  place-items: center;
  font-family: ${tokens.fonts.mono};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: -0.02em;
}`;

export const brandName = rule`${c.brandName} {
  font-weight: 500;
  letter-spacing: -0.005em;
  color: ${tokens.colors.text};
}`;

export const pill = rule`${c.pill} {
  font-family: ${tokens.fonts.mono};
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: ${tokens.colors.surface};
  color: ${tokens.colors.textMuted};
  border: 1px solid ${tokens.colors.border};
  letter-spacing: 0;
}`;

export const sep = rule`${c.sep} {
  color: ${tokens.colors.textDim};
  opacity: 0.5;
  font-size: 14px;
  flex-shrink: 0;
}`;

export const crumb = rule`${c.crumb} {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 7px;
  border-radius: 5px;
  color: ${tokens.colors.textMuted};
  cursor: pointer;
  font-size: 12.5px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  border: none;
  font-family: inherit;
}
${c.crumb}:hover {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
}
${c.crumb}:focus-visible {
  outline: none;
  box-shadow: ${tokens.shadows.focusRing};
}`;

export const crumbCurrent = rule`${c.crumbCurrent} {
  color: ${tokens.colors.text};
}`;

export const crumbLabel = rule`${c.crumbLabel} {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;

export const crumbMono = rule`${c.crumbMono} {
  font-family: ${tokens.fonts.mono};
  font-size: 12px;
}`;

export const crumbDot = rule`${c.crumbDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const crumbDotRunning = rule`${c.crumbDotRunning} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const crumbDotError = rule`${c.crumbDotError} {
  background: ${tokens.colors.agentError};
}`;

export const crumbDotIdle = rule`${c.crumbDotIdle} {
  background: ${tokens.colors.agentIdle};
}`;

export const right = rule`${c.right} {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}`;

export const iconBtn = rule`${c.iconBtn} {
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${tokens.colors.textMuted};
  padding: 6px;
  border-radius: 5px;
  display: grid;
  place-items: center;
  font-family: inherit;
  position: relative;
}
${c.iconBtn}:hover {
  background: ${tokens.colors.surface};
  color: ${tokens.colors.text};
}
${c.iconBtn}:focus-visible {
  outline: none;
  box-shadow: ${tokens.shadows.focusRing};
}`;

export const iconBtnDot = rule`${c.iconBtnDot} {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: ${tokens.colors.agentRunning};
}`;

export const daemon = rule`${c.daemon} {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 3px 8px;
  border: 1px solid ${tokens.colors.border};
  border-radius: 999px;
  font-size: 11.5px;
  color: ${tokens.colors.textMuted};
  cursor: pointer;
  background: transparent;
  font-family: inherit;
  transition: border-color ${tokens.transitions.fast}, color ${tokens.transitions.fast};
}
${c.daemon}:hover {
  border-color: ${tokens.colors.borderStrong};
  color: ${tokens.colors.text};
}
${c.daemon}:focus-visible {
  outline: none;
  box-shadow: ${tokens.shadows.focusRing};
}`;

export const daemonDot = rule`${c.daemonDot} {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}`;

export const daemonDotOk = rule`${c.daemonDotOk} {
  background: ${tokens.colors.agentRunning};
  color: ${tokens.colors.agentRunning};
  animation: aw-pulse 1.6s ease-in-out infinite;
}`;

export const daemonDotErr = rule`${c.daemonDotErr} {
  background: ${tokens.colors.danger};
}`;

export const daemonDotIdle = rule`${c.daemonDotIdle} {
  background: ${tokens.colors.agentIdle};
}`;

export const daemonLabel = rule`${c.daemonLabel} {
  font-size: 11.5px;
  color: ${tokens.colors.textMuted};
}`;

export const daemonMono = rule`${c.daemonMono} {
  font-family: ${tokens.fonts.mono};
  font-size: 10.5px;
  color: ${tokens.colors.textDim};
}`;
