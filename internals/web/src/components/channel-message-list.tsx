/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { Icon, MessageCircle } from "semajsx/icons";
import { computed } from "semajsx/signal";
import type { ReadableSignal } from "semajsx/signal";
import type { ChannelMessage } from "../api/types.ts";
import { ChannelMessageItem } from "./channel-message.tsx";
import * as styles from "./event-list.style.ts";

export const ChannelMessageList: RuntimeComponent<{
  messages: ReadableSignal<ChannelMessage[]>;
}> = (props, ctx) => {
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

  const unsub = props.messages.subscribe(() => {
    queueMicrotask(scrollToBottom);
  });
  ctx.onCleanup(unsub);
  ctx.onCleanup(() => {
    if (scrollListenerTarget) {
      scrollListenerTarget.removeEventListener("scroll", handleScroll);
      scrollListenerTarget = null;
    }
  });

  const body = computed(props.messages, (list) => {
    if (list.length === 0) {
      return (
        <div class={styles.empty}>
          <div class={styles.emptyContent}>
            <div class={styles.emptyIcon}>
              <Icon icon={MessageCircle} size={32} />
            </div>
            <div class={styles.emptyText}>Start the thread with the first channel message.</div>
          </div>
        </div>
      );
    }
    return list.map((msg) => <ChannelMessageItem message={msg} />);
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
