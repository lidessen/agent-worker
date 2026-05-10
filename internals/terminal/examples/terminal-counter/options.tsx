/** @jsxImportSource @semajsx/terminal */
import { signal } from "@semajsx/signal";
import { render } from "@semajsx/terminal";

const count = signal(0);

// Auto-increment every second
setInterval(() => {
  count.value++;
}, 1000);

// Build UI
const app = (
  <box flexDirection="column" padding={2} border="round" borderColor="magenta">
    <text bold color="yellow">
      Terminal Counter with Options
    </text>
    <text marginTop={1}>Count: {count}</text>
    <text dim marginTop={1}>
      Running at 30 FPS on stderr
    </text>
    <text dim>Press Ctrl+C or ESC to exit</text>
  </box>
);

// Render with custom options
render(app, {
  stream: process.stderr, // Output to stderr instead of stdout
  fps: 30, // Lower FPS to reduce CPU usage
});

// Examples of other options:
//
// render(app, { autoRender: false });  // Disable auto-rendering
// render(app, { fps: 120 });           // High FPS for smooth animations
// render(app, { stream: customStream }); // Custom output stream
