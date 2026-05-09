/** @jsxImportSource @semajsx/dom */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computed, signal } from "@semajsx/signal";
import { render } from "@semajsx/dom";

describe("Signal<Array<VNode>> rendering", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  it("should render computed signal returning array of VNodes", () => {
    const items = signal<string[]>(["Apple", "Banana"]);

    const itemList = computed(items, (list) =>
      list.map((item, index) => <li key={index}>{item}</li>),
    );

    const vnode = <ul>{itemList}</ul>;
    render(vnode, container);

    const ul = container.querySelector("ul");
    expect(ul).toBeTruthy();
    expect(ul?.children.length).toBe(2);
    expect(ul?.children[0]?.textContent).toBe("Apple");
    expect(ul?.children[1]?.textContent).toBe("Banana");
  });

  it("should update when computed array changes", async () => {
    const items = signal<string[]>(["Apple", "Banana"]);

    const itemList = computed(items, (list) =>
      list.map((item, index) => <li key={index}>{item}</li>),
    );

    const vnode = <ul>{itemList}</ul>;
    render(vnode, container);

    // Initial state
    let ul = container.querySelector("ul");
    expect(ul?.children.length).toBe(2);
    expect(ul?.children[0]?.textContent).toBe("Apple");

    // Update the signal
    items.value = ["Apple", "Banana", "Cherry"];

    // Wait for update
    await new Promise((resolve) => setTimeout(resolve, 10));

    ul = container.querySelector("ul");
    expect(ul?.children.length).toBe(3);
    expect(ul?.children[2]?.textContent).toBe("Cherry");
  });

  it("should handle empty array", async () => {
    const items = signal<string[]>(["Apple"]);

    const itemList = computed(items, (list) =>
      list.map((item, index) => <li key={index}>{item}</li>),
    );

    const vnode = <ul>{itemList}</ul>;
    render(vnode, container);

    let ul = container.querySelector("ul");
    expect(ul?.children.length).toBe(1);

    // Update to empty array
    items.value = [];

    await new Promise((resolve) => setTimeout(resolve, 10));

    ul = container.querySelector("ul");
    expect(ul?.children.length).toBe(0);
  });

  it("should handle complex nested structures", async () => {
    const todos = signal<Array<{ id: number; text: string; done: boolean }>>([
      { id: 1, text: "Task 1", done: false },
      { id: 2, text: "Task 2", done: true },
    ]);

    const todoItems = computed(todos, (list) =>
      list.map((todo) => (
        <li key={todo.id}>
          <span>{todo.text}</span>
          <button data-id={todo.id}>Delete</button>
        </li>
      )),
    );

    const vnode = <ul>{todoItems}</ul>;
    render(vnode, container);

    const ul = container.querySelector("ul");
    expect(ul?.children.length).toBe(2);

    const firstLi = ul?.children[0];
    expect(firstLi?.querySelector("span")?.textContent).toBe("Task 1");
    expect(firstLi?.querySelector("button")?.getAttribute("data-id")).toBe("1");

    // Add a new todo
    todos.value = [...todos.value, { id: 3, text: "Task 3", done: false }];

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(ul?.children.length).toBe(3);
    expect(ul?.children[2]?.querySelector("span")?.textContent).toBe("Task 3");
  });

  it("should handle conditional rendering with array", async () => {
    const items = signal<string[]>([]);

    const content = computed(items, (list) => {
      if (list.length === 0) {
        return <p>No items</p>;
      }
      return list.map((item, index) => <li key={index}>{item}</li>);
    });

    const vnode = <div>{content}</div>;
    render(vnode, container);

    // Should show empty message
    let p = container.querySelector("p");
    expect(p?.textContent).toBe("No items");
    expect(container.querySelector("li")).toBeNull();

    // Add items
    items.value = ["Apple", "Banana"];

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should show list items
    expect(container.querySelector("p")).toBeNull();
    const lis = container.querySelectorAll("li");
    expect(lis.length).toBe(2);
    expect(lis[0]?.textContent).toBe("Apple");
  });

  it("should work with multiple computed arrays in same parent", async () => {
    const fruits = signal<string[]>(["Apple", "Banana"]);
    const vegetables = signal<string[]>(["Carrot", "Potato"]);

    const fruitList = computed(fruits, (list) =>
      list.map((item, index) => (
        <li key={`fruit-${index}`} class="fruit">
          {item}
        </li>
      )),
    );

    const vegList = computed(vegetables, (list) =>
      list.map((item, index) => (
        <li key={`veg-${index}`} class="vegetable">
          {item}
        </li>
      )),
    );

    const vnode = (
      <ul>
        {fruitList}
        {vegList}
      </ul>
    );

    render(vnode, container);

    const ul = container.querySelector("ul");
    expect(ul?.children.length).toBe(4);

    const fruitItems = container.querySelectorAll(".fruit");
    const vegItems = container.querySelectorAll(".vegetable");

    expect(fruitItems.length).toBe(2);
    expect(vegItems.length).toBe(2);
    expect(fruitItems[0]?.textContent).toBe("Apple");
    expect(vegItems[0]?.textContent).toBe("Carrot");
  });

  it("should preserve event handlers in array items", async () => {
    const items = signal<string[]>(["Item 1", "Item 2"]);
    const clicked = signal<string>("");

    const itemList = computed(items, (list) =>
      list.map((item, index) => (
        <li key={index}>
          <button onClick={() => (clicked.value = item)}>{item}</button>
        </li>
      )),
    );

    const vnode = <ul>{itemList}</ul>;
    render(vnode, container);

    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2);

    // Click first button
    buttons[0]?.click();
    expect(clicked.value).toBe("Item 1");

    // Click second button
    buttons[1]?.click();
    expect(clicked.value).toBe("Item 2");

    // Update items
    items.value = ["Item 1", "Item 2", "Item 3"];

    await new Promise((resolve) => setTimeout(resolve, 10));

    const updatedButtons = container.querySelectorAll("button");
    expect(updatedButtons.length).toBe(3);

    // Click new button
    updatedButtons[2]?.click();
    expect(clicked.value).toBe("Item 3");
  });
});
