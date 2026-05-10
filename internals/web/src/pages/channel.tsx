/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { computed } from "semajsx/signal";
import { route, navigate } from "../router.ts";
import {
  channelMessages,
  loadChannelHistory,
  startChannelStream,
  stopChannelStream,
  sendChannelMessage,
} from "../stores/channel.ts";
import { ChannelMessageList } from "../components/channel-message-list.tsx";
import { ChannelInput } from "../components/channel-input.tsx";
import * as styles from "./channel.style.ts";

export const ChannelPage: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
  const wsKey = computed(route, (r) => (r.page === "channel" ? r.params.key : ""));
  const ch = computed(route, (r) => (r.page === "channel" ? r.params.ch : ""));
  const channelTitle = computed(ch, (c) => `# ${c}`);

  let currentWs = "";
  let currentCh = "";
  let unsubRoute: (() => void) | null = null;
  let generation = 0;

  function initChannel(ws: string, channel: string) {
    if (!ws || !channel) return;
    if (ws === currentWs && channel === currentCh) return;

    if (currentCh) {
      stopChannelStream();
    }
    currentWs = ws;
    currentCh = channel;
    channelMessages.value = [];

    const thisGen = ++generation;
    loadChannelHistory(ws, channel).then(() => {
      if (generation !== thisGen) return;
      startChannelStream(ws, channel);
    });
  }

  initChannel(wsKey.value, ch.value);

  // Watch both wsKey and ch for changes
  const routeKey = computed(route, (r) =>
    r.page === "channel" ? `${r.params.key}/${r.params.ch}` : "",
  );
  unsubRoute = routeKey.subscribe(() => {
    initChannel(wsKey.value, ch.value);
  });

  ctx.onCleanup(() => {
    stopChannelStream();
    unsubRoute?.();
    unsubRoute = null;
    currentWs = "";
    currentCh = "";
  });

  function handleSend(text: string) {
    sendChannelMessage(wsKey.value, ch.value, text);
  }

  return (
    <div class={styles.page}>
      <div class={styles.header}>
        <button class={styles.backBtn} onclick={() => navigate(`/harnesss/${wsKey.value}`)}>
          Back
        </button>
        <div class={styles.headerInfo}>
          <span class={styles.channelName}>{channelTitle}</span>
          <span class={styles.wsLabel}>{wsKey}</span>
        </div>
      </div>

      <ChannelMessageList messages={channelMessages} />
      <ChannelInput onSend={handleSend} />
    </div>
  );
};
