/** @jsxImportSource @semajsx/dom */

import { describe, it, expect } from "vitest";
import { island, isIslandComponent, isIslandVNode } from "./client/island";
import { signal } from "@semajsx/signal";

describe("island", () => {
  it("should mark component as island", () => {
    const Counter = island(function Counter({ initial = 0 }) {
      const count = signal(initial);
      return <button onClick={() => count.value++}>{count}</button>;
    }, "/path/to/Counter.tsx");

    expect(isIslandComponent(Counter)).toBe(true);
  });

  it("should create VNode with island marker", () => {
    const Counter = island(function Counter({ initial = 0 }) {
      const count = signal(initial);
      return <button>{count}</button>;
    }, "/path/to/Counter.tsx");

    const vnode = <Counter initial={5} />;
    expect(isIslandVNode(vnode)).toBe(true);
  });

  it("should preserve component props", () => {
    const Counter = island(function Counter({ initial = 0, label = "Count" }) {
      return <div>{`${label}: ${initial}`}</div>;
    }, "/path/to/Counter.tsx");

    const vnode = <Counter initial={10} label="Total" />;
    expect(vnode.props).toEqual({ initial: 10, label: "Total" });
  });

  it("should store module path in island metadata", () => {
    const modulePath = "/src/components/MyComponent.tsx";
    const MyComponent = island(() => <div>Hello</div>, modulePath);

    const vnode = <MyComponent />;
    expect(isIslandVNode(vnode)).toBe(true);

    // Check that island marker contains module path
    const marker = (vnode as any)[Symbol.for("semajsx.island")];
    expect(marker).toBeDefined();
    expect(marker.modulePath).toBe(modulePath);
  });

  it("should not mark regular components as islands", () => {
    const RegularComponent = () => <div>Not an island</div>;
    expect(isIslandComponent(RegularComponent)).toBe(false);

    const vnode = <RegularComponent />;
    expect(isIslandVNode(vnode)).toBe(false);
  });

  it("should work with components that have no props", () => {
    const Static = island(() => <div>Static content</div>, "/path/to/Static.tsx");

    const vnode = <Static />;
    expect(isIslandVNode(vnode)).toBe(true);
  });
});
