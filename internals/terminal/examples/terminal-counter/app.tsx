/** @jsxImportSource @semajsx/terminal */
import { signal } from "@semajsx/signal";
import { render } from "@semajsx/terminal";

// Counter component
function Counter() {
  const count = signal(0);

  // Auto-increment every second
  setInterval(() => {
    count.value++;
  }, 1000);

  return (
    <box flexDirection="column" padding={2} border="round" borderColor="cyan">
      <text bold color="green">
        Terminal Counter
      </text>
      <text marginTop={1}>Count: {count}</text>
      <text dim marginTop={1}>
        Updates every second...
      </text>
      <text dim marginTop={1} color="yellow">
        Press Ctrl+C or ESC to exit
      </text>
    </box>
  );
}

// Main app
function App() {
  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
    >
      <Counter />
    </box>
  );
}

// Render to terminal - that's it!
// The render function automatically:
// - Creates the renderer
// - Sets up auto-rendering at 60 FPS
// - Handles Ctrl+C and ESC keypresses
// - Manages cleanup on exit
render(<App />);
