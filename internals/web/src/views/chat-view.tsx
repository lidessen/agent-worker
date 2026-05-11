/** @jsxImportSource semajsx/dom */

import { computed, signal } from "semajsx/signal";
import {
  chatTurns,
  chatThinking,
  chatPending,
  chatError,
  chatLoaded,
  chatInfo,
  chatUsage,
  loadConversation,
  sendChatTurn,
} from "../stores/chat.ts";
import { harnesses } from "../stores/harnesses.ts";
import type { ChatActivity } from "../stores/chat.ts";
import * as s from "./chat-view.style.ts";

/**
 * Distil a tool call's args into a single short line for the activity
 * feed. Tools have wildly different arg shapes (Claude Code's `Edit`
 * carries entire file contents; Codex's `shell` carries a `cmd` array),
 * so we pick the field most useful to a reader and cap at 120 chars.
 * Anything we don't recognise falls back to the tool name only.
 */
function summarizeActivity(a: ChatActivity): string {
  const args = a.args ?? {};
  const name = a.name.toLowerCase();
  const pick = (val: unknown): string | null => {
    if (typeof val === "string") return val;
    if (Array.isArray(val)) return val.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(" ");
    return null;
  };
  if (name === "bash" || name === "shell" || name === "exec") {
    const cmd = pick((args as Record<string, unknown>).command) ?? pick((args as Record<string, unknown>).cmd);
    if (cmd) return cmd;
  }
  if (name === "read" || name === "write" || name === "edit" || name === "multiedit") {
    const p = pick((args as Record<string, unknown>).file_path) ?? pick((args as Record<string, unknown>).path);
    if (p) return p;
  }
  if (name === "grep" || name === "glob") {
    const p =
      pick((args as Record<string, unknown>).pattern) ??
      pick((args as Record<string, unknown>).query);
    if (p) return p;
  }
  // Generic fallback: take the first string-ish field.
  for (const v of Object.values(args)) {
    const s = pick(v);
    if (s) return s;
  }
  return "";
}

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return text.slice(0, n - 1) + "…";
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ChatView(props: { wsKey: string }) {
  const { wsKey } = props;

  // Bootstrap: load history once.
  void loadConversation(wsKey);

  const turns = chatTurns(wsKey);
  const thinking = chatThinking(wsKey);
  const pending = chatPending(wsKey);
  const error = chatError(wsKey);
  const loaded = chatLoaded(wsKey);
  const info = chatInfo(wsKey);
  const usage = chatUsage(wsKey);
  const draft = signal("");

  // Auto-scroll the transcript to the bottom on new content, but
  // only when the user is already near the bottom — don't yank them
  // away from older content they're reading. Stickiness threshold:
  // 120px from the bottom counts as "following along".
  function maybeScrollDown() {
    const el = document.querySelector("." + s.transcript);
    if (!(el instanceof HTMLElement)) return;
    const dist = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (dist < 120) {
      el.scrollTop = el.scrollHeight;
    }
  }
  function forceScrollDown() {
    const el = document.querySelector("." + s.transcript);
    if (!(el instanceof HTMLElement)) return;
    el.scrollTop = el.scrollHeight;
  }
  // Force scroll on initial load (history just arrived); keep
  // sticky behavior on subsequent updates.
  loaded.subscribe((isLoaded) => {
    if (isLoaded) requestAnimationFrame(forceScrollDown);
  });
  turns.subscribe(() => requestAnimationFrame(maybeScrollDown));
  pending.subscribe(() => requestAnimationFrame(maybeScrollDown));

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
      const activities = pend?.activities ?? [];
      const hasActivities = activities.length > 0;
      const hasText = pend !== null && pend.content !== "";
      const showPending = pend !== null && (hasText || pend.error || hasActivities);
      const renderActivities = () =>
        hasActivities ? (
          <div class={s.activities}>
            {activities.map((a) => {
              const cls =
                a.status === "running"
                  ? s.activityRunning
                  : a.status === "error"
                    ? s.activityError
                    : s.activityDone;
              const summary = truncate(summarizeActivity(a), 120);
              const time = formatDuration(a.durationMs);
              const prefix =
                a.status === "running" ? "→" : a.status === "error" ? "×" : "✓";
              return (
                <div class={[s.activity, cls]}>
                  <span>{prefix}</span>
                  <span class={s.activityName}>{a.name}</span>
                  <span class={s.activitySummary}>{summary || a.error || ""}</span>
                  {time ? <span class={s.activityTime}>{time}</span> : null}
                </div>
              );
            })}
          </div>
        ) : null;
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
              {renderActivities()}
              {hasText || pend!.error ? (
                <div class={[s.turnContent, pend!.error ? s.turnError : ""]}>
                  {pend!.error
                    ? `Error: ${pend!.error}`
                    : pend!.content + (isThinking ? "▍" : "")}
                </div>
              ) : null}
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
          {computed(info, (i) => {
            if (!i) return "single-agent chat · loading…";
            const parts = [`@${i.agentName}`, i.runtime];
            if (i.model?.full) parts.push(i.model.full);
            return parts.join(" · ");
          })}
        </div>
        {computed(info, (i) =>
          i?.cwd ? <div class={s.subtitle}>cwd: {i.cwd}</div> : null,
        )}
        {computed(usage, (u) =>
          u.turns > 0 ? (
            <div class={s.subtitle}>
              session: {u.turns} turn{u.turns === 1 ? "" : "s"} · {u.totalTokens.toLocaleString()}{" "}
              tokens ({u.inputTokens.toLocaleString()} in / {u.outputTokens.toLocaleString()} out)
            </div>
          ) : null,
        )}
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
