/** @jsxImportSource semajsx/dom */

import type { ReadableSignal } from "semajsx/signal";
import { isStreaming, sendMessage } from "../stores/conversation.ts";
import * as styles from "./chat-input.style.ts";

export function ChatInput(props: { agentName: ReadableSignal<string> }) {
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
    if (isStreaming.value) return;

    sendMessage(props.agentName.value, text);
    textareaRef.value = "";
    autoResize();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Ctrl+Enter or Cmd+Enter to send
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
        disabled={isStreaming}
        oninput={autoResize}
        onkeydown={handleKeydown}
        ref={(el: HTMLTextAreaElement) => {
          textareaRef = el;
        }}
      />
      <button
        class={styles.sendBtn}
        onclick={handleSend}
        disabled={isStreaming}
      >
        Send
      </button>
    </div>
  );
}
