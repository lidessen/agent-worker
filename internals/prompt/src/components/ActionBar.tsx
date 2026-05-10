/** @jsxImportSource @semajsx/prompt */

import type { JSXNode, VNode } from "@semajsx/core";

export interface ActionDef {
  label?: string;
  name: string;
  [key: string]: unknown;
}

export interface ActionBarProps {
  /**
   * Actions to render
   */
  actions: ActionDef[];
  /**
   * Custom label prefix
   * @default "Actions"
   */
  label?: string;
  /**
   * Whether to render inline (pipe-separated) or as a list
   * @default true
   */
  inline?: boolean;
  children?: JSXNode;
}

/**
 * ActionBar component - renders a group of actions
 *
 * @example
 * <ActionBar actions={[
 *   { label: "Reply", name: "reply", chat: "A" },
 *   { label: "Scroll Up", name: "scroll_up", chat: "A" },
 * ]} />
 * // Actions: Reply => @act:reply chat=A | Scroll Up => @act:scroll_up chat=A
 */
export function ActionBar(props: ActionBarProps): JSXNode {
  const { actions, label = "Actions", inline = true } = props;

  const actionElements: VNode[] = [];
  for (let i = 0; i < actions.length; i++) {
    const actionDef = actions[i];
    if (!actionDef) continue;
    const { label: actionLabel, name, ...params } = actionDef;
    actionElements.push(<action key={i} label={actionLabel} name={name} {...params} />);
  }

  return (
    <actions label={label} inline={inline}>
      {actionElements}
    </actions>
  );
}
