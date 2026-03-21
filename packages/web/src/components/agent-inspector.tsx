/** @jsxImportSource semajsx/dom */

import { Icon, ChevronDown } from "@semajsx/icons";
import { computed } from "semajsx/signal";
import type { Signal, ReadableSignal } from "semajsx/signal";
import type { AgentState, InboxItem, TodoItem } from "../api/types.ts";
import { inject } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";
import * as styles from "./agent-inspector.style.ts";

// Eagerly inject CSS for styles used in classList manipulation
inject([styles.chevronOpen, styles.sectionBodyHidden]);

const stateColors: Record<string, string> = {
  idle: tokens.colors.agentIdle,
  running: tokens.colors.agentRunning,
  processing: tokens.colors.agentRunning,
  error: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
  stopped: tokens.colors.agentIdle,
};

function CollapsibleSection(props: {
  title: string;
  countSuffix?: ReadableSignal<string>;
  defaultOpen?: boolean;
  children: unknown;
}) {
  let open = props.defaultOpen ?? true;
  let bodyEl: HTMLElement;
  let chevronEl: HTMLElement;

  function toggle() {
    open = !open;
    if (open) {
      bodyEl.classList.remove(styles.sectionBodyHidden);
      chevronEl.classList.add(styles.chevronOpen);
    } else {
      bodyEl.classList.add(styles.sectionBodyHidden);
      chevronEl.classList.remove(styles.chevronOpen);
    }
  }

  return (
    <div class={styles.section}>
      <div class={styles.sectionHeader} onclick={toggle}>
        <span>
          {props.title}
          {props.countSuffix ? (
            <span style={`color: ${tokens.colors.textDim}; font-weight: ${tokens.fontWeights.normal}`}>
              {props.countSuffix}
            </span>
          ) : null}
        </span>
        <span
          class={[styles.chevron, open && styles.chevronOpen]}
          ref={(el: HTMLElement) => { chevronEl = el; }}
        >
          <Icon icon={ChevronDown} size={14} />
        </span>
      </div>
      <div
        class={[styles.sectionBody, !open && styles.sectionBodyHidden]}
        ref={(el: HTMLElement) => { bodyEl = el; }}
      >
        {props.children}
      </div>
    </div>
  );
}

function InboxItemView(props: { item: InboxItem }) {
  const { item } = props;
  return (
    <div class={styles.item}>
      <span class={styles.itemId}>{item.id}</span>
      <span class={styles.itemContent}>
        {typeof item.content === "string"
          ? item.content.slice(0, 200)
          : JSON.stringify(item.content).slice(0, 200)}
      </span>
      <div class={styles.itemMeta}>
        {item.from ? <span>from: {item.from}</span> : null}
        {item.priority ? <span>priority: {item.priority}</span> : null}
        {item.status ? <span>{item.status}</span> : null}
      </div>
    </div>
  );
}

function TodoItemView(props: { item: TodoItem }) {
  const { item } = props;
  return (
    <div class={styles.item}>
      <div class={styles.itemMeta}>
        <span class={styles.itemId}>{item.id}</span>
        <span>{item.status}</span>
      </div>
      <span class={styles.itemContent}>{item.text}</span>
    </div>
  );
}

export function AgentInspector(props: { agentState: Signal<AgentState | null> }) {
  const state = props.agentState;

  const stateText = computed(state, (s) => s?.state ?? "unknown");
  const dotColor = computed(stateText, (s) => stateColors[s] ?? tokens.colors.agentIdle);
  const inbox = computed(state, (s) => s?.inbox ?? []);
  const todos = computed(state, (s) => s?.todos ?? []);
  const inboxCount = computed(inbox, (items) => items.length);
  const todoCount = computed(todos, (items) => items.length);
  const inboxSuffix = computed(inboxCount, (n) => (n > 0 ? ` (${n})` : ""));
  const todoSuffix = computed(todoCount, (n) => (n > 0 ? ` (${n})` : ""));
  const stateBadgeStyle = computed(dotColor, (c) => `background: ${c}`);
  const taskSuffix = computed(state, (s) =>
    s?.currentTask ? ` — ${s.currentTask}` : "",
  );

  const inboxBody = computed(inbox, (items) => {
    if (items.length === 0) {
      return <span class={styles.emptyState}>No inbox items</span>;
    }
    return items.map((item) => <InboxItemView item={item} />);
  });

  const todoBody = computed(todos, (items) => {
    if (items.length === 0) {
      return <span class={styles.emptyState}>No todo items</span>;
    }
    return items.map((item) => <TodoItemView item={item} />);
  });

  return (
    <div class={styles.panel}>
      <CollapsibleSection title="State" defaultOpen={true}>
        <div class={styles.stateBadge}>
          <span class={styles.stateDot} style={stateBadgeStyle} />
          {stateText}
          {taskSuffix}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Inbox" countSuffix={inboxSuffix} defaultOpen={true}>
        <div class={styles.itemList}>{inboxBody}</div>
      </CollapsibleSection>

      <CollapsibleSection title="Todos" countSuffix={todoSuffix} defaultOpen={true}>
        <div class={styles.itemList}>{todoBody}</div>
      </CollapsibleSection>
    </div>
  );
}
