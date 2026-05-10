/**
 * Example demonstrating ref usage in SemaJSX
 *
 * Run with: bun --conditions=development --port=0 examples/ref-example.tsx
 */

/** @jsxImportSource @semajsx/dom */

import { signal } from "@semajsx/signal";
import { render } from "@semajsx/dom";

// Example 1: Using ref with signal
function FocusableInput() {
  const inputRef = signal<HTMLInputElement | null>(null);

  const handleFocus = () => {
    if (inputRef.value) {
      inputRef.value.focus();
      inputRef.value.select();
    }
  };

  return (
    <div>
      <h2>Example 1: Signal Ref</h2>
      <input ref={inputRef} type="text" defaultValue="Click button to focus" />
      <button onClick={handleFocus}>Focus Input</button>
    </div>
  );
}

// Example 2: Using ref with callback
function CallbackRefExample() {
  const handleRef = (element: HTMLDivElement | null) => {
    if (element) {
      console.log("Element mounted:", element);
      element.style.backgroundColor = "lightblue";
    } else {
      console.log("Element unmounted");
    }
  };

  return (
    <div>
      <h2>Example 2: Callback Ref</h2>
      <div ref={handleRef} style={{ padding: "20px" }}>
        This div's background is set via callback ref
      </div>
    </div>
  );
}

// Example 3: Imperative canvas manipulation
function CanvasExample() {
  const canvasRef = signal<HTMLCanvasElement | null>(null);

  const drawCircle = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(100, 75, 50, 0, 2 * Math.PI);
    ctx.fillStyle = "#FF6B6B";
    ctx.fill();
    ctx.stroke();
  };

  const drawSquare = () => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#4ECDC4";
    ctx.fillRect(50, 25, 100, 100);
  };

  return (
    <div>
      <h2>Example 3: Canvas Ref</h2>
      <canvas ref={canvasRef} width={200} height={150} style={{ border: "1px solid #ccc" }} />
      <br />
      <button onClick={drawCircle}>Draw Circle</button>
      <button onClick={drawSquare}>Draw Square</button>
    </div>
  );
}

// Example 4: Multiple refs
function MultipleRefsExample() {
  const firstNameRef = signal<HTMLInputElement | null>(null);
  const lastNameRef = signal<HTMLInputElement | null>(null);
  const emailRef = signal<HTMLInputElement | null>(null);

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    const formData = {
      firstName: firstNameRef.value?.value,
      lastName: lastNameRef.value?.value,
      email: emailRef.value?.value,
    };

    console.log("Form data:", formData);
    alert(`Submitted: ${JSON.stringify(formData, null, 2)}`);
  };

  return (
    <div>
      <h2>Example 4: Multiple Refs</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            First Name:
            <input ref={firstNameRef} type="text" name="firstName" />
          </label>
        </div>
        <div>
          <label>
            Last Name:
            <input ref={lastNameRef} type="text" name="lastName" />
          </label>
        </div>
        <div>
          <label>
            Email:
            <input ref={emailRef} type="email" name="email" />
          </label>
        </div>
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

// Main App
function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>SemaJSX Ref Examples</h1>
      <FocusableInput />
      <hr />
      <CallbackRefExample />
      <hr />
      <CanvasExample />
      <hr />
      <MultipleRefsExample />
    </div>
  );
}

// Render to DOM
const root = document.getElementById("app");
if (root) {
  render(<App />, root);
}

// For Bun server
export default {
  port: 3000,
  fetch() {
    return new Response(
      `<!DOCTYPE html>
<html>
  <head>
    <title>SemaJSX Ref Examples</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="${import.meta.url}"></script>
  </body>
</html>`,
      {
        headers: { "Content-Type": "text/html" },
      },
    );
  },
};
