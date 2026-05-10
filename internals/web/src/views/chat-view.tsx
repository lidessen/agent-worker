/** @jsxImportSource semajsx/dom */

import { computed, signal } from "semajsx/signal";
import {
  chatTurns,
  chatThinking,
  chatError,
  chatLoaded,
  loadConversation,
  sendChatTurn,
} from "../stores/chat.ts";
import { harnesses } from "../stores/harnesses.ts";
import * as s from "./chat-view.style.ts";

export function ChatView(props: { wsKey: string }) {
  const { wsKey } = props;

  // Bootstrap: load history once.
  void loadConversation(wsKey);

  const turns = chatTurns(wsKey);
  const thinking = chatThinking(wsKey);
  const error = chatError(wsKey);
  const loaded = chatLoaded(wsKey);
  const draft = signal("");

  const harnessInfo = computed(harnesses, (list) => list.find((h) => h.name === wsKey));

  const transcript = computed([turns, thinking, loaded], (list, isThinking, isLoaded) => {
    if (!isLoaded && list.length === 0) {
      return <div class={s.empty}>Loading conversation…</div>;
    }
    if (list.length === 0 && !isThinking) {
      return <div class={s.empty}>No turns yet. Send a message to begin.</div>;
    }
    return (
      <div class={s.transcript}>
        {list.map((t) => (
          <div class={[s.turn, t.role === "user" ? s.turnUser : s.turnAssistant]}>
            <span class={s.turnRoleLabel}>
              {t.role === "user" ? "you" : t.role}
            </span>
            <div class={[s.turnContent, t.error ? s.turnError : ""]}>
              {t.error ? `Error: ${t.error}` : t.content || "(empty)"}
            </div>
          </div>
        ))}
        {isThinking ? (
          <div class={s.thinking}>
            <span class={s.thinkingDot} />
            <span class={s.thinkingDot} />
            <span class={s.thinkingDot} />
            <span>thinking…</span>
          </div>
        ) : null}
      </div>
    );
  });

  const errorBanner = computed(error, (err) =>
    err ? <div class={[s.turnContent, s.turnError]}>{`Error: ${err}`}</div> : null,
  );

  function submit() {
    const text = draft.value.trim();
    if (!text || thinking.value) return;
    draft.value = "";
    void sendChatTurn(wsKey, text);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div class={s.view}>
      <div class={s.header}>
        <div class={s.title}>{computed(harnessInfo, (info) => info?.label || info?.name || wsKey)}</div>
        <div class={s.subtitle}>
          single-agent chat · {computed(harnessInfo, (info) => info?.harnessTypeId ?? "—")}
        </div>
      </div>
      {transcript}
      {errorBanner}
      <div class={s.footer}>
        <textarea
          class={s.input}
          placeholder="Send a message…"
          oninput={(e) => (draft.value = (e.target as HTMLTextAreaElement).value)}
          onkeydown={onKey}
          value={draft}
        />
        <div class={s.inputHint}>
          <span>Ctrl/Cmd+Enter to send</span>
          <button
            class={s.submit}
            onclick={submit}
            disabled={computed(thinking, (t) => t)}
          >
            {computed(thinking, (t) => (t ? "Thinking…" : "Send"))}
          </button>
        </div>
      </div>
    </div>
  );
}
