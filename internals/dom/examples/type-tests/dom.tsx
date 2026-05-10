/** @jsxImportSource @semajsx/dom */

/**
 * Test file for DOM TypeScript definitions
 * This file should have full type checking for HTML elements
 */

// Test basic HTML elements with proper type checking
const app = (
  <div className="container" id="app" style={{ color: "red" }}>
    <h1>Hello World</h1>
    <p className="text">
      This is a paragraph with <strong>bold</strong> and <em>italic</em> text.
    </p>

    {/* Test form elements */}
    <form onSubmit={(e) => console.log(e)}>
      <input type="text" placeholder="Enter your name" value="" onChange={(e) => console.log(e)} />
      <button type="submit" disabled={false}>
        Submit
      </button>
    </form>

    {/* Test anchor with proper attributes */}
    <a href="https://example.com" target="_blank" rel="noopener noreferrer">
      Link
    </a>

    {/* Test image */}
    <img src="/image.png" alt="Description" width={100} height={100} />

    {/* Test event handlers */}
    <button
      onClick={(e) => console.log("clicked", e)}
      onMouseEnter={(e) => console.log("entered", e)}
    >
      Click me
    </button>

    {/* Test ARIA attributes */}
    <div role="button" aria-label="Close" aria-hidden={false}>
      Close
    </div>

    {/* Test data attributes */}
    <div data-test-id="my-div" data-value={123}>
      Data attributes
    </div>
  </div>
);

export default app;
