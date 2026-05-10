/** @jsxImportSource @semajsx/dom */

import { computed } from "@semajsx/signal";
import type { ReadableSignal } from "@semajsx/signal";
import * as styles from "./chat-input.style";

export interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean | ReadableSignal<boolean>;
  placeholder?: string;
  class?: string;
}

export function ChatInput(props: ChatInputProps) {
  let textareaRef: HTMLTextAreaElement | null = null;

  const placeholder = props.placeholder ?? "Type a message... (Ctrl+Enter to send)";

  function isDisabled(): boolean {
    const d = props.disabled;
    if (d === undefined || d === false) return false;
    if (d === true) return true;
    // ReadableSignal<boolean>
    return (d as ReadableSignal<boolean>).value;
  }

  function autoResize() {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = textareaRef.scrollHeight + "px";
  }

  function handleSend() {
    if (!textareaRef) return;
    const text = textareaRef.value.trim();
    if (!text) return;
    if (isDisabled()) return;

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

  // Build disabled accessor for the JSX attribute
  const disabledAttr =
    typeof props.disabled === "object" && props.disabled !== null && "value" in props.disabled
      ? computed(props.disabled as ReadableSignal<boolean>, Boolean)
      : !!props.disabled;

  return (
    <div class={props.class ? `${styles.bar} ${props.class}` : styles.bar}>
      <textarea
        class={styles.textarea}
        placeholder={placeholder}
        rows={1}
        disabled={disabledAttr}
        oninput={autoResize}
        onkeydown={handleKeydown}
        ref={(el: HTMLTextAreaElement | null) => {
          textareaRef = el;
        }}
      />
      <button class={styles.sendBtn} onclick={handleSend} disabled={disabledAttr}>
        Send
      </button>
    </div>
  );
}
