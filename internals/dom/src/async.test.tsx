/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render } from "@semajsx/dom";

describe("Async Components", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe("Promise-based async components", () => {
    it("should render async component with resolved Promise", async () => {
      async function AsyncGreeting({ name }: { name: string }) {
        // Simulate async operation
        await new Promise((resolve) => setTimeout(resolve, 10));
        return <div class="greeting">Hello, {name}!</div>;
      }

      const vnode = <AsyncGreeting name="World" />;
      render(vnode, container);

      // Initially empty (pending state)
      expect(container.textContent).toBe("");

      // Wait for promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Should render resolved content
      expect(container.textContent).toBe("Hello, World!");
      expect(container.querySelector(".greeting")).toBeTruthy();
    });

    it("should render async component with data fetching", async () => {
      interface User {
        id: number;
        name: string;
      }

      async function UserProfile({ userId }: { userId: number }) {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 10));
        const user: User = { id: userId, name: `User ${userId}` };

        return (
          <div class="profile">
            <h2>{user.name}</h2>
            <p>ID: {user.id}</p>
          </div>
        );
      }

      const vnode = <UserProfile userId={42} />;
      render(vnode, container);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(container.querySelector("h2")?.textContent).toBe("User 42");
      expect(container.querySelector("p")?.textContent).toBe("ID: 42");
    });

    it("should handle multiple async components", async () => {
      async function AsyncItem({ value }: { value: number }) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return <li>Item {value}</li>;
      }

      const vnode = (
        <ul>
          <AsyncItem value={1} />
          <AsyncItem value={2} />
          <AsyncItem value={3} />
        </ul>
      );

      render(vnode, container);

      // Wait for all promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 20));

      const items = container.querySelectorAll("li");
      expect(items.length).toBe(3);
      expect(items[0]?.textContent).toBe("Item 1");
      expect(items[1]?.textContent).toBe("Item 2");
      expect(items[2]?.textContent).toBe("Item 3");
    });
  });

  describe("Async Iterator components", () => {
    it("should render async iterator component with multiple yields", async () => {
      async function* CountdownComponent({ from }: { from: number }) {
        for (let i = from; i >= 0; i--) {
          yield <div class="countdown">{i}</div>;
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      const vnode = <CountdownComponent from={3} />;
      render(vnode, container);

      // Initially empty
      expect(container.textContent).toBe("");

      // Wait for first yield
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(container.textContent).toBe("3");

      // Wait for second yield
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.textContent).toBe("2");

      // Wait for third yield
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.textContent).toBe("1");

      // Wait for final yield
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(container.textContent).toBe("0");
    });

    it("should render loading states with async iterator", async () => {
      async function* LoadingComponent() {
        yield <div class="loading">Loading...</div>;
        await new Promise((resolve) => setTimeout(resolve, 15));

        yield <div class="processing">Processing...</div>;
        await new Promise((resolve) => setTimeout(resolve, 15));

        yield <div class="done">Done!</div>;
      }

      const vnode = <LoadingComponent />;
      render(vnode, container);

      // Wait for first yield
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(container.querySelector(".loading")?.textContent).toBe("Loading...");

      // Wait for second yield
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(container.querySelector(".processing")?.textContent).toBe("Processing...");

      // Wait for final yield
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(container.querySelector(".done")?.textContent).toBe("Done!");
    });

    it("should handle async iterator with progress updates", async () => {
      async function* ProgressComponent({ total }: { total: number }) {
        for (let i = 0; i <= total; i++) {
          const percentage = Math.round((i / total) * 100);
          yield (
            <div class="progress">
              Progress: {percentage}% ({i}/{total})
            </div>
          );
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }

      const vnode = <ProgressComponent total={4} />;
      render(vnode, container);

      // Check progress updates
      await new Promise((resolve) => setTimeout(resolve, 3));
      expect(container.textContent).toContain("0%");

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(container.textContent).toContain("25%");

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(container.textContent).toContain("50%");

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(container.textContent).toContain("75%");

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(container.textContent).toContain("100%");
    });
  });

  describe("Mixed async and sync components", () => {
    it("should render mix of sync and async components", async () => {
      function SyncComponent({ text }: { text: string }) {
        return <span class="sync">{text}</span>;
      }

      async function AsyncComponent({ text }: { text: string }) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return <span class="async">{text}</span>;
      }

      const vnode = (
        <div>
          <SyncComponent text="Sync content" />
          <AsyncComponent text="Async content" />
        </div>
      );

      render(vnode, container);

      // Sync should render immediately
      expect(container.querySelector(".sync")?.textContent).toBe("Sync content");

      // Async should be empty initially
      expect(container.querySelector(".async")).toBeFalsy();

      // Wait for async
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(container.querySelector(".async")?.textContent).toBe("Async content");
    });
  });
});
