/**
 * Style anchor components for @semajsx/dom
 *
 * These components control where styles are injected in the DOM.
 * Useful for Shadow DOM and component-scoped style injection.
 */

import type { VNode, JSXNode } from "@semajsx/core";
import { Fragment } from "@semajsx/core";

/**
 * Style anchor context - stores the current injection target
 */
let appStyleTarget: Element | ShadowRoot | null = null;
let componentStyleTarget: Element | ShadowRoot | null = null;

/**
 * Get the current style injection target
 *
 * Priority:
 * 1. Component anchor (if set)
 * 2. App anchor (if set)
 * 3. document.head (default)
 */
export function getStyleTarget(): Element | ShadowRoot {
  return componentStyleTarget ?? appStyleTarget ?? document.head;
}

/**
 * Set the app-level style injection target
 *
 * Use this for Shadow DOM to inject styles into the shadow root
 * instead of document.head.
 */
export function setAppStyleTarget(target: Element | ShadowRoot | null): void {
  appStyleTarget = target;
}

/**
 * Set the component-level style injection target
 *
 * This only affects the current component, not children.
 */
export function setComponentStyleTarget(target: Element | ShadowRoot | null): void {
  componentStyleTarget = target;
}

/**
 * AppStyleAnchor props
 */
export interface AppStyleAnchorProps {
  /** The target element or shadow root for style injection */
  target: Element | ShadowRoot;
  /** Children to render */
  children?: JSXNode;
}

/**
 * AppStyleAnchor - Sets the global style injection target
 *
 * Use this component to redirect all style injection to a specific target,
 * typically a Shadow DOM root.
 *
 * @example
 * ```tsx
 * function MyWebComponent() {
 *   const shadow = useShadowRoot();
 *
 *   return (
 *     <AppStyleAnchor target={shadow}>
 *       <App />
 *     </AppStyleAnchor>
 *   );
 * }
 * ```
 */
export function AppStyleAnchor({ target, children }: AppStyleAnchorProps): VNode {
  // Set the target when the component mounts
  setAppStyleTarget(target);

  // Return children wrapped in a fragment
  return {
    type: Fragment,
    props: {},
    children: children ? [children as VNode] : [],
    key: undefined,
  };
}

/**
 * ComponentStyleAnchor props
 */
export interface ComponentStyleAnchorProps {
  /** The target element or shadow root for style injection */
  target: Element | ShadowRoot;
  /** Children to render */
  children?: JSXNode;
}

/**
 * ComponentStyleAnchor - Sets style injection target for current component only
 *
 * Unlike AppStyleAnchor, this only affects styles used directly in the
 * component where it's declared. Child components use the App anchor
 * or fall back to document.head.
 *
 * @example
 * ```tsx
 * function IsolatedComponent() {
 *   const containerRef = signal<HTMLElement | null>(null);
 *
 *   return (
 *     <div>
 *       <style-container ref={containerRef} />
 *       <ComponentStyleAnchor target={containerRef}>
 *         <div class={card.root}>...</div>
 *         <ChildComponent /> {* Uses App anchor, NOT this anchor *}
 *       </ComponentStyleAnchor>
 *     </div>
 *   );
 * }
 * ```
 */
export function ComponentStyleAnchor({ target, children }: ComponentStyleAnchorProps): VNode {
  // Set the target when the component mounts
  setComponentStyleTarget(target);

  // Return children wrapped in a fragment
  return {
    type: Fragment,
    props: {},
    children: children ? [children as VNode] : [],
    key: undefined,
  };
}
