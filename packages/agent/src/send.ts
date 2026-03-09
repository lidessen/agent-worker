import type { Inbox } from "./inbox.ts";

export interface SendResult {
  sent: boolean;
  warning?: string;
}

/**
 * Send guard: checks for new unread messages before sending.
 * First attempt warns if new messages arrived, force=true bypasses.
 */
export class SendGuard {
  private onSend: (target: string, content: string) => void;
  private inbox: Inbox;

  constructor(
    inbox: Inbox,
    onSend: (target: string, content: string) => void,
  ) {
    this.inbox = inbox;
    this.onSend = onSend;
  }

  send(target: string, content: string, force = false): SendResult {
    if (!force && this.inbox.hasNewSinceLastPeek()) {
      const count = this.inbox.unreadCount;
      return {
        sent: false,
        warning: `⚠ ${count} new unread message(s) arrived. Call inbox.peek() to review, or call send() again with force=true to send anyway.`,
      };
    }

    this.onSend(target, content);
    return { sent: true };
  }
}
