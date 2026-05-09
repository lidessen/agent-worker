---
title: Getting Started
description: Learn how to install and use SemaJSX in your projects
order: 1
category: Introduction
---

# Getting Started

Welcome to SemaJSX! This guide will help you get started with SemaJSX, a lightweight, signal-based reactive JSX runtime.

## What is SemaJSX?

SemaJSX is a modern JSX runtime that uses **fine-grained reactivity** with signals for efficient updates without virtual DOM diffing. It supports multiple rendering targets:

- **DOM** - Standard web browser rendering
- **Terminal** - CLI applications with Ink-like API
- **SSR** - Server-side rendering
- **SSG** - Static site generation

## Architecture

```mermaid
graph TD
  A[semajsx] <--> B[semajsx/core]
  A <--> C[semajsx/signal]
  A <--> D[semajsx/dom]
  A <--> E[semajsx/terminal]
  B --> C
  D --> B
  E --> B
  F[semajsx/ssr] --> D
  G[semajsx/ssg] --> F
  H[semajsx/mermaid] --> B
  H --> C
```

```mermaid raw
graph TD
  A[semajsx] <--> B[semajsx/core]
  A <--> C[semajsx/signal]
  A <--> D[semajsx/dom]
  A <--> E[semajsx/terminal]
  B --> C
  D --> B
  E --> B
  F[semajsx/ssr] --> D
  G[semajsx/ssg] --> F
  H[semajsx/mermaid] --> B
  H --> C
```

## Installation

Install SemaJSX using your favorite package manager:

```bash
# Using Bun (recommended)
bun add semajsx

# Using npm
npm install semajsx

# Using pnpm
pnpm add semajsx
```

<Callout type="tip" title="Bun is recommended">
SemaJSX is built with Bun and works best with Bun's fast runtime and built-in TypeScript support.
</Callout>

## Quick Example

Here's a simple counter example using SemaJSX:

```tsx
/** @jsxImportSource semajsx/dom */

import { signal } from "semajsx/signal";
import { render } from "semajsx/dom";

function Counter() {
  const count = signal(0);

  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={() => count.value++}>Increment</button>
      <button onClick={() => count.value--}>Decrement</button>
    </div>
  );
}

render(<Counter />, document.getElementById("app"));
```

## TypeScript Configuration

Add JSX configuration to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "semajsx/dom"
  }
}
```

## Next Steps

- Learn about [Signals](/reference/signals) for reactive state management
- Explore [Components](/reference/components) and how to build with JSX
- Check out [SSR](/reference/ssr) for server-side rendering
- Try [SSG](/reference/ssg) for static site generation
- Render [Mermaid Diagrams](/reference/mermaid) as reactive SVG

<Callout type="success" title="Ready to build!">
You're all set! Start building amazing applications with SemaJSX.
</Callout>
