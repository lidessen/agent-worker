import { classes, rule } from "semajsx/style";
import { tokens } from "../../theme/tokens.ts";

const c = classes([
  "app",
  "innerShell",
  "innerShellCollapsed",
  "content",
  "contentInner",
] as const);

export const app = rule`${c.app} {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
  width: 100%;
  min-height: 0;
  background: ${tokens.colors.background};
  color: ${tokens.colors.text};
  font-family: ${tokens.fonts.base};
  overflow: hidden;
}`;

export const innerShell = rule`${c.innerShell} {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 0;
  overflow: hidden;
  transition: grid-template-columns ${tokens.transitions.normal};
}
@media (max-width: 900px) {
  ${c.innerShell} {
    grid-template-columns: 1fr;
  }
}`;

export const innerShellCollapsed = rule`${c.innerShellCollapsed} {
  grid-template-columns: 52px 1fr;
}`;

export const content = rule`${c.content} {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: ${tokens.colors.background};
}`;

/**
 * Kept for backward compatibility — some callers may still reference
 * `contentInner`. It's a no-op container in the new flat layout.
 */
export const contentInner = rule`${c.contentInner} {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}`;
