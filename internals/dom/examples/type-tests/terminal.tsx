/** @jsxImportSource @semajsx/terminal */

/**
 * Test file for Terminal TypeScript definitions
 * This file should have full type checking for terminal elements
 */

// Test box element with proper type checking
const terminalApp = (
  <box
    border="round"
    borderColor="green"
    padding={1}
    flexDirection="column"
    justifyContent="center"
    alignItems="flex-start"
    backgroundColor="#000000"
    width="100%"
    height={20}
    margin={2}
    marginTop={1}
    marginLeft={2}
  >
    {/* Test text element */}
    <text color="green" bold italic underline>
      Success! TypeScript definitions work.
    </text>

    {/* Test nested boxes */}
    <box marginTop={1} flexDirection="row" justifyContent="space-between">
      <text color="cyan">Left</text>
      <text color="yellow">Right</text>
    </box>

    {/* Test all border styles */}
    <box border="single" marginTop={1}>
      <text>Single border</text>
    </box>

    <box border="double" marginTop={1}>
      <text>Double border</text>
    </box>

    <box border="round" marginTop={1}>
      <text>Round border</text>
    </box>

    <box border="bold" marginTop={1}>
      <text>Bold border</text>
    </box>

    {/* Test text styling */}
    <box marginTop={1} flexDirection="column">
      <text bold>Bold text</text>
      <text italic>Italic text</text>
      <text underline>Underlined text</text>
      <text strikethrough>Strikethrough text</text>
      <text dim>Dimmed text</text>
    </box>

    {/* Test flexbox properties */}
    <box flexDirection="row" flexGrow={1} flexShrink={0}>
      <text flexBasis={50}>Flex item 1</text>
      <text flexBasis={50}>Flex item 2</text>
    </box>

    {/* Test size constraints */}
    <box minWidth={10} minHeight={5} maxWidth={100} maxHeight={50} width="50%" height={10}>
      <text>Size constrained box</text>
    </box>
  </box>
);

export default terminalApp;
