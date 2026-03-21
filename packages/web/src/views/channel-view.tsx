/** @jsxImportSource semajsx/dom */

import { signal, computed } from "semajsx/signal";
import { onCleanup } from "semajsx/dom";
import {
  channelMessages,
  loadChannelHistory,
  startChannelStream,
  stopChannelStream,
  sendChannelMessage,
} from "../stores/channel.ts";
import { ChannelMessageList } from "../components/channel-message-list.tsx";
import { ChannelInput } from "../components/channel-input.tsx";
import { parsePlatformName } from "../components/brand-icons.tsx";
import * as styles from "./channel-view.style.ts";

export function ChannelView(props: { wsKey: string; channel: string }) {
  const parsed = parsePlatformName(props.channel);
  const channelTitle = `# ${parsed.name}`;

  // Initialize channel stream
  channelMessages.value = [];

  let cancelled = false;

  loadChannelHistory(props.wsKey, props.channel).then(() => {
    if (!cancelled) startChannelStream(props.wsKey, props.channel);
  });

  onCleanup(() => {
    cancelled = true;
    stopChannelStream();
  });

  function handleSend(text: string) {
    sendChannelMessage(props.wsKey, props.channel, text);
  }

  return (
    <div class={styles.container}>
      <div class={styles.header}>
        <div class={styles.headerInfo}>
          <span class={styles.channelName}>
            {channelTitle}
            {parsed.icon ? parsed.icon({ size: 14 }) : null}
          </span>
          <span class={styles.wsLabel}>{props.wsKey}</span>
        </div>
      </div>

      <ChannelMessageList messages={channelMessages} />
      <ChannelInput onSend={handleSend} />
    </div>
  );
}
