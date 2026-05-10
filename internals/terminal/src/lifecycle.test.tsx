/** @jsxImportSource @semajsx/terminal */
import { describe, it, expect, vi } from "vitest";
import type { ComponentAPI, RuntimeComponent } from "@semajsx/core";
import { render } from "./render";

describe("ctx.onCleanup", () => {
  it("registers cleanup callbacks for terminal components", async () => {
    const cleanedUp = vi.fn();

    const MyComponent: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
      ctx.onCleanup(cleanedUp);
      return <text>hello</text>;
    };

    const result = render(<MyComponent />, { autoRender: false });
    result.unmount();

    expect(cleanedUp).toHaveBeenCalledOnce();
  });

  it("runs multiple cleanup callbacks in registration order", () => {
    const order: number[] = [];

    const MyComponent: RuntimeComponent<Record<string, never>> = (_props, ctx) => {
      ctx.onCleanup(() => order.push(1));
      ctx.onCleanup(() => order.push(2));
      ctx.onCleanup(() => order.push(3));
      return <text>hello</text>;
    };

    const result = render(<MyComponent />, { autoRender: false });
    result.unmount();

    expect(order).toEqual([1, 2, 3]);
  });

  it("supports async registration after await", async () => {
    const cleanedUp = vi.fn();

    const MyComponent: RuntimeComponent<Record<string, never>> = async (_props, ctx) => {
      await Promise.resolve();
      ctx.onCleanup(cleanedUp);
      return <text>hello</text>;
    };

    const result = render(<MyComponent />, { autoRender: false });
    await Promise.resolve();
    result.unmount();

    expect(cleanedUp).toHaveBeenCalledOnce();
  });

  it("runs late cleanup registration immediately after unmount", async () => {
    const cleanedUp = vi.fn();
    let capturedCtx: ComponentAPI | undefined;

    const MyComponent: RuntimeComponent<Record<string, never>> = async (_props, ctx) => {
      capturedCtx = ctx;
      await Promise.resolve();
      return <text>hello</text>;
    };

    const result = render(<MyComponent />, { autoRender: false });
    await Promise.resolve();
    result.unmount();
    capturedCtx?.onCleanup(cleanedUp);

    expect(capturedCtx?.isDisposed()).toBe(true);
    expect(cleanedUp).toHaveBeenCalledOnce();
  });
});
