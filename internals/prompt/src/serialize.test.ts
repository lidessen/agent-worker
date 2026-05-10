import { describe, it, expect } from "vitest";
import { serialize } from "./serialize";
import { createRoot, createElement, createTextNode, appendChild } from "./operations";
import { setProperty } from "./properties";

function root(...children: ReturnType<typeof createElement | typeof createTextNode>[]) {
  const r = createRoot();
  for (const child of children) {
    appendChild(r, child);
  }
  return r;
}

function el(tagName: string, props: Record<string, unknown> = {}, ...children: any[]) {
  const e = createElement(tagName);
  for (const [key, value] of Object.entries(props)) {
    setProperty(e, key, value);
  }
  for (const child of children) {
    if (typeof child === "string") {
      appendChild(e, createTextNode(child));
    } else {
      appendChild(e, child);
    }
  }
  return e;
}

describe("Prompt UI Serialize", () => {
  describe("header", () => {
    it("should render known header fields", () => {
      const r = root(
        el("header", { name: "Support Inbox", time: "2026-03-12", focus: "thread:A" }),
      );
      const text = serialize(r);
      expect(text).toBe("SCREEN Support Inbox\nTIME 2026-03-12\nFOCUS thread:A");
    });

    it("should render custom header fields", () => {
      const r = root(el("header", { name: "Test", version: "1.0" }));
      const text = serialize(r);
      expect(text).toContain("SCREEN Test");
      expect(text).toContain("VERSION 1.0");
    });

    it("should skip empty fields", () => {
      const r = root(el("header", { name: "Test", event: "" }));
      const text = serialize(r);
      expect(text).not.toContain("EVENT");
    });
  });

  describe("section", () => {
    it("should render section with title", () => {
      const r = root(el("section", { title: "ROLE" }, "Support Agent"));
      const text = serialize(r);
      expect(text).toBe("[ROLE]\nSupport Agent");
    });

    it("should render section with viewport", () => {
      const r = root(el("section", { title: "TODOS", viewport: "1-3/5" }, "content"));
      const text = serialize(r);
      expect(text).toContain("[TODOS] viewport=1-3/5");
    });
  });

  describe("line", () => {
    it("should render a simple line", () => {
      const r = root(el("line", {}, "Hello world"));
      const text = serialize(r);
      expect(text).toBe("Hello world");
    });

    it("should render a line with prefix", () => {
      const r = root(el("line", { prefix: "[19:47 A] " }, "I need help"));
      const text = serialize(r);
      expect(text).toBe("[19:47 A] I need help");
    });
  });

  describe("item", () => {
    it("should render unordered item", () => {
      const r = root(el("item", {}, "First item"));
      const text = serialize(r);
      expect(text).toBe("- First item");
    });

    it("should render ordered item", () => {
      const r = root(el("item", { index: 1 }, "First item"));
      const text = serialize(r);
      expect(text).toBe("1. First item");
    });

    it("should support custom marker", () => {
      const r = root(el("item", { marker: "*" }, "Star item"));
      const text = serialize(r);
      expect(text).toBe("* Star item");
    });
  });

  describe("field", () => {
    it("should render field with value prop", () => {
      const r = root(el("field", { label: "Status", value: "active" }));
      const text = serialize(r);
      expect(text).toBe("Status: active");
    });

    it("should render field with children as value", () => {
      const r = root(el("field", { label: "Name" }, "Alice"));
      const text = serialize(r);
      expect(text).toBe("Name: Alice");
    });
  });

  describe("actions", () => {
    it("should render inline actions", () => {
      const a1 = el("action", { label: "Reply", name: "reply", chat: "A" });
      const a2 = el("action", { label: "Open", name: "open", chat: "B" });
      const r = root(el("actions", {}, a1, a2));
      const text = serialize(r);
      expect(text).toBe("Actions: Reply => @act:reply chat=A | Open => @act:open chat=B");
    });

    it("should render actions as list when inline=false", () => {
      const a1 = el("action", { label: "Reply", name: "reply", chat: "A" });
      const r = root(el("actions", { inline: false }, a1));
      const text = serialize(r);
      expect(text).toContain("Actions:");
      expect(text).toContain("- Reply => @act:reply chat=A");
    });

    it("should support custom label", () => {
      const a1 = el("action", { name: "next", scope: "todos" });
      const r = root(el("actions", { label: "More" }, a1));
      const text = serialize(r);
      expect(text).toBe("More: @act:next scope=todos");
    });
  });

  describe("action (standalone)", () => {
    it("should render action with label and params", () => {
      const r = root(el("action", { label: "Reply to A", name: "reply", chat: "A" }));
      const text = serialize(r);
      expect(text).toBe("Reply to A => @act:reply chat=A");
    });

    it("should render action without label", () => {
      const r = root(el("action", { name: "finish" }));
      const text = serialize(r);
      expect(text).toBe("@act:finish");
    });
  });

  describe("viewport", () => {
    it("should render children and add pagination", () => {
      const item = el("item", {}, "Item 1");
      const r = root(el("viewport", { current: "1-3", total: "10", scope: "todos" }, item));
      const text = serialize(r);
      expect(text).toContain("- Item 1");
      expect(text).toContain("more: @act:next scope=todos");
    });

    it("should not add pagination when at end", () => {
      const item = el("item", {}, "Item");
      const r = root(el("viewport", { current: "1-10", total: "10", scope: "todos" }, item));
      const text = serialize(r);
      expect(text).not.toContain("more:");
    });
  });

  describe("separator", () => {
    it("should render default separator", () => {
      const r = root(el("separator"));
      const text = serialize(r);
      expect(text).toBe("---");
    });

    it("should render custom separator", () => {
      const r = root(el("separator", { char: "===" }));
      const text = serialize(r);
      expect(text).toBe("===");
    });
  });

  describe("br", () => {
    it("should insert an empty line", () => {
      const r = root(el("line", {}, "before"), el("br"), el("line", {}, "after"));
      const text = serialize(r);
      expect(text).toBe("before\n\nafter");
    });
  });

  describe("indent", () => {
    it("should indent children", () => {
      const r = root(el("indent", { size: 4 }, el("line", {}, "indented")));
      const text = serialize(r);
      expect(text).toBe("    indented");
    });
  });

  describe("full screen", () => {
    it("should render a complete screen", () => {
      const header = el("header", {
        name: "Support Inbox",
        time: "2026-03-12 19:48:10",
        event: "new_message from=A",
        focus: "thread:A",
      });

      const role = el("section", { title: "ROLE" }, "Support Agent");

      const awareness = el(
        "section",
        { title: "AWARENESS" },
        el("item", {}, "Prioritize unread messages"),
        el("item", {}, "Only visible content is guaranteed"),
      );

      const todo1 = el("item", { index: 1 }, "Reply to A   priority=high   => @act:reply chat=A");
      const todo2 = el("item", { index: 2 }, "Review B context   => @act:open chat=B");
      const todos = el("section", { title: "TODOS", viewport: "1-2/5" }, todo1, todo2);

      const r = root(header, role, awareness, todos);
      const text = serialize(r);

      expect(text).toContain("SCREEN Support Inbox");
      expect(text).toContain("TIME 2026-03-12 19:48:10");
      expect(text).toContain("EVENT new_message from=A");
      expect(text).toContain("FOCUS thread:A");
      expect(text).toContain("[ROLE]");
      expect(text).toContain("Support Agent");
      expect(text).toContain("[AWARENESS]");
      expect(text).toContain("- Prioritize unread messages");
      expect(text).toContain("[TODOS] viewport=1-2/5");
      expect(text).toContain("1. Reply to A");
    });
  });
});
