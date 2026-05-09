/**
 * Prompt UI - JSX-to-text renderer for LLM agent prompt screens
 *
 * Converts a JSX VNode tree into structured plain text output
 * following the Sectioned Terminal protocol.
 *
 * @example
 * import { renderToString } from "@semajsx/prompt";
 *
 * const text = renderToString(
 *   <Screen name="Support Inbox" time="2026-03-12" focus="thread:A">
 *     <Section title="ROLE">
 *       <line>Support Agent</line>
 *     </Section>
 *   </Screen>
 * );
 */

// Rendering
export { render, renderToString } from "./render";
export type { RenderResult } from "./render";

// Serialization
export { serialize } from "./serialize";

// Types
export type { PromptNode, PromptElement, PromptText, PromptRoot } from "./types";

// Operations (tree manipulation)
export {
  createElement,
  createTextNode,
  createComment,
  createRoot,
  appendChild,
  removeChild,
  insertBefore,
  replaceNode,
  getParent,
  getNextSibling,
  collectText,
} from "./operations";

// Properties
export { setProperty, setSignalProperty } from "./properties";

// Components
export * from "./components";

// Re-export helpers for convenience
export { when, resource, stream } from "@semajsx/core";
