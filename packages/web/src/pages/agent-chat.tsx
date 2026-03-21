/** @jsxImportSource semajsx/dom */

import { computed } from "semajsx/signal";
import { route, navigate } from "../router.ts";
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
} from "../stores/conversation.ts";
import { inject } from "semajsx/style";
import { tokens } from "../theme/tokens.ts";
import { EventList } from "../components/event-list.tsx";
import { ChatInput } from "../components/chat-input.tsx";
import { AgentInspector } from "../components/agent-inspector.tsx";
import * as styles from "./agent-chat.style.ts";

// Eagerly inject CSS for styles used in classList manipulation (not via JSX class prop)
inject([styles.inspectorCol, styles.inspectorColHidden, styles.inspectorToggleActive]);

const stateColors: Record<string, string> = {
  idle: tokens.colors.agentIdle,
  running: tokens.colors.agentRunning,
  processing: tokens.colors.agentRunning,
  error: tokens.colors.agentError,
  completed: tokens.colors.agentCompleted,
  stopped: tokens.colors.agentIdle,
};

export function AgentChatPage() {
  const name = computed(route, (r) =>
    r.page === "agent-chat" ? r.params.name : "",
  );

  const stateText = computed(agentState, (s) => s?.state ?? "unknown");
  const dotColor = computed(stateText, (s) => stateColors[s] ?? tokens.colors.agentIdle);
  const badgeDotStyle = computed(dotColor, (c) => `background: ${c}`);

  // Inspector toggle state
  let inspectorVisible = false;
  let inspectorEl: HTMLElement;
  let toggleBtnEl: HTMLElement;

  function toggleInspector() {
    inspectorVisible = !inspectorVisible;
    if (inspectorVisible) {
      inspectorEl.classList.remove(styles.inspectorColHidden);
      toggleBtnEl.classList.add(styles.inspectorToggleActive);
    } else {
      inspectorEl.classList.add(styles.inspectorColHidden);
      toggleBtnEl.classList.remove(styles.inspectorToggleActive);
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

  function cleanup() {
    stopStream();
    stopPolling();
    unsubRoute?.();
    unsubRoute = null;
    unsubClient();
    currentAgent = "";
  }

  // Cleanup when component is removed from DOM
  function setupCleanup(el: HTMLElement) {
    const observer = new MutationObserver(() => {
      if (!el.isConnected) {
        cleanup();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { subtree: true, childList: true });
  }

  return (
    <div class={styles.page} data-page="agent-chat" ref={(el: HTMLDivElement) => setupCleanup(el)}>
      <div class={styles.header}>
        <button class={styles.backBtn} onclick={() => navigate("/")}>
          Back
        </button>
        <div class={styles.headerInfo}>
          <span class={styles.agentName}>{name}</span>
          <div class={styles.badge}>
            <span class={styles.badgeDot} style={badgeDotStyle} />
            {stateText}
          </div>
        </div>
        <div class={styles.headerSpacer} />
        <button
          class={styles.inspectorToggle}
          ref={(el: HTMLElement) => { toggleBtnEl = el; }}
          onclick={toggleInspector}
        >
          Inspect
        </button>
      </div>

      <div class={styles.body}>
        <div class={styles.mainCol}>
          <EventList events={events} />
          <ChatInput agentName={name} />
        </div>
        <div
          class={[styles.inspectorCol, styles.inspectorColHidden]}
          ref={(el: HTMLElement) => { inspectorEl = el; }}
        >
          <AgentInspector agentState={agentState} />
        </div>
      </div>
    </div>
  );
}
