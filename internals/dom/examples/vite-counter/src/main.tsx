/** @jsxImportSource @semajsx/dom */
import { signal, computed } from "semajsx";
import { render } from "@semajsx/dom";

// Counter component
function Counter() {
  const count = signal(0);
  const doubled = computed([count], (c) => c * 2);

  return (
    <div class="card">
      <h1>Counter Example</h1>
      <div class="count">Count: {count}</div>
      <div class="count">Doubled: {doubled}</div>
      <button onclick={() => count.value++}>Increment</button>
      <button onclick={() => count.value--}>Decrement</button>
      <button onclick={() => (count.value = 0)}>Reset</button>
    </div>
  );
}

// Input example
function InputExample() {
  const text = signal("");
  const length = computed([text], (t) => t.length);

  return (
    <div class="card">
      <h1>Input Example</h1>
      <input
        type="text"
        placeholder="Type something..."
        value={text}
        oninput={(e: Event) => {
          text.value = (e.target as HTMLInputElement).value;
        }}
      />
      <p>
        You typed: <strong>{text}</strong>
      </p>
      <p>Length: {length}</p>
    </div>
  );
}

// Conditional rendering
function ConditionalExample() {
  const show = signal(true);
  const content = computed([show], (s) =>
    s ? <p>Content is visible! ✅</p> : <p>Content is hidden! ❌</p>,
  );

  return (
    <div class="card">
      <h1>Conditional Rendering</h1>
      {content}
      <button onclick={() => (show.value = !show.value)}>Toggle Content</button>
    </div>
  );
}

// Main app
function App() {
  return (
    <div>
      <Counter />
      <InputExample />
      <ConditionalExample />
    </div>
  );
}

// Render the app
const root = document.getElementById("root");
if (root) {
  render(<App />, root);
}
