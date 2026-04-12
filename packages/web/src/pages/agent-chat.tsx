/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { computed } from "semajsx/signal";
import { route, navigate } from "../router.ts";
import { client } from "../stores/connection.ts";
import { fetchAgentState, agentState, startPolling, stopPolling } from "../stores/agents.ts";
import {
  events,
  loadHistory,
  startStream,
  stopStream,
  sendError,
  streamError,
} from "../stores/conversation.ts";
import { inject } from "semajsx/style";
import { EventList } from "../components/event-list.tsx";
import { ChatInput } from "../components/chat-input.tsx";
import { AgentInspector } from "../components/agent-inspector.tsx";
import * as styles from "./agent-chat.style.ts";

// Eagerly inject CSS for styles used in classList manipulation (not via JSX class prop)
inject([styles.inspectorCol, styles.inspectorColHidden, styles.inspectorToggleActive]);

function SendErrorBar() {
  const visible = computed(sendError, (e) => e !== null);
  const text = computed(sendError, (e) => e ?? "");

  const el = computed(visible, (show) => {
    if (!show) return null;
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => {
      sendError.value = null;
    }, 5000);
    // Clean up if dismissed manually before timeout
    void timer;
    return (
      <div class={styles.sendErrorBar}>
        <span>{text}</span>
        <button
          class={styles.sendErrorDismiss}
          onclick={() => {
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

export const AgentChatPage: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
  const name = computed(route, (r) => (r.page === "agent-chat" ? r.params.name : ""));

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

  // Inspector toggle state
  let inspectorVisible = false;
  let inspectorEl: HTMLDivElement | null = null;
  let toggleBtnEl: HTMLButtonElement | null = null;
  const inspectorHiddenClass = styles.inspectorColHidden.toString();
  const inspectorToggleActiveClass = styles.inspectorToggleActive.toString();

  function toggleInspector() {
    inspectorVisible = !inspectorVisible;
    if (!inspectorEl || !toggleBtnEl) return;
    if (inspectorVisible) {
      inspectorEl.classList.remove(inspectorHiddenClass);
      toggleBtnEl.classList.add(inspectorToggleActiveClass);
    } else {
      inspectorEl.classList.add(inspectorHiddenClass);
      toggleBtnEl.classList.remove(inspectorToggleActiveClass);
    }
  }

  // Track the current agent to handle route changes
  let currentAgent = "";
  let unsubRoute: (() => void) | null = null;
  let generation = 0;

  function initAgent(agentName: string, force = false) {
    if (!agentName) return;
    if (agentName === currentAgent && !force) return;
    // Clean up previous
    if (currentAgent) {
      stopStream();
      stopPolling();
    }
    currentAgent = agentName;
    // Reset events for new agent
    events.value = [];
    fetchAgentState(agentName);
    startPolling(agentName);
    const thisGen = ++generation;
    loadHistory(agentName).then(() => {
      if (generation !== thisGen) return; // navigated away, skip
      startStream(agentName);
    });
  }

  // Init with current name
  initAgent(name.value);

  // Watch for route changes (agent name changes)
  unsubRoute = name.subscribe((newName) => {
    initAgent(newName);
  });

  // Retry init when client connects (handles race with auto-connect)
  const unsubClient = client.subscribe((c) => {
    if (c && name.value && events.value.length === 0) {
      initAgent(name.value, true);
    }
  });

  ctx.onCleanup(() => {
    stopStream();
    stopPolling();
    unsubRoute?.();
    unsubRoute = null;
    unsubClient();
    currentAgent = "";
  });

  return (
    <div class={styles.page} data-page="agent-chat">
      <div class={styles.header}>
        <button class={styles.backBtn} onclick={() => navigate("/")}>
          Back
        </button>
        <div class={styles.headerInfo}>
          <span class={styles.agentName}>{name}</span>
          <div class={styles.badge}>
            <span class={badgeDotClass} />
            {stateText}
          </div>
        </div>
        <div class={styles.headerSpacer} />
        <button
          class={styles.inspectorToggle}
          ref={(el: HTMLButtonElement | null) => {
            toggleBtnEl = el;
          }}
          onclick={toggleInspector}
        >
          Inspect
        </button>
      </div>

      <div class={styles.body}>
        <div class={styles.mainCol}>
          <StreamErrorBanner />
          <EventList events={events} agentName={name} />
          <SendErrorBar />
          <ChatInput agentName={name} />
        </div>
        <div
          class={[styles.inspectorCol, styles.inspectorColHidden]}
          ref={(el: HTMLDivElement | null) => {
            inspectorEl = el;
          }}
        >
          <AgentInspector agentState={agentState} />
        </div>
      </div>
    </div>
  );
};
