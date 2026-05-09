---
title: Terminal UI
description: Build CLI applications with JSX and flexbox layout
order: 8
category: Advanced
---

# Terminal UI

`semajsx/terminal` lets you build CLI interfaces using the same JSX and signals you already know. It uses Yoga for flexbox layout and ANSI colors for styling.

## Quick Start

```tsx
/** @jsxImportSource semajsx/dom */

import { signal } from "semajsx/signal";
import { render, Box, Text } from "semajsx/terminal";

function App() {
  const count = signal(0);
  setInterval(() => count.value++, 1000);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="blue">
        Terminal Counter
      </Text>
      <Text>Elapsed: {count}s</Text>
    </Box>
  );
}

const { waitUntilExit } = render(<App />);
await waitUntilExit();
```

## Built-in Components

### `<Box>` — Flexbox Container

`<Box>` supports standard flexbox properties powered by Yoga:

```tsx
<Box
  flexDirection="row"
  justifyContent="space-between"
  alignItems="center"
  padding={2}
  gap={1}
  borderStyle="round"
  borderColor="cyan"
>
  <Box width="50%">
    <Text>Left</Text>
  </Box>
  <Box width="50%">
    <Text>Right</Text>
  </Box>
</Box>
```

**Layout props:** `flexDirection`, `justifyContent`, `alignItems`, `flexWrap`, `flex`, `flexGrow`, `flexShrink`, `flexBasis`, `gap`

**Spacing props:** `padding`, `paddingX`, `paddingY`, `margin`, `marginX`, `marginY`

**Sizing props:** `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight`

**Border props:** `borderStyle` (`single`, `double`, `round`, `bold`, `classic`), `borderColor`

### `<Text>` — Styled Text

```tsx
<Text color="green" bold>Success!</Text>
<Text color="red" italic>Error occurred</Text>
<Text color="#ff6600" underline>Custom color</Text>
<Text dim strikethrough>Deprecated</Text>
```

**Style props:** `color`, `bold`, `italic`, `underline`, `strikethrough`, `dim`

## Signal Reactivity

Signals work identically in terminal as in the DOM — only changed text updates:

```tsx
import { signal, computed } from "semajsx/signal";

function Dashboard() {
  const cpu = signal(0);
  const memory = signal(0);
  const status = computed([cpu], (c) => (c > 80 ? "critical" : "ok"));

  // Simulated updates
  setInterval(() => {
    cpu.value = Math.round(Math.random() * 100);
    memory.value = Math.round(Math.random() * 100);
  }, 1000);

  return (
    <Box flexDirection="column" padding={1} borderStyle="round">
      <Text bold>System Monitor</Text>
      <Text>CPU: {cpu}%</Text>
      <Text>Memory: {memory}%</Text>
      <Text color={status.value === "critical" ? "red" : "green"}>Status: {status}</Text>
    </Box>
  );
}
```

## One-Shot Printing

Use `print()` for non-interactive output:

```tsx
import { print, Box, Text } from "semajsx/terminal";

print(
  <Box padding={1} borderStyle="single">
    <Text bold color="green">
      Build complete!
    </Text>
  </Box>,
);
```

## Render Options

```tsx
const { rerender, unmount, waitUntilExit } = render(<App />, {
  fps: 30, // Frame rate (default: 30)
  stream: process.stderr, // Output stream
});

// Re-render with new props
rerender(<App status="updated" />);

// Clean up
unmount();
```

## Next Steps

- Learn the [Signal](/reference/signals) fundamentals
- Explore [Components](/reference/components) and composition patterns
- Check out [DOM Rendering](/reference/dom-rendering) for browser-based UIs
