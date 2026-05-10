/** @jsxImportSource @semajsx/dom */
import { describe, it, expect, vi } from "vitest";
import { signal } from "@semajsx/signal";
import { when, type ComponentAPI, type RuntimeComponent } from "@semajsx/core";
import { render } from "./render";

describe("ctx.onCleanup", () => {
  it("fires registered callback on unmount", () => {
    const cleanedUp = vi.fn();

    const MyComponent: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
      ctx.onCleanup(cleanedUp);
      return <div>hello</div>;
    };

    const container = document.createElement("div");
    const { unmount } = render(<MyComponent />, container);

    expect(cleanedUp).not.toHaveBeenCalled();
    unmount();
    expect(cleanedUp).toHaveBeenCalledOnce();
  });

  it("fires multiple callbacks in registration order", () => {
    const order: number[] = [];

    const MyComponent: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
      ctx.onCleanup(() => order.push(1));
      ctx.onCleanup(() => order.push(2));
      ctx.onCleanup(() => order.push(3));
      return <div>hello</div>;
    };

    const container = document.createElement("div");
    const { unmount } = render(<MyComponent />, container);

    unmount();
    expect(order).toEqual([1, 2, 3]);
  });

  it("fires cleanups for nested components on parent unmount", () => {
    const parentCleanup = vi.fn();
    const childCleanup = vi.fn();

    const Child: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
      ctx.onCleanup(childCleanup);
      return <span>child</span>;
    };

    const Parent: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
      ctx.onCleanup(parentCleanup);
      return (
        <div>
          <Child />
        </div>
      );
    };

    const container = document.createElement("div");
    const { unmount } = render(<Parent />, container);

    expect(parentCleanup).not.toHaveBeenCalled();
    expect(childCleanup).not.toHaveBeenCalled();

    unmount();

    expect(parentCleanup).toHaveBeenCalledOnce();
    expect(childCleanup).toHaveBeenCalledOnce();
  });

  it("fires cleanup when conditional rendering hides component", async () => {
    const cleanedUp = vi.fn();
    const show = signal(true);

    const Conditional: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
      ctx.onCleanup(cleanedUp);
      return <span>visible</span>;
    };

    function App() {
      return (
        <div>
          {when(show, () => (
            <Conditional />
          ))}
        </div>
      );
    }

    const container = document.createElement("div");
    render(<App />, container);

    expect(cleanedUp).not.toHaveBeenCalled();

    // Hide the component
    show.value = false;
    await new Promise((r) => queueMicrotask(r));

    expect(cleanedUp).toHaveBeenCalledOnce();
  });

  it("supports async registration after await", async () => {
    const cleanedUp = vi.fn();
    let capturedCtx: ComponentAPI | undefined;

    const AsyncComponent: RuntimeComponent<Record<string, never>> = async (_props, ctx) => {
      capturedCtx = ctx;
      await Promise.resolve();
      ctx.onCleanup(cleanedUp);
      return <div>async</div>;
    };

    const container = document.createElement("div");
    const { unmount } = render(<AsyncComponent />, container);

    await Promise.resolve();
    expect(capturedCtx).toBeDefined();
    unmount();

    expect(cleanedUp).toHaveBeenCalledOnce();
  });

  it("runs late cleanup registration immediately after unmount", async () => {
    const cleanedUp = vi.fn();
    let capturedCtx: ComponentAPI | undefined;

    const AsyncComponent: RuntimeComponent<Record<string, never>> = async (_props, ctx) => {
      capturedCtx = ctx;
      await Promise.resolve();
      return <div>async</div>;
    };

    const container = document.createElement("div");
    const { unmount } = render(<AsyncComponent />, container);

    await Promise.resolve();
    unmount();
    capturedCtx?.onCleanup(cleanedUp);

    expect(capturedCtx?.isDisposed()).toBe(true);
    expect(cleanedUp).toHaveBeenCalledOnce();
  });
});
