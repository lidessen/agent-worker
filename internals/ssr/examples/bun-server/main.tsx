/** @jsxImportSource @semajsx/dom */
import { computed, signal } from "semajsx";
import { render } from "@semajsx/dom";

function App() {
  const count = signal(0);
  const doubled = computed([count], (v: number) => v * 2);

  return (
    <div style={{ fontFamily: "system-ui", padding: "24px" }}>
      <h1>SemaJSX + Bun</h1>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onclick={() => count.value++}>Increment</button>
      <button onclick={() => count.value--}>Decrement</button>
      <input
        type="text"
        value={count}
        oninput={(e: Event) => {
          const v = Number((e.target as HTMLInputElement).value);
          count.value = Number.isFinite(v) ? v : 0;
        }}
      />
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  render(<App />, root);
}
