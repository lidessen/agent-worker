/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { Icon, MessageCircle } from "semajsx/icons";
import { computed } from "semajsx/signal";
import type { ReadableSignal } from "semajsx/signal";
import type { DaemonEvent } from "../api/types.ts";
import { TextBlock } from "./blocks/text-block.tsx";
import { ToolCallBlock } from "./blocks/tool-call-block.tsx";
import { RunBlock } from "./blocks/run-block.tsx";
import { ErrorBlock } from "./blocks/error-block.tsx";
import { UserMessageBlock } from "./blocks/user-message-block.tsx";
import { ThinkingBlock } from "./blocks/thinking-block.tsx";
import { formatDateTime } from "../utils/time.ts";
import * as styles from "./event-list.style.ts";

function isTextEvent(event: DaemonEvent): boolean {
  const t = event.type;
  return (
    t === "text" ||
    t === "response" ||
    t === "harness.agent_text" ||
    (t.includes("text") && !t.includes("tool"))
  );
}

function isToolCallEvent(event: DaemonEvent): boolean {
  const t = event.type;
  return (
    t === "tool_call" ||
    t === "tool_call_start" ||
    t === "tool_call_end" ||
    t === "tool_use" ||
    t === "harness.agent_tool_call" ||
    t.includes("tool_call") ||
    t.includes("tool_use")
  );
}

function isRunEvent(event: DaemonEvent): boolean {
  const t = event.type;
  return (
    t === "run_start" ||
    t === "run_end" ||
    t === "harness.agent_run_start" ||
    t === "harness.agent_run_end"
  );
}

function isErrorEvent(event: DaemonEvent): boolean {
  const t = event.type;
  return t === "error" || t === "harness.agent_error" || t.includes("error");
}

function isUserMessage(event: DaemonEvent): boolean {
  return event.type === "user_message";
}

function isThinkingEvent(event: DaemonEvent): boolean {
  return event.type === "thinking";
}

function isSkippedEvent(event: DaemonEvent): boolean {
  // Events that are informational / not rendered
  const t = event.type;
  return t === "context_assembled" || t === "send" || t === "unknown";
}

function renderEvent(event: DaemonEvent) {
  if (isUserMessage(event)) return <UserMessageBlock event={event} />;
  if (isErrorEvent(event)) return <ErrorBlock event={event} />;
  if (isThinkingEvent(event)) return <ThinkingBlock event={event} />;
  if (isToolCallEvent(event)) return <ToolCallBlock event={event} />;
  if (isRunEvent(event)) return <RunBlock event={event} />;
  if (isTextEvent(event)) return <TextBlock event={event} />;
  if (isSkippedEvent(event)) return null;
  // Fallback: treat as text if it has text/content, otherwise skip
  if (event.text || event.content) return <TextBlock event={event} />;
  return null;
}

function eventLabel(event: DaemonEvent): string {
  if (isUserMessage(event)) return "User";
  if (isErrorEvent(event)) return "Error";
  if (isThinkingEvent(event)) return "Thinking";
  if (isToolCallEvent(event)) return "Tool";
  if (isRunEvent(event)) return "Run";
  if (isTextEvent(event)) return "Response";
  return "Event";
}

export const EventList: RuntimeComponent<{
  events: ReadableSignal<DaemonEvent[]>;
  agentName?: ReadableSignal<string>;
}> = (
  props: { events: ReadableSignal<DaemonEvent[]>; agentName?: ReadableSignal<string> },
  ctx,
) => {
  let scrollRef: HTMLDivElement | null = null;
  let scrollListenerTarget: HTMLDivElement | null = null;
  let userScrolledUp = false;

  function handleScroll() {
    if (!scrollRef) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollRef;
    userScrolledUp = scrollTop + clientHeight < scrollHeight - 50;
  }

  function scrollToBottom() {
    if (scrollRef && !userScrolledUp) {
      scrollRef.scrollTo({ top: scrollRef.scrollHeight });
    }
  }

  // Subscribe to events signal for auto-scroll
  const unsub = props.events.subscribe(() => {
    // Defer scroll to after DOM update
    queueMicrotask(scrollToBottom);
  });
  ctx.onCleanup(unsub);
  ctx.onCleanup(() => {
    if (scrollListenerTarget) {
      scrollListenerTarget.removeEventListener("scroll", handleScroll);
      scrollListenerTarget = null;
    }
  });

  const body = computed(props.events, (list) => {
    if (list.length === 0) {
      const agentLabel = props.agentName ? props.agentName.value : "this agent";
      return (
        <div class={styles.empty}>
          <div class={styles.emptyContent}>
            <div class={styles.emptyIcon}>
              <Icon icon={MessageCircle} size={32} />
            </div>
            <div class={styles.emptyText}>
              Send a message to start interacting with {agentLabel}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class={styles.inner}>
        {list.map((event) => {
          const body = renderEvent(event);
          if (!body) return null;
          return (
            <div class={styles.item}>
              <div class={styles.itemMeta}>
                <span class={styles.itemDot} />
                <span class={styles.itemLabel}>{eventLabel(event)}</span>
                <span class={styles.itemTime}>{formatDateTime(event.ts)}</span>
              </div>
              <div class={styles.itemBody}>{body}</div>
            </div>
          );
        })}
      </div>
    );
  });

  return (
    <div
      class={styles.container}
      ref={(el: HTMLDivElement | null) => {
        if (scrollListenerTarget) {
          scrollListenerTarget.removeEventListener("scroll", handleScroll);
          scrollListenerTarget = null;
        }
        scrollRef = el;
        if (!el) return;
        el.addEventListener("scroll", handleScroll, { passive: true });
        scrollListenerTarget = el;
      }}
    >
      {body}
    </div>
  );
};
