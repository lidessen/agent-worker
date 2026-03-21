/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import type { ReadableSignal } from "semajsx/signal";
import type { DaemonEvent } from "../api/types.ts";
import { TextBlock } from "./blocks/text-block.tsx";
import { ToolCallBlock } from "./blocks/tool-call-block.tsx";
import { RunBlock } from "./blocks/run-block.tsx";
import { ErrorBlock } from "./blocks/error-block.tsx";
import { UserMessageBlock } from "./blocks/user-message-block.tsx";
import { ThinkingBlock } from "./blocks/thinking-block.tsx";
import * as styles from "./event-list.style.ts";

function isTextEvent(event: DaemonEvent): boolean {
  const t = event.type;
  return (
    t === "text" ||
    t === "response" ||
    t === "workspace.agent_text" ||
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
    t === "workspace.agent_tool_call" ||
    t.includes("tool_call") ||
    t.includes("tool_use")
  );
}

function isRunEvent(event: DaemonEvent): boolean {
  const t = event.type;
  return (
    t === "run_start" ||
    t === "run_end" ||
    t === "workspace.agent_run_start" ||
    t === "workspace.agent_run_end"
  );
}

function isErrorEvent(event: DaemonEvent): boolean {
  const t = event.type;
  return (
    t === "error" ||
    t === "workspace.agent_error" ||
    t.includes("error")
  );
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
  return (
    t === "context_assembled" ||
    t === "send" ||
    t === "unknown"
  );
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

export function EventList(props: { events: ReadableSignal<DaemonEvent[]> }) {
  let scrollRef: HTMLDivElement | null = null;
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
  let unsub: (() => void) | null = null;

  function setupSubscription() {
    unsub = props.events.subscribe(() => {
      // Defer scroll to after DOM update
      queueMicrotask(scrollToBottom);
    });
  }

  function teardown() {
    unsub?.();
    unsub = null;
  }

  setupSubscription();

  const body = computed(props.events, (list) => {
    if (list.length === 0) {
      return <div class={styles.empty}>No messages yet</div>;
    }
    return list.map((event) => renderEvent(event));
  });

  return (
    <div
      class={styles.container}
      ref={(el: HTMLDivElement | null) => {
        scrollRef = el;
        if (!el) return;
        el.addEventListener("scroll", handleScroll, { passive: true });
        // Watch document.body to detect when this element is disconnected
        const observer = new MutationObserver(() => {
          if (!el.isConnected) {
            teardown();
            observer.disconnect();
          }
        });
        observer.observe(document.body, { subtree: true, childList: true });
      }}
    >
      {body}
    </div>
  );
}
