/** @jsxImportSource @semajsx/dom */

import { Counter } from "./Counter";
import { TodoList } from "./TodoList";
import { Pagination } from "./Pagination";
import {
  AsyncCounter,
  SignalComponent,
  StreamingComponent,
  ConditionalComponent,
} from "./SpecialComponents";

/**
 * Main App component with static and interactive content
 */
export function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SemaJSX SSR Islands Demo</title>
        <style>
          {`
            body {
              font-family: system-ui, -apple-system, sans-serif;
              max-width: 800px;
              margin: 0 auto;
              padding: 20px;
              background: #f9fafb;
              color: #1f2937;
            }
            h1 {
              color: #1f2937;
              border-bottom: 3px solid #3b82f6;
              padding-bottom: 10px;
            }
            h2 {
              color: #374151;
              margin-top: 30px;
            }
            p, li {
              color: #374151;
            }
            .static-content {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            button {
              padding: 8px 16px;
              font-size: 14px;
              cursor: pointer;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              background: white;
              color: #1f2937;
            }
            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
            @media (prefers-color-scheme: dark) {
              body {
                background: #111827;
                color: #f9fafb;
              }
              h1 {
                color: #f9fafb;
              }
              h2 {
                color: #e5e7eb;
              }
              p, li {
                color: #d1d5db;
              }
              .static-content {
                background: #1f2937;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              }
              button {
                background: #374151;
                color: #f9fafb;
                border-color: #4b5563;
              }
            }
          `}
        </style>
      </head>
      <body>
        <h1>🏝️ SemaJSX SSR Islands Architecture Demo</h1>

        <div class="static-content">
          <h2>What is this?</h2>
          <p>
            This page demonstrates <strong>SSR Islands</strong> - a technique where server-rendered
            HTML contains "islands" of interactivity.
          </p>
          <p>
            The static content (like this text) is rendered on the server and sent as HTML. The
            interactive components below are <strong>islands</strong> that hydrate on the client
            side.
          </p>
        </div>

        <h2>📊 Static Content</h2>
        <div class="static-content">
          <p>
            This is <em>static content</em> rendered on the server. It doesn't need JavaScript and
            loads instantly.
          </p>
          <ul>
            <li>✅ Fast initial load</li>
            <li>✅ SEO friendly</li>
            <li>✅ No JavaScript needed</li>
          </ul>
        </div>

        <h2>🎮 Interactive Islands</h2>
        <p style={{ color: "#6b7280" }}>
          The components below are marked as islands and will hydrate on the client:
        </p>

        {/* Island 1: Counter */}
        <Counter initial={0} />

        <div class="static-content">
          <p>
            <strong>More static content between islands!</strong> This demonstrates that you can mix
            static and interactive content freely.
          </p>
        </div>

        {/* Island 2: TodoList */}
        <TodoList />

        <div class="static-content">
          <p>
            <strong>Fragment Island:</strong> The pagination below returns multiple elements without
            a wrapper (Fragment). This tests comment marker hydration.
          </p>
        </div>

        {/* Island 3: Pagination (Fragment island) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: "20px 0",
          }}
        >
          <Pagination total={10} />
        </div>

        <h2>🧪 Special Component Types</h2>
        <div class="static-content">
          <p>
            These components test special rendering patterns: async loading, signal reactivity,
            streaming updates, and conditional rendering.
          </p>
        </div>

        {/* Island 4: Async Component */}
        <AsyncCounter delay={500} />

        {/* Island 5: Signal Return Component */}
        <SignalComponent initial="Hello World" />

        {/* Island 6: Streaming Component */}
        <StreamingComponent total={3} />

        {/* Island 7: Conditional Component */}
        <ConditionalComponent showInitially={true} />

        <h2>🎯 Key Benefits</h2>
        <div class="static-content">
          <ul>
            <li>
              <strong>Selective Hydration:</strong> Only interactive components load JavaScript
            </li>
            <li>
              <strong>Faster Performance:</strong> Less JavaScript = faster page loads
            </li>
            <li>
              <strong>Runtime Discovery:</strong> Islands are discovered at render time
            </li>
            <li>
              <strong>Lazy Building:</strong> Island code is built on-demand
            </li>
          </ul>
        </div>

        <footer
          style={{
            marginTop: "40px",
            padding: "20px",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <p>Built with ❤️ using SemaJSX</p>
        </footer>
      </body>
    </html>
  );
}
