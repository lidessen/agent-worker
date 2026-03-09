import { test, expect, describe } from "bun:test";
import { Inbox } from "../src/inbox.ts";
import { SendGuard } from "../src/send.ts";

describe("SendGuard", () => {
  test("send goes through when no new messages", () => {
    const inbox = new Inbox({}, () => {});
    const sent: Array<{ target: string; content: string }> = [];
    const guard = new SendGuard(inbox, (target, content) => {
      sent.push({ target, content });
    });

    const result = guard.send("user", "hello");
    expect(result.sent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.content).toBe("hello");
  });

  test("send warns when new messages arrived since peek", () => {
    const inbox = new Inbox({}, () => {});
    inbox.push("first");
    inbox.peek(); // establish baseline

    // New message after peek
    inbox.push("new message");

    const sent: Array<{ target: string; content: string }> = [];
    const guard = new SendGuard(inbox, (target, content) => {
      sent.push({ target, content });
    });

    const result = guard.send("user", "response");
    expect(result.sent).toBe(false);
    expect(result.warning).toContain("new unread");
    expect(sent).toHaveLength(0);
  });

  test("send with force=true bypasses guard", () => {
    const inbox = new Inbox({}, () => {});
    inbox.push("first");
    inbox.peek();
    inbox.push("new");

    const sent: Array<{ target: string; content: string }> = [];
    const guard = new SendGuard(inbox, (target, content) => {
      sent.push({ target, content });
    });

    const result = guard.send("user", "response", true);
    expect(result.sent).toBe(true);
    expect(sent).toHaveLength(1);
  });
});
