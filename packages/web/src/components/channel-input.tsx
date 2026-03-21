/** @jsxImportSource semajsx/dom */

import { Icon, ArrowUp } from "@semajsx/icons";
import { computed, signal } from "semajsx/signal";
import { isChannelStreaming } from "../stores/channel.ts";
import * as styles from "./chat-input.style.ts";

export function ChannelInput(props: { onSend: (text: string) => void }) {
  let textareaRef: HTMLTextAreaElement | null = null;
  const draft = signal("");
  const canSend = computed([draft, isChannelStreaming], (text, streaming) =>
    text.trim().length > 0 && !streaming,
  );

  function autoResize() {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = textareaRef.scrollHeight + "px";
  }

  function handleSend() {
    if (!textareaRef) return;
    const text = draft.value.trim();
    if (!text) return;

    props.onSend(text);
    textareaRef.value = "";
    draft.value = "";
    autoResize();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div class={styles.bar}>
      <div class={styles.composer}>
        <textarea
          class={styles.textarea}
          placeholder="Message this channel"
          rows={1}
          disabled={isChannelStreaming}
          oninput={(e: Event) => {
            draft.value = (e.target as HTMLTextAreaElement).value;
            autoResize();
          }}
          onkeydown={handleKeydown}
          ref={(el: HTMLTextAreaElement) => {
            textareaRef = el;
          }}
        />
        <div class={styles.footer}>
          <span class={styles.shortcut}>Ctrl+Enter to send</span>
          <button
            class={styles.sendBtn}
            onclick={handleSend}
            disabled={computed(canSend, (ready) => !ready)}
            type="button"
          >
            <Icon icon={ArrowUp} size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
