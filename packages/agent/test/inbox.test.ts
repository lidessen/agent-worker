import { test, expect, describe } from "bun:test";
import { Inbox } from "../src/inbox.ts";
import { ReminderManager } from "../src/reminder.ts";

describe("Inbox", () => {
  test("push adds unread message", () => {
    const inbox = new Inbox({}, () => {});
    const msg = inbox.push("hello");
    expect(msg.content).toBe("hello");
    expect(msg.status).toBe("unread");
    expect(msg.id).toMatch(/^msg_/);
  });

  test("push with Message object preserves from", () => {
    const inbox = new Inbox({}, () => {});
    const msg = inbox.push({ content: "hello", from: "user" });
    expect(msg.from).toBe("user");
    expect(msg.content).toBe("hello");
  });

  test("read marks message as read", () => {
    const inbox = new Inbox({}, () => {});
    const msg = inbox.push("hello");
    const read = inbox.read(msg.id);
    expect(read?.status).toBe("read");
    expect(read?.content).toBe("hello");
  });

  test("read returns null for non-existent id", () => {
    const inbox = new Inbox({}, () => {});
    expect(inbox.read("nonexistent")).toBeNull();
  });

  test("unread returns only unread messages", () => {
    const inbox = new Inbox({}, () => {});
    const msg1 = inbox.push("first");
    inbox.push("second");
    inbox.read(msg1.id);
    expect(inbox.unread).toHaveLength(1);
    expect(inbox.unread[0]!.content).toBe("second");
  });

  test("peek auto-reads short messages", () => {
    const inbox = new Inbox({ peekThreshold: 200 }, () => {});
    inbox.push("short message");
    const peek = inbox.peek();
    expect(peek).toContain("short message");
    expect(peek).toContain("✓");
    expect(inbox.unread).toHaveLength(0); // auto-read
  });

  test("peek truncates long messages", () => {
    const inbox = new Inbox({ peekThreshold: 20 }, () => {});
    inbox.push("this is a very long message that should be truncated");
    const peek = inbox.peek();
    expect(peek).toContain("truncated");
    expect(peek).toContain("inbox.read");
    expect(inbox.unread).toHaveLength(1); // still unread
  });

  test("peek returns empty when no unread", () => {
    const inbox = new Inbox({}, () => {});
    expect(inbox.peek()).toBe("📥 Inbox: empty");
  });

  test("push fires inbox_wait reminders", () => {
    const inbox = new Inbox({}, () => {});
    const reminders = new ReminderManager();
    inbox.setReminders(reminders);

    // Set a reminder (like inbox wait would)
    const { id } = reminders.add("inbox_wait", { timeoutMs: 5000 });
    expect(reminders.hasPending).toBe(true);

    // Push a message — should fire the reminder
    inbox.push("hello");
    expect(reminders.hasPending).toBe(false);
  });

  test("debounce triggers wake callback", async () => {
    let woken = false;
    const inbox = new Inbox({ debounceMs: 50 }, () => {
      woken = true;
    });
    inbox.push("hello");
    expect(woken).toBe(false);
    await new Promise((r) => setTimeout(r, 100));
    expect(woken).toBe(true);
  });

  test("cancelDebounce prevents wake", async () => {
    let woken = false;
    const inbox = new Inbox({ debounceMs: 50 }, () => {
      woken = true;
    });
    inbox.push("hello");
    inbox.cancelDebounce();
    await new Promise((r) => setTimeout(r, 100));
    expect(woken).toBe(false);
  });

  test("hasNewSinceLastPeek tracks new arrivals", () => {
    const inbox = new Inbox({}, () => {});
    inbox.push("first");
    inbox.peek(); // resets lastPeekTimestamp
    expect(inbox.hasNewSinceLastPeek()).toBe(false);

    // Add a new message slightly after
    setTimeout(() => {
      inbox.push("second");
      expect(inbox.hasNewSinceLastPeek()).toBe(true);
    }, 5);
  });
});
