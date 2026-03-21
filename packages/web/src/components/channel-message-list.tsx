/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import type { ReadableSignal } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import type { ChannelMessage } from "../api/types.ts";
import { ChannelMessageItem } from "./channel-message.tsx";
import * as styles from "./event-list.style.ts";

export function ChannelMessageList(props: {
  messages: ReadableSignal<ChannelMessage[]>;
}) {
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

  const unsub = props.messages.subscribe(() => {
    queueMicrotask(scrollToBottom);
  });
  onCleanup(unsub);

  const body = computed(props.messages, (list) => {
    if (list.length === 0) {
      return <div class={styles.empty}>No messages yet</div>;
    }
    return list.map((msg) => <ChannelMessageItem message={msg} />);
  });

  return (
    <div
      class={styles.container}
      ref={(el: HTMLDivElement) => {
        scrollRef = el;
        el.addEventListener("scroll", handleScroll, { passive: true });
      }}
    >
      {body}
    </div>
  );
}
