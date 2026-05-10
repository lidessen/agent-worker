/** @jsxImportSource @semajsx/terminal */
import { signal } from "@semajsx/signal";
import { ExitHint, render } from "@semajsx/terminal";

// Simple counter with JSX
const count = signal(0);

// Auto-increment every second
setInterval(() => {
  count.value++;
}, 1000);

// Build UI using JSX
const app = (
  <box flexDirection="column" padding={2} border="round" borderColor="cyan">
    <text bold color="green">
      Terminal Counter
    </text>
    <text marginTop={1}>Count: {count}</text>
    <text dim marginTop={1}>
      Updates every second...
    </text>
    <ExitHint>
      <text dim marginTop={1} color="yellow">
        Press Ctrl+C or ESC to exit
      </text>
    </ExitHint>
  </box>
);

// Render to terminal - that's it!
// The render function automatically:
// - Creates the renderer
// - Sets up auto-rendering at 60 FPS
// - Handles Ctrl+C and ESC keypresses
// - Manages cleanup on exit
render(app);
