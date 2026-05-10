/** @jsxImportSource @semajsx/dom */

/**
 * Context API Example: Reactive Theme System
 *
 * This example demonstrates how to use Context API with Signals
 * for reactive theme management across components.
 */

import { signal } from "../src/signal";
import { Context, context } from "../src/runtime";
import type { ComponentAPI } from "../src/runtime/types";

// Define theme type
interface Theme {
  mode: "light" | "dark";
  primaryColor: string;
}

// Create theme context
const ThemeContext = context<ReturnType<typeof signal<Theme>>>("theme");

// App component - provides theme Signal
function App() {
  // Create a reactive theme signal
  const themeSignal = signal<Theme>({
    mode: "light",
    primaryColor: "#007bff",
  });

  // Toggle theme function
  const toggleTheme = () => {
    themeSignal.value = {
      ...themeSignal.value,
      mode: themeSignal.value.mode === "light" ? "dark" : "light",
    };
  };

  return (
    <Context provide={[ThemeContext, themeSignal]}>
      <div style={{ padding: "20px" }}>
        <h1>Context API - Reactive Theme Example</h1>

        <button onClick={toggleTheme}>Toggle Theme</button>

        <Header />
        <Content />
        <Sidebar />
      </div>
    </Context>
  );
}

// Header component - uses theme Signal from context
function Header(_props: any, ctx: ComponentAPI) {
  const themeSignal = ctx.inject(ThemeContext);

  // Handle case where context might not be provided
  if (!themeSignal) {
    return <header>No theme available</header>;
  }

  return (
    <header
      style={{
        background: themeSignal.value.primaryColor,
        color: themeSignal.value.mode === "dark" ? "#fff" : "#000",
        padding: "20px",
        marginTop: "20px",
      }}
    >
      <h2>Header (uses context)</h2>
      <p>Current theme: {themeSignal.value.mode}</p>
    </header>
  );
}

// Content component - uses theme Signal from context
function Content(_props: any, ctx: ComponentAPI) {
  const themeSignal = ctx.inject(ThemeContext);

  if (!themeSignal) {
    return <main>No theme available</main>;
  }

  return (
    <main
      style={{
        background: themeSignal.value.mode === "dark" ? "#333" : "#fff",
        color: themeSignal.value.mode === "dark" ? "#fff" : "#000",
        padding: "20px",
        margin: "20px 0",
      }}
    >
      <h2>Content (uses context)</h2>
      <p>This component gets its theme from Context, not from props drilling.</p>
      <NestedComponent />
    </main>
  );
}

// Nested component - deeply nested but still has access to theme
function NestedComponent(_props: any, ctx: ComponentAPI) {
  const themeSignal = ctx.inject(ThemeContext);

  if (!themeSignal) {
    return <div>No theme available</div>;
  }

  return (
    <div
      style={{
        border: `2px solid ${themeSignal.value.primaryColor}`,
        padding: "10px",
        marginTop: "10px",
      }}
    >
      <p>Nested Component (also uses context)</p>
      <p>No prop drilling needed!</p>
      <p>Theme updates automatically via Signal!</p>
    </div>
  );
}

// Sidebar component - doesn't use context
function Sidebar() {
  return (
    <aside
      style={{
        background: "#f0f0f0",
        padding: "20px",
        marginTop: "20px",
      }}
    >
      <h3>Sidebar (no context)</h3>
      <p>This component doesn't need theme context.</p>
    </aside>
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
