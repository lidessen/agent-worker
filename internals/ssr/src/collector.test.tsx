/** @jsxImportSource @semajsx/dom */

import { describe, expect, it } from "vitest";
import { createIslandCollector } from "./collector";
import { island } from "./client/island";
import { signal } from "@semajsx/signal";

describe("IslandCollector", () => {
  it("should collect islands from VNode tree", () => {
    const Counter = island(function Counter({ initial = 0 }) {
      const count = signal(initial);
      return <button>{count}</button>;
    }, "/path/to/Counter.tsx");

    const app = (
      <div>
        <h1>App</h1>
        <Counter initial={5} />
      </div>
    );

    const collector = createIslandCollector();
    const islands = collector.collect(app);

    expect(islands).toHaveLength(1);
    expect(islands[0]?.id).toBe("island-0");
    expect(islands[0]?.path).toBe("/path/to/Counter.tsx");
    expect(islands[0]?.props).toEqual({ initial: 5 });
  });

  it("should collect multiple islands", () => {
    const Counter = island(
      (props: { initial: number }) => <button>{props.initial}</button>,
      "/Counter.tsx",
    );

    const TodoList = island((_props: { items: string[] }) => <ul></ul>, "/TodoList.tsx");

    const app = (
      <div>
        <Counter initial={0} />
        <TodoList items={["a", "b"]} />
        <Counter initial={10} />
      </div>
    );

    const collector = createIslandCollector();
    const islands = collector.collect(app);

    expect(islands).toHaveLength(3);
    expect(islands[0]?.id).toBe("island-0");
    expect(islands[0]?.path).toBe("/Counter.tsx");
    expect(islands[1]?.id).toBe("island-1");
    expect(islands[1]?.path).toBe("/TodoList.tsx");
    expect(islands[2]?.id).toBe("island-2");
    expect(islands[2]?.path).toBe("/Counter.tsx");
  });

  it("should collect islands at same level", () => {
    const Button = island(() => <button>Click</button>, "/Button.tsx");
    const Card = island(() => <div>Card</div>, "/Card.tsx");

    const app = (
      <div>
        <Card />
        <section>
          <Button />
        </section>
      </div>
    );

    const collector = createIslandCollector();
    const islands = collector.collect(app);

    // Should collect both Card and Button at their respective levels
    expect(islands).toHaveLength(2);
    expect(islands[0]?.id).toBe("island-0");
    expect(islands[0]?.path).toBe("/Card.tsx");
    expect(islands[1]?.id).toBe("island-1");
    expect(islands[1]?.path).toBe("/Button.tsx");
  });

  it("should serialize props correctly", () => {
    const Component = island(
      (_props: { num: number; str: string; bool: boolean; arr: number[]; obj: any }) => <div></div>,
      "/Component.tsx",
    );

    const app = (
      <Component num={42} str="hello" bool={true} arr={[1, 2, 3]} obj={{ key: "value" }} />
    );

    const collector = createIslandCollector();
    const islands = collector.collect(app);

    expect(islands[0]?.props).toEqual({
      num: 42,
      str: "hello",
      bool: true,
      arr: [1, 2, 3],
      obj: { key: "value" },
    });
  });

  it("should skip non-serializable props", () => {
    const Component = island(
      (_props: { onClick?: () => void; valid: string }) => <div></div>,
      "/Component.tsx",
    );

    const app = <Component onClick={() => console.log("click")} valid="test" />;

    const collector = createIslandCollector();
    const islands = collector.collect(app);

    // Functions should be skipped
    expect(islands[0]?.props).toEqual({ valid: "test" });
    expect(islands[0]?.props.onClick).toBeUndefined();
  });

  it("should handle islands with no props", () => {
    const Static = island(() => <div>Static</div>, "/Static.tsx");

    const app = <Static />;

    const collector = createIslandCollector();
    const islands = collector.collect(app);

    expect(islands).toHaveLength(1);
    expect(islands[0]?.props).toEqual({});
  });

  it("should generate unique IDs for each island", () => {
    const Component = island(() => <div></div>, "/Component.tsx");

    const app = (
      <div>
        <Component />
        <Component />
        <Component />
      </div>
    );

    const collector = createIslandCollector();
    const islands = collector.collect(app);

    const ids = islands.map((i) => i.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
    expect(ids).toEqual(["island-0", "island-1", "island-2"]);
  });
});
