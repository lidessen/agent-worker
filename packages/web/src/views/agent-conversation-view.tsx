/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import { client } from "../stores/connection.ts";
import {
  fetchAgentState,
  agentState,
  startPolling,
  stopPolling,
} from "../stores/agents.ts";
import {
  events,
  loadHistory,
  startStream,
  stopStream,
  sendError,
  streamError,
} from "../stores/conversation.ts";
import { showAgentInfo } from "../stores/navigation.ts";
import { EventList } from "../components/event-list.tsx";
import { ChatInput } from "../components/chat-input.tsx";
import * as styles from "./agent-conversation-view.style.ts";

function SendErrorBar() {
  const visible = computed(sendError, (e) => e !== null);
  const text = computed(sendError, (e) => e ?? "");

  let dismissTimer: ReturnType<typeof setTimeout> | null = null;
  const el = computed(visible, (show) => {
    if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
    if (!show) return null;
    dismissTimer = setTimeout(() => {
      sendError.value = null;
    }, 5000);
    return (
      <div class={styles.sendErrorBar}>
        <span>{text}</span>
        <button
          class={styles.sendErrorDismiss}
          onclick={() => {
            if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
            sendError.value = null;
          }}
        >
          ×
        </button>
      </div>
    );
  });

  return el;
}

function StreamErrorBanner() {
  return computed(streamError, (err) => {
    if (!err) return null;
    return <div class={styles.streamErrorBar}>{err}</div>;
  });
}

export function AgentConversationView(props: { name: string }) {
  const name = signal(props.name);

  const stateText = computed(agentState, (s) => s?.state ?? "unknown");
  const badgeDotClass = computed(stateText, (state) => [
    styles.badgeDot,
    state === "running" || state === "processing"
      ? styles.badgeDotRunning
      : state === "error"
        ? styles.badgeDotError
        : state === "completed"
          ? styles.badgeDotCompleted
          : styles.badgeDotIdle,
  ]);
  const wsLabel = computed(agentState, (s) => s?.workspace ?? "");

  let generation = 0;

  // Initialize agent conversation
  events.value = [];
  fetchAgentState(props.name);
  startPolling(props.name);

  const thisGen = ++generation;
  loadHistory(props.name).then(() => {
    if (generation !== thisGen) return;
    startStream(props.name);
  });

  // Retry init when client connects (handles race with auto-connect)
  const unsubClient = client.subscribe((c) => {
    if (c && events.value.length === 0) {
      generation++;
      const g = generation;
      events.value = [];
      fetchAgentState(props.name);
      startPolling(props.name);
      loadHistory(props.name).then(() => {
        if (generation !== g) return;
        startStream(props.name);
      });
    }
  });

  onCleanup(() => {
    stopStream();
    stopPolling();
    unsubClient();
    generation++;
  });

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <div class={styles.headerInfo}>
          <span
            class={styles.agentName}
            onclick={() => showAgentInfo(props.name)}
          >
            {props.name}
          </span>
          <div class={styles.badge}>
            <span class={badgeDotClass} />
            {stateText}
          </div>
          {computed(wsLabel, (ws) =>
            ws ? <span class={styles.wsLabel}>{ws}</span> : null,
          )}
        </div>
      </div>

      <div class={styles.body}>
        <StreamErrorBanner />
        <EventList events={events} agentName={name} />
        <SendErrorBar />
        <ChatInput agentName={name} />
      </div>
    </div>
  );
}
