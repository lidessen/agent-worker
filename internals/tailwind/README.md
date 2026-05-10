# @semajsx/tailwind

Type-safe, tree-shakeable Tailwind utilities for JavaScript. Write Tailwind in TypeScript with full IDE support.

## Installation

```bash
# npm
npm install @semajsx/tailwind

# bun
bun add @semajsx/tailwind
```

## Quick Start

```tsx
import {
  cx,
  p4,
  m4,
  wFull,
  flex,
  flexCol,
  justifyCenter,
  roundedLg,
  bgBlue500,
} from "@semajsx/tailwind";

function Card({ children }) {
  return (
    <div class={cx(p4, m4, wFull, flex, flexCol, justifyCenter, roundedLg, bgBlue500)}>
      {children}
    </div>
  );
}
// Generates: class="p-4 m-4 w-full flex flex-col justify-center rounded-lg bg-blue-500"
```

---

## Why @semajsx/tailwind?

| Traditional Tailwind        | @semajsx/tailwind           |
| --------------------------- | --------------------------- |
| `className="p-4 w-full"`    | `cx(p4, wFull)`             |
| No autocomplete for classes | Full IDE autocomplete       |
| Typos silently fail         | TypeScript catches errors   |
| No tree-shaking             | Unused utilities eliminated |
| Runtime string parsing      | Zero runtime overhead       |

### Design Philosophy

> **"学我者生，似我者死"** — Don't mechanically convert CSS patterns to JavaScript. Design for JavaScript's strengths.

This library is designed around:

- **Static analysis**: TypeScript knows every utility
- **Tree-shaking**: Import only what you use
- **Composability**: Functions, not strings
- **IDE intelligence**: Autocomplete shows all options

---

## Core API

### `cx(...tokens)`

Combines multiple tokens into a single class string.

```tsx
import { cx, p4, m4, wFull, flex } from "@semajsx/tailwind";

// Basic usage
<div class={cx(p4, m4, wFull, flex)}>
// Output: class="p-4 m-4 w-full flex"

// Conditional classes
<button class={cx(
  p4,
  isActive && bgBlue500,
  isDisabled && opacity50,
  size === "large" && text2xl
)}>

// Nested arrays
const base = [p4, m4];
const colors = [bgBlue500, textWhite];
<div class={cx(base, colors)}>

// Mix with string classes
<div class={cx(p4, "custom-class", externalClassName)}>
```

### Flat Exports (Recommended)

Import utilities directly for optimal tree-shaking:

```ts
import { p4, px8, my2, wFull, hScreen, flexCol, justifyCenter } from "@semajsx/tailwind";
```

### Namespace Imports

Group related utilities for organization:

```ts
import { spacing, sizing, layout, flexbox, effects, typography } from "@semajsx/tailwind";

<div class={cx(spacing.p4, sizing.wFull, flexbox.flexCol)}>
```

### Tagged Templates (Arbitrary Values)

For values not in the preset scale:

```ts
import { p, w, h, top, rounded } from "@semajsx/tailwind";

<div class={cx(
  p`10px`,           // padding: 10px
  w`calc(100%-40px)`, // width: calc(100%-40px)
  h`300px`,          // height: 300px
  top`50%`,          // top: 50%
  rounded`6px`       // border-radius: 6px
)}>
```

---

## Utility Reference

### Spacing

```ts
// Padding
(p4, p8, p16); // all sides
(px4, py8); // horizontal, vertical
(pt4, pr4, pb4, pl4); // individual sides

// Margin
(m4, m8, mAuto); // all sides
(mx4, my8, mxAuto); // horizontal, vertical
(mt4, mr4, mb4, ml4); // individual sides

// Gap
(gap4, gap8); // flex/grid gap
(gapX4, gapY8); // row/column gap

// Arbitrary
(p`10px`, m`0.5rem`, gap`20px`);
```

### Sizing

```ts
// Width
(w4, w8, w64); // fixed widths
(wFull, wScreen); // 100%, 100vw
(wHalf, wThird); // 50%, 33.333%
(wAuto, wMin, wMax); // auto, min-content, max-content

// Height
(h4, h8, h64); // fixed heights
(hFull, hScreen); // 100%, 100vh
(hAuto, hMin, hMax); // auto, min-content, max-content

// Min/Max
(minW0, minWFull); // min-width
(maxWLg, maxW2xl); // max-width
(minH0, minHFull); // min-height
maxHScreen; // max-height

// Arbitrary
(w`300px`, h`50vh`, maxW`800px`);
```

### Layout

```ts
// Position
(static, relative, absolute, fixed, sticky);

// Inset
(top0, top4, topFull, topAuto);
(right0, right4);
(bottom0, bottom4);
(left0, left4);
(inset0, insetX4, insetY4);

// Z-Index
(z0, z10, z20, z30, z40, z50, zAuto);

// Overflow
(overflowHidden, overflowAuto, overflowScroll);
(overflowXHidden, overflowYAuto);

// Arbitrary
(top`50%`, left`calc(50% - 100px)`, z`999`);
```

### Flexbox

```ts
// Display
(flex, inlineFlex, block, inlineBlock, grid, hidden);

// Direction
(flexRow, flexCol, flexRowReverse, flexColReverse);

// Wrap
(flexWrap, flexWrapReverse, flexNowrap);

// Justify Content
(justifyStart, justifyCenter, justifyEnd);
(justifyBetween, justifyAround, justifyEvenly);

// Align Items
(itemsStart, itemsCenter, itemsEnd);
(itemsBaseline, itemsStretch);

// Align Self
(selfStart, selfCenter, selfEnd, selfStretch);

// Flex
(flex1, flexAuto, flexInitial, flexNone);

// Grow/Shrink
(grow, grow0, shrink, shrink0);

// Order
(order1, order2, orderFirst, orderLast, orderNone);
```

### Typography

```ts
// Font Size
(textXs, textSm, textBase, textLg, textXl);
(text2xl, text3xl, text4xl, text5xl, text6xl);

// Font Weight
(fontThin, fontLight, fontNormal, fontMedium);
(fontSemibold, fontBold, fontExtrabold, fontBlack);

// Line Height
(leadingNone, leadingTight, leadingSnug);
(leadingNormal, leadingRelaxed, leadingLoose);

// Text Align
(textLeft, textCenter, textRight, textJustify);

// Text Transform
(uppercase, lowercase, capitalize, normalCase);

// Text Decoration
(underline, lineThrough, noUnderline);

// Text Overflow
(truncate, textEllipsis, textClip);

// Whitespace
(whitespaceNormal, whitespaceNowrap, whitespacePre);
```

### Effects

```ts
// Border Radius
(rounded, roundedSm, roundedMd, roundedLg, roundedXl);
(rounded2xl, rounded3xl, roundedFull, roundedNone);

// Per-corner
(roundedTl, roundedTr, roundedBl, roundedBr);

// Border Width
(border, border0, border2, border4, border8);
(borderT, borderR, borderB, borderL);

// Border Style
(borderSolid, borderDashed, borderDotted, borderNone);

// Shadow
(shadowSm, shadow, shadowMd, shadowLg, shadowXl);
(shadow2xl, shadowInner, shadowNone);

// Opacity
(opacity0, opacity25, opacity50, opacity75, opacity100);

// Cursor
(cursorPointer, cursorDefault, cursorMove, cursorNotAllowed);

// Arbitrary
(rounded`6px`, shadow`0 4px 6px rgba(0,0,0,0.1)`);
```

### Colors

```ts
// Background
(bgBlue500, bgRed500, bgGreen500, bgGray100);
(bgWhite, bgBlack, bgTransparent);

// Text
(textBlue500, textRed500, textGreen500, textGray700);
(textWhite, textBlack);

// Border
(borderBlue500, borderRed500, borderGray300);
```

---

## Configuration

### Prefix

Add a prefix to all class names for namespace isolation:

```ts
import { configureTailwind } from "@semajsx/tailwind";

// At app initialization (before any component renders)
configureTailwind({ prefix: "s-" });

// Now all utilities generate prefixed class names:
// p4._  → "s-p-4"
// wFull._ → "s-w-full"
```

---

## Naming Convention

The naming follows a consistent pattern optimized for JavaScript:

| CSS Class        | @semajsx/tailwind | Pattern                 |
| ---------------- | ----------------- | ----------------------- |
| `p-4`            | `p4`              | `{prefix}{number}`      |
| `w-full`         | `wFull`           | `{prefix}{Capitalized}` |
| `w-1/2`          | `wHalf`           | Semantic fraction name  |
| `flex-col`       | `flexCol`         | `{utility}{Variant}`    |
| `justify-center` | `justifyCenter`   | `{utility}{Variant}`    |
| `z-50`           | `z50`             | `{prefix}{number}`      |

### Why Merged Names?

```ts
// ✅ Good: merged naming
import { p4, wHalf, flexCol } from "@semajsx/tailwind";

// ❌ Avoided: bracket notation (no tree-shaking, awkward)
import { p } from "@semajsx/tailwind";
p["4"]; // Would need proxy, can't tree-shake
```

Merged names enable:

- Full tree-shaking (each export is independently eliminable)
- IDE autocomplete shows all options
- No runtime proxy overhead
- Natural JavaScript identifiers

---

## Advanced Usage

### Extracting CSS (SSR)

```ts
import { extractCss, p4, m4, wFull } from "@semajsx/tailwind";

const css = extractCss(p4, m4, wFull);
// ".p-4 { padding: 1rem; }\n.m-4 { margin: 1rem; }\n.w-full { width: 100%; }"

// Inject in SSR
const html = `
  <style>${css}</style>
  <div class="p-4 m-4 w-full">...</div>
`;
```

### Creating Custom Utilities

```ts
import { createUtility, createTaggedUtility } from "@semajsx/tailwind";

// Fixed-value utility
const myPadding = createUtility("padding", "my-p");
const myP4 = myPadding("1rem", "4");
// myP4._ → "my-p-4"
// myP4.__cssTemplate → ".my-p-4 { padding: 1rem; }"

// Arbitrary-value utility
const myP = createTaggedUtility(createUtility("padding", "my-p"));
myP`20px`; // → ".my-p-20px { padding: 20px; }"
```

### Conditional Composition

```tsx
function Button({ variant, size, disabled }) {
  const variantStyles = {
    primary: [bgBlue500, textWhite],
    secondary: [bgGray200, textGray800],
    danger: [bgRed500, textWhite],
  };

  const sizeStyles = {
    sm: [px2, py1, textSm],
    md: [px4, py2, textBase],
    lg: [px6, py3, textLg],
  };

  return (
    <button
      class={cx(
        // Base
        roundedMd,
        fontMedium,
        border0,
        cursorPointer,
        // Variant
        variantStyles[variant],
        // Size
        sizeStyles[size],
        // State
        disabled && [opacity50, cursorNotAllowed],
      )}
    >
      {children}
    </button>
  );
}
```

---

## Migration from Tailwind

| Tailwind HTML                         | @semajsx/tailwind                |
| ------------------------------------- | -------------------------------- |
| `class="p-4"`                         | `cx(p4)`                         |
| `class="w-full h-screen"`             | `cx(wFull, hScreen)`             |
| `class="flex flex-col"`               | `cx(flex, flexCol)`              |
| `class="justify-center items-center"` | `cx(justifyCenter, itemsCenter)` |
| `class="rounded-lg shadow-md"`        | `cx(roundedLg, shadowMd)`        |
| `class="bg-blue-500 text-white"`      | `cx(bgBlue500, textWhite)`       |
| `class="hover:bg-blue-600"`           | Not yet supported (use CSS)      |
| `class="md:flex"`                     | Not yet supported (use CSS)      |

### What's Different

1. **No hover/focus variants**: Use CSS pseudo-classes with `@semajsx/style` or traditional CSS
2. **No responsive variants**: Use CSS media queries
3. **Type-safe**: Typos are caught at compile time
4. **Tree-shakeable**: Unused utilities don't appear in bundle

---

## TypeScript

All utilities are fully typed:

```ts
import { p4, wFull, cx } from "@semajsx/tailwind";

// Autocomplete works
p4._; // "p-4"
p4.__cssTemplate; // ".p-4 { padding: 1rem; }"

// Type checking
cx(p4, wFull); // OK
cx(p4, "custom"); // OK (strings allowed)
cx(p4, undefined); // OK (falsy values filtered)
cx(p4, nonExistent); // Error: Cannot find name 'nonExistent'
```

---

## Best Practices

### Do: Use Flat Imports

```ts
// ✅ Tree-shakeable
import { p4, wFull } from "@semajsx/tailwind";

// ⚠️ Imports entire namespace (less optimal, but OK)
import { spacing } from "@semajsx/tailwind";
```

### Do: Compose with cx()

```ts
// ✅ Clean composition
const base = [p4, roundedMd];
<div class={cx(base, isActive && bgBlue500)}>

// ❌ String concatenation
<div class={`${p4} ${isActive ? bgBlue500 : ""}`}>
```

### Do: Extract Repeated Patterns

```ts
// ✅ Reusable style arrays
const cardBase = [p4, roundedLg, shadowMd, bgWhite];
const buttonBase = [px4, py2, roundedMd, fontMedium];

<div class={cx(cardBase, m4)}>
<button class={cx(buttonBase, bgBlue500, textWhite)}>
```

### Don't: Use for Dynamic Values

```ts
// ❌ Don't use arbitrary values for truly dynamic values
const dynamicWidth = w`${someVariable}px`;  // Creates new class each render

// ✅ Use inline styles for dynamic values
<div style={{ width: `${someVariable}px` }} class={cx(p4, flex)}>
```

---

## Comparison

| Feature          | @semajsx/tailwind    | Tailwind CSS     | CSS-in-JS            |
| ---------------- | -------------------- | ---------------- | -------------------- |
| Type safety      | ✅ Full              | ❌ None          | ✅ Varies            |
| Tree-shaking     | ✅ Per-utility       | ⚠️ PurgeCSS      | ✅ Yes               |
| IDE autocomplete | ✅ Native TS         | ⚠️ Plugin needed | ✅ Varies            |
| Bundle size      | ✅ Only used         | ⚠️ All generated | ✅ Only used         |
| Zero runtime     | ✅ Yes               | ✅ Yes           | ❌ Most have runtime |
| Learning curve   | Low (Tailwind names) | Low              | Varies               |

---

## See Also

- [@semajsx/style](../style/README.md) - CSS-in-JS with native CSS syntax
- [Naming Convention](./NAMING_CONVENTION.md) - Detailed naming rules
- [Tailwind CSS](https://tailwindcss.com) - Original inspiration
