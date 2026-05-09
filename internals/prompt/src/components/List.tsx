/** @jsxImportSource @semajsx/prompt */

import type { JSXNode, VNode } from "@semajsx/core";
import type { SignalOr } from "@semajsx/core";

export interface ListItem {
  text: string;
  action?: {
    name: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ListProps {
  /**
   * List items to render
   */
  items: ListItem[];
  /**
   * If true, items are numbered (1. 2. 3.)
   * @default false
   */
  ordered?: boolean;
  /**
   * Custom marker for unordered lists
   * @default "-"
   */
  marker?: string;
  /**
   * Viewport string (e.g., "1-3/10")
   */
  viewport?: SignalOr<string>;
  /**
   * Scope for pagination actions
   */
  scope?: string;
  children?: JSXNode;
}

/**
 * List component - renders a list of items with optional numbering and actions
 *
 * @example
 * <List
 *   ordered
 *   items={[
 *     { text: "Reply to A", priority: "high", action: { name: "reply", chat: "A" } },
 *     { text: "Review B context", action: { name: "open", chat: "B" } },
 *   ]}
 *   viewport="1-2/5"
 *   scope="todos"
 * />
 * // 1. Reply to A                  priority=high   => @act:reply chat=A
 * // 2. Review B context                             => @act:open chat=B
 * // more: @act:next scope=todos
 */
export function List(props: ListProps): JSXNode {
  const { items, ordered = false, marker = "-", viewport, scope } = props;

  const elements: VNode[] = [];

  for (let i = 0; i < items.length; i++) {
    const listItem = items[i];
    if (!listItem) continue;

    const { text, action, ...extraProps } = listItem;

    // Build suffix from extra props (e.g., priority=high)
    const suffixParts: string[] = [];
    for (const [key, value] of Object.entries(extraProps)) {
      if (value != null && value !== "") {
        suffixParts.push(key + "=" + String(value));
      }
    }

    // Build action string
    let actionStr = "";
    if (action) {
      const { name, ...actionParams } = action;
      actionStr = "@act:" + name;
      for (const [key, value] of Object.entries(actionParams)) {
        if (value != null) {
          actionStr += " " + key + "=" + String(value);
        }
      }
    }

    // Compose the line content
    let content = text;
    if (suffixParts.length > 0) {
      content += "   " + suffixParts.join("   ");
    }
    if (actionStr) {
      content += "   => " + actionStr;
    }

    if (ordered) {
      elements.push(
        <item index={i + 1} key={i}>
          {content}
        </item>,
      );
    } else {
      elements.push(
        <item marker={marker} key={i}>
          {content}
        </item>,
      );
    }
  }

  if (viewport) {
    return (
      <viewport current={viewport} total={viewport} scope={scope}>
        {elements}
      </viewport>
    );
  }

  return <>{elements}</>;
}
