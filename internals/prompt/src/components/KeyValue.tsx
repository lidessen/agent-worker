/** @jsxImportSource @semajsx/prompt */

import type { JSXNode, VNode } from "@semajsx/core";

export interface KeyValueEntry {
  label: string;
  value: string | number;
}

export interface KeyValueProps {
  /**
   * Key-value entries to render
   */
  entries: KeyValueEntry[];
  children?: JSXNode;
}

/**
 * KeyValue component - renders a list of key-value pairs
 *
 * @example
 * <KeyValue entries={[
 *   { label: "Status", value: "active" },
 *   { label: "Priority", value: "high" },
 * ]} />
 * // Status: active
 * // Priority: high
 */
export function KeyValue(props: KeyValueProps): JSXNode {
  const { entries } = props;

  const fields: VNode[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    fields.push(<field label={entry.label} value={String(entry.value)} key={i} />);
  }

  return <>{fields}</>;
}
