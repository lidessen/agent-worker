/** @jsxImportSource semajsx/dom */

import { isChannelStreaming } from "../stores/channel.ts";
import * as styles from "./chat-input.style.ts";

export function ChannelInput(props: { onSend: (text: string) => void }) {
  let textareaRef: HTMLTextAreaElement | null = null;

  function autoResize() {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = textareaRef.scrollHeight + "px";
  }

  function handleSend() {
    if (!textareaRef) return;
    const text = textareaRef.value.trim();
    if (!text) return;

    props.onSend(text);
    textareaRef.value = "";
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
      <textarea
        class={styles.textarea}
        placeholder="Type a message... (Ctrl+Enter to send)"
        rows={1}
        disabled={isChannelStreaming}
        oninput={autoResize}
        onkeydown={handleKeydown}
        ref={(el: HTMLTextAreaElement) => {
          textareaRef = el;
        }}
      />
      <button
        class={styles.sendBtn}
        onclick={handleSend}
        disabled={isChannelStreaming}
      >
        Send
      </button>
    </div>
  );
}
