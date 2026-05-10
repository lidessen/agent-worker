/** @jsxImportSource @semajsx/prompt */

import { describe, it, expect } from "vitest";
import { renderToString, render } from "./render";
import { computed, signal } from "@semajsx/signal";

describe("Prompt UI Render", () => {
  describe("renderToString", () => {
    it("should render a simple section", () => {
      const text = renderToString(
        <section title="ROLE">
          <line>Support Agent</line>
        </section>,
      );
      expect(text).toBe("[ROLE]\nSupport Agent");
    });

    it("should render a header", () => {
      const text = renderToString(<header name="Test Screen" time="2026-03-12" />);
      expect(text).toBe("SCREEN Test Screen\nTIME 2026-03-12");
    });

    it("should render nested structure", () => {
      const text = renderToString(
        <>
          <header name="Inbox" focus="thread:A" />
          <section title="ROLE">
            <line>Agent</line>
          </section>
          <section title="AWARENESS">
            <item>Check messages</item>
            <item>Be careful</item>
          </section>
        </>,
      );

      expect(text).toContain("SCREEN Inbox");
      expect(text).toContain("FOCUS thread:A");
      expect(text).toContain("[ROLE]");
      expect(text).toContain("Agent");
      expect(text).toContain("[AWARENESS]");
      expect(text).toContain("- Check messages");
      expect(text).toContain("- Be careful");
    });

    it("should render actions inline", () => {
      const text = renderToString(
        <actions>
          <action label="Reply" name="reply" chat="A" />
          <action label="Open" name="open" chat="B" />
        </actions>,
      );
      expect(text).toBe("Actions: Reply => @act:reply chat=A | Open => @act:open chat=B");
    });

    it("should render items with signals (reads current value)", () => {
      const count = signal(42);
      const text = renderToString(
        <section title="STATUS">
          <line>Count: {count}</line>
        </section>,
      );
      expect(text).toContain("[STATUS]");
      expect(text).toContain("Count: 42");
    });

    it("should render fields", () => {
      const text = renderToString(
        <>
          <field label="Name" value="Alice" />
          <field label="Status" value="online" />
        </>,
      );
      expect(text).toContain("Name: Alice");
      expect(text).toContain("Status: online");
    });

    it("should render separator", () => {
      const text = renderToString(
        <>
          <line>Before</line>
          <separator />
          <line>After</line>
        </>,
      );
      expect(text).toBe("Before\n---\nAfter");
    });
  });

  describe("render (reactive)", () => {
    it("should return current text via toString", () => {
      const result = render(
        <section title="TEST">
          <line>Hello</line>
        </section>,
      );
      expect(result.toString()).toBe("[TEST]\nHello");
      result.unmount();
    });

    it("should update when signals change", async () => {
      const count = signal(0);
      const result = render(
        <section title="COUNT">
          <line>Value: {count}</line>
        </section>,
      );

      expect(result.toString()).toContain("Value: 0");

      const updates: string[] = [];
      result.subscribe((text) => updates.push(text));

      count.value = 5;
      const settled = await result.toStringAsync();

      result.unmount();

      // The subscribe callback should have been called
      // and the text should reflect the new value
      expect(settled).toContain("Value: 5");
      expect(updates.length).toBeGreaterThanOrEqual(1);
      expect(updates[updates.length - 1]).toContain("Value: 5");
    });

    it("should support multiple concurrent render instances", async () => {
      const count1 = signal(0);
      const count2 = signal(0);

      const r1 = render(
        <section title="R1">
          <line>Count: {count1}</line>
        </section>,
      );
      const r2 = render(
        <section title="R2">
          <line>Count: {count2}</line>
        </section>,
      );

      const updates1: string[] = [];
      const updates2: string[] = [];
      r1.subscribe((text) => updates1.push(text));
      r2.subscribe((text) => updates2.push(text));

      // Update signal for r1 only
      count1.value = 10;
      await r1.toStringAsync();

      expect(updates1.length).toBeGreaterThanOrEqual(1);
      expect(updates1[updates1.length - 1]).toContain("Count: 10");
      // r2 should not have changed
      expect(updates2).toHaveLength(0);

      // Update signal for r2 only
      count2.value = 20;
      await r2.toStringAsync();

      expect(updates2.length).toBeGreaterThanOrEqual(1);
      expect(updates2[updates2.length - 1]).toContain("Count: 20");

      // r1 should still work after r2 was created
      count1.value = 99;
      await r1.toStringAsync();

      expect(updates1[updates1.length - 1]).toContain("Count: 99");

      r1.unmount();
      r2.unmount();
    });

    it("should not break first render when second render is created", async () => {
      const name = signal("Alice");

      const r1 = render(
        <section title="GREETING">
          <line>Hello {name}</line>
        </section>,
      );

      // Creating a second render should not steal r1's notifications
      const r2 = render(
        <section title="OTHER">
          <line>Static</line>
        </section>,
      );

      const updates1: string[] = [];
      r1.subscribe((text) => updates1.push(text));

      name.value = "Bob";
      await r1.toStringAsync();

      // r1 must still receive its update
      expect(updates1.length).toBeGreaterThanOrEqual(1);
      expect(updates1[updates1.length - 1]).toContain("Hello Bob");

      r1.unmount();
      r2.unmount();
    });

    it("should support refresh()", () => {
      const result = render(
        <section title="TEST">
          <line>Static</line>
        </section>,
      );

      const updates: string[] = [];
      result.subscribe((text) => updates.push(text));

      // refresh should not trigger callback if text hasn't changed
      result.refresh();
      expect(updates).toHaveLength(0);

      result.unmount();
    });

    it("should commit only settled state for chained reactive updates", async () => {
      const focus = signal("general");
      const message = computed(focus, (channel) => `message:${channel}`);

      const result = render(
        <section title="STATE">
          <line>Focus: {focus}</line>
          <line>Message: {message}</line>
        </section>,
      );

      const updates: string[] = [];
      result.subscribe((text) => updates.push(text));

      focus.value = "backend";
      const settled = await result.toStringAsync();

      expect(settled).toContain("Focus: backend");
      expect(settled).toContain("Message: message:backend");
      expect(updates).toHaveLength(1);
      expect(updates[0]).toContain("Focus: backend");
      expect(updates[0]).toContain("Message: message:backend");

      result.unmount();
    });
  });

  describe("components", () => {
    function MySection(props: { title: string; children?: any }): any {
      return <section title={props.title}>{props.children}</section>;
    }

    it("should render function components", () => {
      const text = renderToString(
        <MySection title="CUSTOM">
          <item>Item A</item>
          <item>Item B</item>
        </MySection>,
      );

      expect(text).toContain("[CUSTOM]");
      expect(text).toContain("- Item A");
      expect(text).toContain("- Item B");
    });
  });
});
