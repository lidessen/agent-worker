/** @jsxImportSource @semajsx/dom */
import { batch, computed, signal } from "semajsx";
import { render } from "@semajsx/dom";

// Batching Test Component
function BatchingTest() {
  const count1 = signal(0);
  const count2 = signal(0);
  const count3 = signal(0);

  const total = computed([count1, count2, count3], (a, b, c) => a + b + c);

  const renderCount = signal(0);
  total.subscribe(() => {
    renderCount.value++;
  });

  return (
    <div class="section">
      <h2>1. Batching Test</h2>
      <p>Updates multiple signals at once - should only trigger one DOM update (check console)</p>

      <div>
        <p>Count 1: {count1}</p>
        <p>Count 2: {count2}</p>
        <p>Count 3: {count3}</p>
        <p>Total: {total}</p>
        <div class="stats">DOM Updates: {renderCount}</div>

        <button
          onclick={() => {
            console.log("Before batch update");
            batch(() => {
              count1.value++;
              count2.value++;
              count3.value++;
            });
            console.log("After batch update - check that only 1 update occurred");
          }}
        >
          Update All (Batched)
        </button>

        <button
          onclick={() => {
            console.log("Before separate updates");
            count1.value++;
            count2.value++;
            count3.value++;
            console.log("After separate updates - check microtask batching");
          }}
        >
          Update All (Separate)
        </button>
      </div>
    </div>
  );
}

// Keyed List Test Component
function KeyedListTest() {
  const items = signal([
    { id: 1, text: "Item 1" },
    { id: 2, text: "Item 2" },
    { id: 3, text: "Item 3" },
    { id: 4, text: "Item 4" },
  ]);

  return (
    <div class="section">
      <h2>2. Keyed List Test</h2>
      <p>Efficiently updates lists using keys - items should be reused, not recreated</p>

      <div>
        {computed([items], (list) => (
          <div>
            {list.map((item) => (
              <div key={item.id} class="item">
                {item.text} (ID: {item.id})
              </div>
            ))}
          </div>
        ))}

        <button
          onclick={() => {
            items.value = [...items.value].reverse();
            console.log("List reversed - DOM nodes should be moved, not recreated");
          }}
        >
          Reverse
        </button>

        <button
          onclick={() => {
            const arr = [...items.value];
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [arr[i], arr[j]] = [arr[j]!, arr[i]!];
            }
            items.value = arr;
            console.log("List shuffled - existing items reused");
          }}
        >
          Shuffle
        </button>

        <button
          onclick={() => {
            const newId = Math.max(...items.value.map((i) => i.id)) + 1;
            items.value = [...items.value, { id: newId, text: `Item ${newId}` }];
            console.log("Item added");
          }}
        >
          Add Item
        </button>

        <button
          onclick={() => {
            if (items.value.length > 0) {
              items.value = items.value.slice(1);
              console.log("First item removed");
            }
          }}
        >
          Remove First
        </button>
      </div>
    </div>
  );
}

// DOM Node Pooling Test Component
function NodePoolingTest() {
  const text = signal("Hello World");
  const counter = signal(0);

  return (
    <div class="section">
      <h2>3. DOM Node Pooling Test</h2>
      <p>Reuses DOM nodes instead of replacing them - same text node instance is updated</p>

      <div>
        <p>Text: {text}</p>
        <p>Counter: {counter}</p>
        <p style={{ color: "green", fontWeight: "bold" }}>
          {computed([counter], (c) => (c % 2 === 0 ? "Even" : "Odd"))}
        </p>

        <button
          onclick={() => {
            text.value = text.value + "!";
            console.log("Text updated - text node should be reused, not replaced");
          }}
        >
          Add Exclamation
        </button>

        <button
          onclick={() => {
            counter.value++;
            console.log("Counter updated - nodes should be pooled");
          }}
        >
          Increment
        </button>

        <button
          onclick={() => {
            text.value = "Hello World";
            counter.value = 0;
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// Main App Component
function App() {
  return (
    <div>
      <h1>SemaJSX Performance Optimizations Test</h1>
      <BatchingTest />
      <KeyedListTest />
      <NodePoolingTest />
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  render(<App />, root);
  console.log("Performance tests loaded! Open DevTools to see optimization details.");
}
