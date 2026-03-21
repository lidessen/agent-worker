/** @jsxImportSource semajsx/dom */

import { Icon, ArrowUp } from "@semajsx/icons";
import { computed, signal } from "semajsx/signal";
import type { ReadableSignal } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import { isStreaming, sendMessage } from "../stores/conversation.ts";
import * as styles from "./chat-input.style.ts";

export function ChatInput(props: { agentName: ReadableSignal<string> }) {
  let textareaRef: HTMLTextAreaElement | null = null;
  let sendBtnRef: HTMLButtonElement | null = null;
  const draft = signal("");
  const canSend = computed([draft, isStreaming], (text, streaming) =>
    text.trim().length > 0 && !streaming,
  );

  function syncControls() {
    if (textareaRef) textareaRef.disabled = isStreaming.value;
    if (sendBtnRef) sendBtnRef.disabled = !canSend.value;
  }

  function autoResize() {
    if (!textareaRef) return;
    textareaRef.style.height = "auto";
    textareaRef.style.height = textareaRef.scrollHeight + "px";
  }

  function handleSend() {
    if (!textareaRef) return;
    const text = draft.value.trim();
    if (!text || isStreaming.value) return;

    sendMessage(props.agentName.value, text);
    textareaRef.value = "";
    draft.value = "";
    autoResize();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Ctrl+Enter or Cmd+Enter to send
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const unsubDraft = draft.subscribe(syncControls);
  const unsubStreaming = isStreaming.subscribe(syncControls);
  onCleanup(() => {
    unsubDraft();
    unsubStreaming();
  });

  return (
    <div class={styles.bar}>
      <div class={styles.composer}>
        <textarea
          class={styles.textarea}
          placeholder="Ask Codex anything, @ to add files, / for commands, $ for skills"
          rows={1}
          oninput={(e: Event) => {
            draft.value = (e.target as HTMLTextAreaElement).value;
            autoResize();
          }}
          onkeydown={handleKeydown}
          ref={(el: HTMLTextAreaElement) => {
            textareaRef = el;
            syncControls();
          }}
        />
        <div class={styles.footer}>
          <span class={styles.shortcut}>Ctrl+Enter to send</span>
          <button
            class={styles.sendBtn}
            onclick={handleSend}
            type="button"
            ref={(el: HTMLButtonElement) => {
              sendBtnRef = el;
              syncControls();
            }}
          >
            <Icon icon={ArrowUp} size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
