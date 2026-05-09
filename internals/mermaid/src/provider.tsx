/** @jsxImportSource @semajsx/dom */
import { context, Context } from "@semajsx/core";
import type { JSXNode, ContextProvide, ContextType } from "@semajsx/core";
import { inject } from "@semajsx/style";
import { lightTheme, darkTheme } from "./themes";
import type { RendererMap, LayoutEngine } from "./types";

export const MermaidRenderers: ContextType<RendererMap> = context<RendererMap>("mermaid-renderers");
export const MermaidLayout: ContextType<LayoutEngine> = context<LayoutEngine>("mermaid-layout");

export interface MermaidProviderProps extends Partial<RendererMap> {
  children?: JSXNode;
  theme?: "light" | "dark";
  layout?: LayoutEngine;
}

export function MermaidProvider(props: MermaidProviderProps): JSXNode {
  const { children, theme = "light", layout, ...rendererOverrides } = props;

  inject(lightTheme);
  if (theme === "dark") inject(darkTheme);

  const contexts: ContextProvide[] = [[MermaidRenderers, rendererOverrides as RendererMap]];
  if (layout) contexts.push([MermaidLayout, layout]);

  return (
    <Context provide={contexts}>
      <div class={theme === "dark" ? darkTheme : undefined}>{children}</div>
    </Context>
  );
}
