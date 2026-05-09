/** @jsxImportSource @semajsx/terminal */
import { print } from "@semajsx/terminal";

// Example 1: Simple success message
print(
  <box border="round" borderColor="green" padding={1}>
    <text bold color="green">
      ✓ Operation completed successfully!
    </text>
  </box>,
);

console.log(""); // Add spacing

// Example 2: Info message with details
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

console.log(""); // Add spacing

// Example 3: Warning message
print(
  <box border="round" borderColor="yellow" padding={1}>
    <text bold color="yellow">
      ⚠ Warning: Development mode
    </text>
  </box>,
);

console.log(""); // Add spacing

// Example 4: Error message to stderr
print(
  <box border="round" borderColor="red" padding={1}>
    <text bold color="red">
      ✗ Error: Connection failed
    </text>
  </box>,
  { stream: process.stderr },
);

console.log("\nAll print examples completed!");
