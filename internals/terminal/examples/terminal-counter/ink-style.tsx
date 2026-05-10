/** @jsxImportSource @semajsx/terminal */
import { signal } from "@semajsx/signal";
import { render } from "@semajsx/terminal";

// Simple counter - ink-style API!
const count = signal(0);

// Auto-increment every second
setInterval(() => {
  count.value++;
}, 1000);

// Build UI using JSX
const app = (
  <box flexDirection="column" padding={2} border="round" borderColor="cyan">
    <text bold color="green">
      Terminal Counter (Ink-style API)
    </text>
    <text marginTop={1}>Count: {count}</text>
    <text dim marginTop={1}>
      Updates automatically! Press Ctrl+C or ESC to exit.
    </text>
  </box>
);

// Render to terminal - no need to create renderer manually!
render(app);

// That's it! The render function now:
// - Auto-creates the renderer
// - Sets up automatic re-rendering (16ms interval)
// - Handles Ctrl+C and ESC keypresses
// - Manages cleanup on exit
