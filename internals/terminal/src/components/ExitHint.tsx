/** @jsxImportSource @semajsx/terminal */
import { computed, signal } from "@semajsx/signal";
import { when, type JSXNode } from "@semajsx/core";
import { getActiveSession } from "../context";

export interface ExitHintProps {
  /**
   * Content to show during normal rendering, hidden during exit
   * After normalization: single VNode, array of VNodes, or undefined
   */
  children?: JSXNode;
}

/**
 * ExitHint component - hides its children during the final render before exit
 *
 * This is useful for hiding "Press Ctrl+C to exit" messages in the final
 * terminal output, keeping only the actual content visible.
 *
 * The component automatically detects when unmount() is called and reactively
 * hides its children during the final render using signal-based reactivity.
 *
 * @example
 * ```tsx
 * render(
 *   <box flexDirection="column" padding={1}>
 *     <text bold>Counter: {count}</text>
 *
 *     <ExitHint>
 *       <text dim marginTop={1} color="yellow">
 *         Press Ctrl+C or ESC to exit
 *       </text>
 *     </ExitHint>
 *   </box>
 * );
 * ```
 *
 * Result after exit:
 * - The counter remains visible
 * - The exit hint is hidden from final output
 */
export function ExitHint({ children }: ExitHintProps): JSXNode {
  const ctx = getActiveSession();
  const exitingSignal = ctx?.exitingSignal ?? signal(false);

  // Create inverted signal: show when NOT exiting
  const shouldShow = computed(exitingSignal, (isExiting) => !isExiting);

  // Return signal directly - renderComponent now handles Signal<VNode>
  return when(shouldShow, children);
}
