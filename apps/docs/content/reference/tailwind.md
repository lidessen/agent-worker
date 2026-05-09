---
title: Tailwind Utilities
description: Tree-shakeable Tailwind-style utility classes for SemaJSX
order: 6
category: Styling
---

# Tailwind Utilities

`semajsx/tailwind` provides tree-shakeable Tailwind CSS utility classes as named imports. No build plugin, no purging — just import what you use.

## Installation

Tailwind utilities are included in the `semajsx` package:

```bash
bun add semajsx
```

## Basic Usage

Import utility classes directly:

```tsx
/** @jsxImportSource semajsx/dom */

import { p4, bgBlue500, textWhite, roundedLg, fontBold } from "semajsx/tailwind";

function Badge() {
  return <span class={[p4, bgBlue500, textWhite, roundedLg, fontBold]}>New</span>;
}
```

## Composing with `cx()`

Use `cx()` to merge classes with conditional logic:

```tsx
import { cx, p4, bgBlue500, bgGray200, textWhite, textGray800, opacity50 } from "semajsx/tailwind";

function Button({ primary, disabled, children }) {
  return (
    <button
      class={cx(
        p4,
        primary ? [bgBlue500, textWhite] : [bgGray200, textGray800],
        disabled && opacity50,
      )}
    >
      {children}
    </button>
  );
}
```

## Available Utilities

Utilities follow Tailwind naming with flat camelCase:

| Tailwind Class | SemaJSX Import | Category   |
| -------------- | -------------- | ---------- |
| `p-4`          | `p4`           | Spacing    |
| `px-6`         | `px6`          | Spacing    |
| `m-auto`       | `mAuto`        | Spacing    |
| `bg-blue-500`  | `bgBlue500`    | Color      |
| `text-white`   | `textWhite`    | Color      |
| `text-lg`      | `textLg`       | Typography |
| `font-bold`    | `fontBold`     | Typography |
| `rounded-md`   | `roundedMd`    | Border     |
| `flex`         | `flex`         | Layout     |
| `grid`         | `grid`         | Layout     |
| `w-full`       | `wFull`        | Sizing     |
| `hidden`       | `hidden`       | Display    |
| `opacity-50`   | `opacity50`    | Effects    |
| `z-10`         | `z10`          | Position   |

## Arbitrary Values

Use tagged templates for custom values:

```tsx
import { p, bg, text, w } from "semajsx/tailwind";

<div class={[p`12px`, bg`#ff6600`, text`1.25rem`, w`calc(100% - 2rem)`]}>Custom values</div>;
```

## Combining with @semajsx/style

Use Tailwind for layout and spacing, `@semajsx/style` for complex styles:

```tsx
import { p4, flex, gap4 } from "semajsx/tailwind";
import { rule, classes } from "semajsx/style";

const c = classes(["card"]);
const cardStyle = rule`${c.card} {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease;
}`;
const cardHover = rule`${c.card}:hover {
  transform: translateY(-2px);
}`;

function Card({ children }) {
  return <div class={[cardStyle, cardHover, p4, flex, gap4]}>{children}</div>;
}
```

## Tree-Shaking

Only imported utilities are included in the bundle. Unused classes are automatically removed by your bundler:

```tsx
// Only these 3 utilities end up in the bundle
import { flex, p4, gap2 } from "semajsx/tailwind";
```

## Next Steps

- Learn the full [Styling](/reference/styling) system with `@semajsx/style`
- See practical examples in the [Style System Examples](/guides/styling-examples) guide
