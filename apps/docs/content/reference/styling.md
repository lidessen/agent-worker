---
title: Styling
description: Modular, signal-reactive CSS with @semajsx/style
order: 5
category: Styling
---

# Styling

`semajsx/style` provides a modular CSS-in-JS system with native CSS syntax, tree-shaking, and signal reactivity.

## Core API

### `classes()` — Scoped Class Names

Generate unique, collision-free class names:

```ts
import { classes } from "semajsx/style";

const c = classes(["root", "active", "disabled"]);

console.log(c.root.toString()); // "root_x7k2" (hashed)
console.log(c.active.toString()); // "active_x7k2"
```

### `rule` — CSS Rules

Write CSS with template literals, interpolating class refs:

```ts
import { classes, rule } from "semajsx/style";

const c = classes(["btn", "primary"]);

export const root = rule`${c.btn} {
  display: inline-flex;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}`;

export const primary = rule`${c.primary} {
  background: #0071e3;
  color: white;
}`;
```

### `rules()` — Combine Multiple Rules

Group related rules (e.g., hover states) into a single token:

```ts
import { classes, rule, rules } from "semajsx/style";

const c = classes(["btn"]);

export const states = rules(
  rule`${c.btn}:hover { background: #0077ed; }`,
  rule`${c.btn}:active { transform: scale(0.98); }`,
  rule`${c.btn}:focus-visible { outline: 2px solid #0071e3; outline-offset: 2px; }`,
);
```

## Using Styles in Components

Apply style tokens as class values in JSX:

```tsx
/** @jsxImportSource semajsx/dom */

import * as styles from "./button.style";

function Button({ children }) {
  return <button class={[styles.root, styles.states, styles.primary]}>{children}</button>;
}
```

SemaJSX automatically resolves arrays and nested arrays of class values.

## Design Tokens

Define a token system for consistent theming:

```ts
import { defineTokens } from "semajsx/style";

export const tokens = defineTokens({
  colors: {
    primary: "#0071e3",
    text: "#1d1d1f",
    background: "#fbfbfd",
  },
  space: {
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
  },
  radii: {
    sm: "6px",
    md: "12px",
  },
});

// Use in rules — renders as CSS custom properties
const c = classes(["box"]);
const box = rule`${c.box} {
  color: ${tokens.colors.text};
  padding: ${tokens.space.md};
  border-radius: ${tokens.radii.md};
}`;
```

## Themes

Create light and dark themes from the same tokens:

```ts
import { createTheme } from "semajsx/style";
import { tokens } from "./tokens";

// Light theme (applied to :root)
export const lightTheme = createTheme(tokens);

// Dark theme (scoped to a CSS class)
export const darkTheme = createTheme(tokens, {
  colors: {
    primary: "#2997ff",
    text: "#f5f5f7",
    background: "#000000",
  },
});
```

Apply themes:

```tsx
import { inject } from "semajsx/style";
import { lightTheme, darkTheme } from "./themes";

// Inject light theme globally
inject(lightTheme);

// Scope dark theme to an element
<div class={darkTheme}>
  <p>Dark mode content</p>
</div>;
```

## Signal-Reactive Styles

Interpolate signals directly in CSS rules for dynamic styling:

```ts
import { signal } from "semajsx/signal";
import { classes, rule } from "semajsx/style";

const bgColor = signal("#ffffff");
const c = classes(["container"]);

export const container = rule`${c.container} {
  background: ${bgColor};
  transition: background 0.3s ease;
}`;

// Updating the signal automatically updates the CSS
bgColor.value = "#1f2937";
```

## Animations

Define keyframe animations:

```ts
import { keyframes, keyframesToken, classes, rule } from "semajsx/style";

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

const c = classes(["element"]);
export const animated = rule`${c.element} {
  animation: ${fadeIn} 0.3s ease forwards;
}`;
```

Pre-built animations are also available:

```ts
import { fadeIn, slideUp, scaleIn } from "semajsx/style";
```

## Responsive Design

Use breakpoints for responsive rules:

```ts
import { breakpoints, media } from "semajsx/style";

// Default breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
export const responsive = media(
  breakpoints.md.min,
  rule`${c.grid} { grid-template-columns: repeat(2, 1fr); }`,
);
```

## SSR / SSG Integration

Extract CSS for server rendering:

```tsx
import { preload, extractCss } from "semajsx/style";
import * as buttonStyles from "./button.style";

preload(buttonStyles);
const css = extractCss(buttonStyles);

// Include in <style> tag
<style>{css}</style>;
```

## Next Steps

- Explore [Tailwind Utilities](/reference/tailwind) for utility-first styling
- Learn about [Components](/reference/components) and composition
- See the [Style System Examples](/guides/styling-examples) guide
