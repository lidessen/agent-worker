/** @jsxImportSource semajsx/dom */

import type { RuntimeComponent } from "semajsx";
import { signal } from "semajsx/signal";
import {
  channelMessages,
  loadChannelHistory,
  startChannelStream,
  stopChannelStream,
  sendChannelMessage,
} from "../stores/channel.ts";
import { client } from "../stores/connection.ts";
import { ChannelMessageList } from "../components/channel-message-list.tsx";
import { ChannelInput } from "../components/channel-input.tsx";
import { ConfirmDialog } from "../components/confirm-dialog.tsx";
import { parsePlatformName } from "../components/brand-icons.tsx";
import * as styles from "./channel-view.style.ts";

export const ChannelView: RuntimeComponent<{ wsKey: string; channel: string }> = (props, ctx) => {
  const parsed = parsePlatformName(props.channel);
  const channelTitle = `# ${parsed.name}`;
  const showClearConfirm = signal(false);

  // Initialize channel stream
  channelMessages.value = [];

  let cancelled = false;

  loadChannelHistory(props.wsKey, props.channel).then(() => {
    if (!cancelled) startChannelStream(props.wsKey, props.channel);
  });

  ctx.onCleanup(() => {
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
        <div class={styles.headerActions}>
          <button class={styles.clearBtn} onclick={() => (showClearConfirm.value = true)}>
            Clear
          </button>
        </div>
      </div>

      <ChannelMessageList messages={channelMessages} />
      <ChannelInput onSend={handleSend} />

      <ConfirmDialog
        visible={showClearConfirm}
        title="Clear Channel"
        message={`Clear all messages in #${props.channel}? This cannot be undone.`}
        confirmLabel="Clear"
        danger={true}
        onConfirm={async () => {
          const c = client.value;
          if (!c) throw new Error("Not connected");
          await c.clearChannel(props.wsKey, props.channel);
          channelMessages.value = [];
        }}
      />
    </div>
  );
};
