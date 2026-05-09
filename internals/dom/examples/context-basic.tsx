/** @jsxImportSource @semajsx/dom */

/**
 * Context API Example: Basic Usage
 *
 * This example demonstrates the basic usage of Context API:
 * - Creating contexts with context<T>()
 * - Providing values with <Context provide={...}>
 * - Consuming values with ctx.inject()
 * - Nested providers (overriding values)
 * - Multiple contexts at once
 */

import { Context, context } from "../src/runtime";
import type { ComponentAPI } from "../src/runtime/types";

// Create contexts (just typed Symbols)
const ThemeContext = context<string>("theme");
const LanguageContext = context<string>("language");

// App component
function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Context API - Basic Example</h1>

      {/* Provide multiple contexts at once */}
      <Context
        provide={[
          [ThemeContext, "dark"],
          [LanguageContext, "zh"],
        ]}
      >
        <Section title="Section 1" />

        {/* Nested provider - overrides theme only */}
        <Context provide={[ThemeContext, "light"]}>
          <Section title="Section 2 (overridden theme)" />
        </Context>

        <Section title="Section 3" />
      </Context>

      {/* Outside providers - uses default values (via ??) */}
      <Section title="Section 4 (default context)" />
    </div>
  );
}

// Section component - consumes context
function Section(props: { title: string }, ctx: ComponentAPI) {
  // Use ?? to provide default values
  const theme = ctx.inject(ThemeContext) ?? "light";
  const language = ctx.inject(LanguageContext) ?? "en";

  const bgColor = theme === "dark" ? "#333" : "#fff";
  const textColor = theme === "dark" ? "#fff" : "#000";

  return (
    <div
      style={{
        background: bgColor,
        color: textColor,
        padding: "20px",
        margin: "20px 0",
        border: "2px solid #ccc",
      }}
    >
      <h2>{props.title}</h2>
      <p>Theme: {theme}</p>
      <p>Language: {language}</p>
      <Details />
    </div>
  );
}

// Details component - also consumes context
function Details(_props: any, ctx: ComponentAPI) {
  const theme = ctx.inject(ThemeContext) ?? "light";
  const language = ctx.inject(LanguageContext) ?? "en";

  const greetings: Record<string, string> = {
    en: "Hello",
    zh: "你好",
    es: "Hola",
    fr: "Bonjour",
  };

  return (
    <div
      style={{
        marginTop: "10px",
        padding: "10px",
        background: theme === "dark" ? "#444" : "#f0f0f0",
      }}
    >
      <p>
        <strong>{greetings[language] || greetings["en"]}</strong>
      </p>
      <p>This nested component also has access to context!</p>
    </div>
  );
}

// Render example
if (typeof document !== "undefined") {
  const { render } = await import("../src/dom");
  const root = document.getElementById("root");
  if (root) {
    render(<App />, root);
  }
}

export { App };
