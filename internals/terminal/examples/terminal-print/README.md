# Terminal Print Example

Simple examples demonstrating the `print()` function for one-off terminal output.

## Features

- **Static terminal output** - Print styled JSX to the terminal
- **Box components** - Borders, colors, and padding
- **Text styling** - Bold, colors, and formatting
- **Stream control** - Output to stdout or stderr

## Running the Example

```bash
bun examples/terminal-print/simple-print.tsx
```

This will print styled messages to your terminal and exit.

## What's Demonstrated

### 1. Success Message

```tsx
print(
  <box border="round" borderColor="green" padding={1}>
    <text bold color="green">
      ✓ Operation completed successfully!
    </text>
  </box>,
);
```

Green bordered box with success message.

### 2. Info Box with Nested Content

```tsx
print(
  <box flexDirection="column" paddingLeft={2}>
    <text bold color="cyan">
      Server Information:
    </text>
    <box marginTop={1} flexDirection="column" paddingLeft={2}>
      <text>• Host: localhost</text>
      <text>• Port: 3000</text>
      <text>• Environment: development</text>
    </box>
  </box>,
);
```

Structured information with layout using flexbox.

### 3. Warning Message

```tsx
print(
  <box border="round" borderColor="yellow" padding={1}>
    <text bold color="yellow">
      ⚠ Warning: Development mode
    </text>
  </box>,
);
```

Yellow warning box.

### 4. Error to stderr

```tsx
print(
  <box border="round" borderColor="red" padding={1}>
    <text bold color="red">
      ✗ Error: Connection failed
    </text>
  </box>,
  { stream: process.stderr },
);
```

Red error box printed to stderr instead of stdout.

## API

### print()

```tsx
print(element: JSX.Element, options?: { stream?: NodeJS.WriteStream })
```

Renders a JSX element to the terminal and exits immediately.

**Parameters:**

- `element` - JSX element to render
- `options.stream` - Output stream (default: `process.stdout`)

## Components

### Box

Layout container with flexbox support:

```tsx
<box
  border="single" | "double" | "round" | "bold" | "singleDouble" | "doubleSingle" | "classic"
  borderColor="red" | "green" | "blue" | "yellow" | "cyan" | "magenta" | "white" | "gray"
  padding={number}
  paddingLeft={number}
  paddingRight={number}
  paddingTop={number}
  paddingBottom={number}
  margin={number}
  marginTop={number}
  marginBottom={number}
  marginLeft={number}
  marginRight={number}
  flexDirection="row" | "column"
  justifyContent="flex-start" | "center" | "flex-end" | "space-between" | "space-around"
  alignItems="flex-start" | "center" | "flex-end" | "stretch"
>
  {children}
</box>
```

### Text

Text content with styling:

```tsx
<text
  color="red" | "green" | "blue" | "yellow" | "cyan" | "magenta" | "white" | "gray"
  backgroundColor="red" | "green" | "blue" | "yellow" | "cyan" | "magenta" | "white" | "gray"
  bold={boolean}
  italic={boolean}
  underline={boolean}
  strikethrough={boolean}
>
  Content
</text>
```

## Use Cases

- CLI tool success/error messages
- Build scripts status output
- Development server startup info
- One-time formatted terminal output

## Difference from `render()`

- **`print()`** - Prints once and exits (static output)
- **`render()`** - Continuous rendering with reactivity (interactive apps)

For interactive terminal apps with signals, see the **terminal-counter** example.

## Related Examples

- **terminal-counter** - Interactive terminal apps with signals
- **shared** - Server startup messages using terminal rendering
