/** @jsxImportSource semajsx/dom */

import { Icon, ChevronDown } from "semajsx/icons";
import { computed } from "semajsx/signal";
import type { Signal, ReadableSignal } from "semajsx/signal";
import type { JSXNode } from "semajsx";
import type { StyleToken } from "semajsx/style";
import type { AgentState, InboxItem, TodoItem } from "../api/types.ts";
import { inject } from "semajsx/style";
import * as styles from "./agent-inspector.style.ts";

// Eagerly inject CSS for styles used in classList manipulation
inject([styles.chevronOpen, styles.sectionBodyHidden]);

const stateClasses: Record<string, StyleToken> = {
  idle: styles.stateIdle,
  running: styles.stateRunning,
  processing: styles.stateProcessing,
  error: styles.stateError,
  completed: styles.stateCompleted,
  stopped: styles.stateIdle,
};

function CollapsibleSection(props: {
  title: string;
  countSuffix?: ReadableSignal<string>;
  defaultOpen?: boolean;
  children: JSXNode;
}) {
  let open = props.defaultOpen ?? true;
  let bodyEl: HTMLDivElement | null = null;
  let chevronEl: HTMLSpanElement | null = null;
  const hiddenClass = styles.sectionBodyHidden.toString();
  const chevronOpenClass = styles.chevronOpen.toString();

  function toggle() {
    open = !open;
    if (!bodyEl || !chevronEl) return;
    if (open) {
      bodyEl.classList.remove(hiddenClass);
      chevronEl.classList.add(chevronOpenClass);
    } else {
      bodyEl.classList.add(hiddenClass);
      chevronEl.classList.remove(chevronOpenClass);
    }
  }

  return (
    <div class={styles.section}>
      <div class={styles.sectionHeader} onclick={toggle}>
        <span>
          {props.title}
          {props.countSuffix ? <span class={styles.countSuffix}>{props.countSuffix}</span> : null}
        </span>
        <span
          class={[styles.chevron, open && styles.chevronOpen]}
          ref={(el: HTMLSpanElement | null) => {
            chevronEl = el;
          }}
        >
          <Icon icon={ChevronDown} size={14} />
        </span>
      </div>
      <div
        class={[styles.sectionBody, !open && styles.sectionBodyHidden]}
        ref={(el: HTMLDivElement | null) => {
          bodyEl = el;
        }}
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
  const inbox = computed(state, (s) => s?.inbox ?? []);
  const todos = computed(state, (s) => s?.todos ?? []);
  const inboxCount = computed(inbox, (items) => items.length);
  const todoCount = computed(todos, (items) => items.length);
  const inboxSuffix = computed(inboxCount, (n) => (n > 0 ? ` (${n})` : ""));
  const todoSuffix = computed(todoCount, (n) => (n > 0 ? ` (${n})` : ""));
  const stateDotClass = computed(stateText, (s) => [
    styles.stateDot,
    stateClasses[s] ?? styles.stateIdle,
  ]);
  const taskSuffix = computed(state, (s) => (s?.currentTask ? ` — ${s.currentTask}` : ""));

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
          <span class={stateDotClass} />
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
