import { test, expect, describe } from "bun:test";
import { ReminderManager } from "../src/reminder.ts";

describe("ReminderManager", () => {
  test("add creates a pending reminder", () => {
    const rm = new ReminderManager();
    const { id } = rm.add("test");
    expect(id).toMatch(/^reminder_/);
    expect(rm.hasPending).toBe(true);
    expect(rm.pending).toHaveLength(1);
    expect(rm.pending[0]!.label).toBe("test");
    rm.cancelAll();
  });

  test("fire resolves the reminder promise", async () => {
    const rm = new ReminderManager();
    const { id } = rm.add("test");

    const promise = rm.waitForNext();
    rm.fire(id, "completed", "done");

    const result = await promise;
    expect(result.id).toBe(id);
    expect(result.label).toBe("test");
    expect(result.reason).toBe("completed");
    expect(result.message).toBe("done");
    expect(rm.hasPending).toBe(false);
  });

  test("fire returns false for non-existent id", () => {
    const rm = new ReminderManager();
    expect(rm.fire("nonexistent", "completed")).toBe(false);
  });

  test("fire returns false for already fired reminder", () => {
    const rm = new ReminderManager();
    const { id } = rm.add("test");
    rm.fire(id, "completed");
    expect(rm.fire(id, "completed")).toBe(false);
  });

  test("timeout fires automatically", async () => {
    const rm = new ReminderManager();
    rm.add("test", { timeoutMs: 50 });

    const result = await rm.waitForNext();
    expect(result.reason).toBe("timeout");
    expect(result.label).toBe("test");
  });

  test("manual fire clears timeout timer", async () => {
    const rm = new ReminderManager();
    const { id } = rm.add("test", { timeoutMs: 5000 });

    const promise = rm.waitForNext();
    rm.fire(id, "completed");
    const result = await promise;
    expect(result.reason).toBe("completed");
    rm.cancelAll();
  });

  test("fireByLabel fires all matching reminders", () => {
    const rm = new ReminderManager();
    rm.add("inbox_wait", { timeoutMs: 5000 });
    rm.add("inbox_wait", { timeoutMs: 5000 });
    rm.add("other", { timeoutMs: 5000 });

    rm.fireByLabel("inbox_wait", "completed");
    expect(rm.pending).toHaveLength(1);
    expect(rm.pending[0]!.label).toBe("other");
    rm.cancelAll();
  });

  test("waitForNext races multiple pending reminders", async () => {
    const rm = new ReminderManager();
    rm.add("slow", { timeoutMs: 5000 });
    rm.add("fast", { timeoutMs: 30 });

    const result = await rm.waitForNext();
    expect(result.label).toBe("fast");
    expect(result.reason).toBe("timeout");
    rm.cancelAll();
  });

  test("formatPending sanitizes label and description", () => {
    const rm = new ReminderManager();
    rm.add("evil\nlabel\r\nhere", { description: "bad\ndesc\u201cwith\u201d quotes" });

    const text = rm.formatPending();
    expect(text).not.toContain("\n" + "label");
    expect(text).toContain("evil label here");
    expect(text).toContain("bad desc'with' quotes");
    rm.cancelAll();
  });

  test("formatPending shows pending reminders", () => {
    const rm = new ReminderManager();
    rm.add("check_status", { description: "Check build status" });
    rm.add("inbox_wait", { timeoutMs: 5000, description: "Waiting for response" });

    const text = rm.formatPending();
    expect(text).toContain("Pending reminders (2)");
    expect(text).toContain("check_status");
    expect(text).toContain("Check build status");
    expect(text).toContain("inbox_wait");
    rm.cancelAll();
  });

  test("formatPending returns empty string when none pending", () => {
    const rm = new ReminderManager();
    expect(rm.formatPending()).toBe("");
  });

  test("cancelAll clears everything", () => {
    const rm = new ReminderManager();
    rm.add("a", { timeoutMs: 5000 });
    rm.add("b", { timeoutMs: 5000 });
    rm.cancelAll();
    expect(rm.hasPending).toBe(false);
    expect(rm.pending).toHaveLength(0);
  });

  test("cleanup removes fired entries", () => {
    const rm = new ReminderManager();
    const { id } = rm.add("a");
    rm.add("b", { timeoutMs: 5000 });
    rm.fire(id, "completed");
    rm.cleanup();
    // 'a' should be cleaned up, 'b' still pending
    expect(rm.pending).toHaveLength(1);
    expect(rm.pending[0]!.label).toBe("b");
    rm.cancelAll();
  });

  test("description is stored and shown", () => {
    const rm = new ReminderManager();
    rm.add("deploy", { description: "Wait for CI pipeline" });
    expect(rm.pending[0]!.description).toBe("Wait for CI pipeline");
    rm.cancelAll();
  });
});
