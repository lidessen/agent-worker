/** @jsxImportSource semajsx/dom */

import { computed, signal } from "semajsx/signal";
import {
  chatTurns,
  chatThinking,
  chatPending,
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
  const pending = chatPending(wsKey);
  const error = chatError(wsKey);
  const loaded = chatLoaded(wsKey);
  const draft = signal("");

  const harnessInfo = computed(harnesses, (list) => list.find((h) => h.name === wsKey));

  const transcript = computed(
    [turns, thinking, pending, loaded],
    (list, isThinking, pend, isLoaded) => {
      if (!isLoaded && list.length === 0) {
        return <div class={s.empty}>Loading conversation…</div>;
      }
      if (list.length === 0 && !isThinking && !pend) {
        return <div class={s.empty}>No turns yet. Send a message to begin.</div>;
      }
      // Pending bubble is shown only when there's no committed
      // assistant turn waiting in `list` for this dispatch yet —
      // the dispatcher emits user_turn first (so list grows), then
      // chunks (which feed pending), then done (which appends the
      // assistant turn AND clears pending). A dangling pending +
      // committed-assistant overlap would render twice; the store
      // clears pending on done so that doesn't happen.
      const showPending = pend !== null && (pend.content !== "" || pend.error);
      return (
        <div class={s.transcript}>
          {list.map((t) => (
            <div class={[s.turn, t.role === "user" ? s.turnUser : s.turnAssistant]}>
              <span class={s.turnRoleLabel}>{t.role === "user" ? "you" : t.role}</span>
              <div class={[s.turnContent, t.error ? s.turnError : ""]}>
                {t.error ? `Error: ${t.error}` : t.content || "(empty)"}
              </div>
            </div>
          ))}
          {showPending ? (
            <div class={[s.turn, s.turnAssistant]}>
              <span class={s.turnRoleLabel}>assistant</span>
              <div class={[s.turnContent, pend!.error ? s.turnError : ""]}>
                {pend!.error
                  ? `Error: ${pend!.error}`
                  : pend!.content + (isThinking ? "▍" : "")}
              </div>
            </div>
          ) : null}
          {isThinking && !showPending ? (
            <div class={s.thinking}>
              <span class={s.thinkingDot} />
              <span class={s.thinkingDot} />
              <span class={s.thinkingDot} />
              <span>thinking…</span>
            </div>
          ) : null}
        </div>
      );
    },
  );

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
