# RFC: Style System (@semajsx/style)

**Date**: 2026-01-10
**Author**: SemaJSX Team
**Status**: Draft

---

## 1. Summary

A modular styling system that treats CSS as JavaScript modules, enabling tree-shaking at the import level while maintaining native CSS syntax for developer ergonomics.

---

## 2. Motivation

### 2.1 Problem Statement

Current CSS solutions have fundamental trade-offs:

1. **CSS-in-JS** (Styled Components, Emotion): Good tree-shaking, but awkward syntax - writing CSS as JS objects or template literals loses native CSS tooling support.

2. **Traditional CSS/Sass**: Great developer experience, but build systems bundle all CSS into one file - no tree-shaking based on component usage.

3. **CSS Modules**: Scoped styles, but still bundled together - unused component styles remain in the bundle.

4. **Tailwind CSS**: Utility-first is powerful, but class strings lack type safety and IDE intelligence.

5. **Component Libraries**: Styles are tightly coupled to components (e.g., Material UI, Chakra). Even Radix UI + shadcn requires significant styling ceremony.

6. **Shadow DOM**: Most styling solutions don't handle Shadow DOM well - styles need to be injected into the shadow root, not document.head.

### 2.2 User Scenarios

- **As a component author**, I want to write styles in native CSS syntax, so that I get full IDE support (autocomplete, linting, formatting).

- **As an application developer**, I want unused component styles to be tree-shaken, so that my bundle only includes styles for components I actually use.

- **As a web component developer**, I want to control where styles are injected (Shadow DOM), so that my components are properly encapsulated.

- **As a design system maintainer**, I want to separate component logic from styling, so that consumers can easily customize or replace styles.

### 2.3 Success Metrics

- Styles tree-shake at the JS module level
- CSS syntax remains native (works with existing CSS tooling)
- Type-safe class name references
- Zero runtime CSS parsing
- Works with Shadow DOM out of the box

---

## 3. Background

### 3.1 Current State

SemaJSX currently has basic style support:

```tsx
// Inline styles
<div style={{ color: 'red' }}>

// Class strings
<div class="btn btn-primary">

// Signal-based reactive styles
const color = signal('red');
<div style={{ color }}>
```

No built-in solution for:

- Scoped styles
- Tree-shakeable CSS
- Shadow DOM style injection
- Type-safe class names

### 3.2 Why Now?

- Component library development is a common use case
- Shadow DOM adoption is increasing (Web Components)
- Bundle size optimization is critical for performance
- The signal-based architecture provides natural integration points for style injection lifecycle

---

## 4. Goals

- **Native CSS syntax**: Write real CSS, not JS objects
- **Tree-shakeable**: Unused styles are eliminated at build time
- **Type-safe**: Class names are typed, with IDE autocomplete
- **Framework-agnostic core**: `@semajsx/style` works standalone
- **SemaJSX integration**: Seamless integration with render lifecycle
- **Shadow DOM support**: Control style injection targets
- **Zero runtime parsing**: All CSS processing happens at definition time

---

## 5. Non-Goals

- **CSS preprocessor features**: No built-in Sass/Less compilation (use external tools)
- **Atomic CSS generation**: Not auto-generating utility classes like Tailwind
- **CSS-in-JS object syntax**: We explicitly prefer native CSS strings
- **Runtime HMR**: HMR is handled by build tools (Vite plugin), not the runtime

---

## 6. Research

### 6.1 Existing Solutions Comparison

| Solution        | Pros                                | Cons                                        | Applicability |
| --------------- | ----------------------------------- | ------------------------------------------- | ------------- |
| CSS Modules     | - Native CSS<br>- Scoped            | - No tree-shaking<br>- Build tool dependent | Medium        |
| Vanilla Extract | - Type-safe<br>- Zero runtime       | - CSS-in-JS syntax<br>- Complex setup       | Medium        |
| Linaria         | - Native CSS feel<br>- Zero runtime | - Build complexity<br>- Limited dynamic     | Medium        |
| StyleX (Meta)   | - Atomic<br>- Tree-shakeable        | - CSS-in-JS objects<br>- Meta-specific      | Low           |
| Panda CSS       | - Type-safe<br>- Flexible           | - Learning curve<br>- Build complexity      | Medium        |

### 6.2 Technical Feasibility

- **Dependencies**: None for core runtime
- **Build tools**: Optional Vite/esbuild plugin for .css → .css.ts transformation
- **Compatibility**: Works with any JS framework

### 6.3 Key Insight

The key insight is treating styles as **JavaScript modules** that bundlers can analyze and eliminate.

### 6.4 Tree-Shaking: How It Works

**Recommended Pattern: Named Exports**

```ts
// button.style.ts
import { classes, rule } from "@semajsx/style";

const c = classes(["root", "icon", "primary", "secondary", "large"]);

export const root = rule`${c.root} { display: inline-flex; padding: 8px 16px; }`;
export const icon = rule`${c.icon} { width: 18px; height: 18px; }`;
export const primary = rule`${c.primary} { background: var(--primary); color: white; }`;
export const secondary = rule`${c.secondary} { background: var(--secondary); }`;
export const large = rule`${c.large} { padding: 12px 24px; font-size: 18px; }`;
```

**Usage options:**

```ts
// Option 1: Namespace import (recommended - feels like object access)
import * as button from "./button.style";
<div class={[button.root, button.primary]}>

// Option 2: Named imports (explicit, best tree-shaking)
import { root, primary } from "./button.style";
<div class={[root, primary]}>
```

**Tree-shaking behavior:**

```
// If component only uses: import { root, primary } from "./button.style"
// Bundler eliminates: icon, secondary, large ✅

// If component uses: import * as button from "./button.style"
// And only accesses button.root and button.primary
// Modern bundlers (Rollup, esbuild) can still eliminate unused exports ✅
```

**Module-level elimination also works:**

```
components/
├── Button/
│   └── button.style.ts   → imported by Button.tsx → included
├── Card/
│   └── card.style.ts     → imported by Card.tsx → included
└── Tooltip/
    └── tooltip.style.ts  → NOT imported anywhere → ELIMINATED
```

**Why NOT object exports:**

```ts
// ❌ Avoid this pattern - no tree-shaking
export const button = {
  root: rule`...`,
  icon: rule`...`, // Included even if unused
  large: rule`...`, // Included even if unused
};
```

Object properties cannot be tree-shaken. If you import `button`, you get everything.

**Practical impact:**

| Pattern                         | Bundle Size        | DOM Size              |
| ------------------------------- | ------------------ | --------------------- |
| Named exports, selective import | ✅ Only imported   | ✅ Only used injected |
| `import * as styles`, some used | ✅ Only accessed\* | ✅ Only used injected |
| Object export, some used        | ❌ All properties  | ✅ Only used injected |
| Module not imported             | ✅ Eliminated      | ✅ No styles          |

\*Modern bundlers with good static analysis

**Summary:**

- **Default to named exports** (`export const primary = ...`)
- **Use `import * as styles`** for namespace-style access
- **Use `import { primary }`** for explicit imports
- **Avoid object exports** (`export const button = { ... }`)

---

## 7. High-Level Proposal

### 7.1 Core Concept: Style as Module

```ts
// button.style.ts
import { classes, rule, rules } from "@semajsx/style";

const c = classes(["root", "icon", "label"]);

/** display: inline-flex; padding: 8px 16px */
export const root = rule`${c.root} {
  display: inline-flex;
  padding: 8px 16px;
}`;

/** width: 18px; height: 18px */
export const icon = rule`${c.icon} {
  width: 18px;
  height: 18px;
}`;

/** font-weight: 500 */
export const label = rule`${c.label} {
  font-weight: 500;
}`;

/** margin-right: 8px (icon inside root) */
export const rootIcon = rule`${c.root} > ${c.icon} {
  margin-right: 8px;
}`;

/** hover state */
export const rootHover = rule`${c.root}:hover {
  background: var(--hover);
}`;

/** multiple rules for states */
export const states = rules(
  rule`${c.root}:active { transform: scale(0.98); }`,
  rule`${c.root}:disabled { opacity: 0.5; cursor: not-allowed; }`,
);
```

**Usage:**

```tsx
// Namespace import (recommended)
import * as button from "./button.style";

<button class={[button.root, button.states]}>
  <span class={button.icon}>{icon}</span>
  <span class={button.label}>{children}</span>
</button>;
```

### 7.2 Key Components

1. **ClassRef**: A reference to a class name that stringifies to a hashed value
2. **StyleToken**: Contains className (if applicable) + CSS rule, can be used in class prop or injected
3. **StyleAnchor**: Controls where styles are injected in the DOM

### 7.3 Two-Level Anchor System

**App Anchor**: Global style injection target

```tsx
// Default: document.head
// Can be set for Shadow DOM:
<AppStyleAnchor target={shadowRoot} />
```

**Component Anchor**: Per-component injection (does NOT affect children)

```tsx
function MyComponent() {
  return (
    <ComponentStyleAnchor target={localStyleContainer}>
      <div class={button.root}>...</div>
    </ComponentStyleAnchor>
  );
}
```

Rules:

- Component Anchor only affects the component where it's declared
- Child components use their own anchor or fall back to App Anchor
- If no anchor exists, defaults to `document.head`

---

## 8. Detailed API Design

### 8.1 `@semajsx/style` (Standalone Package)

#### `classes(names: string[]): ClassRefs`

Creates class name references with hashed values.

```ts
const c = classes(["root", "icon", "label"]);

c.root.toString(); // "root-x7f3a"
`${c.root}`; // "root-x7f3a"
```

#### `` rule`selector { css }` `` - Tagged Template Syntax

Creates a StyleToken from a tagged template containing selector and CSS block.

```ts
// Simple class selector
const root = rule`${c.root} {
  padding: 8px 16px;
  display: flex;
}`;
// root._ = "root-x7f3a"
// root.__css = ".root-x7f3a { padding: 8px 16px; display: flex; }"

// Pseudo-class selector
const rootHover = rule`${c.root}:hover {
  background: blue;
}`;
// rootHover._ = undefined (no direct className, injection only)
// rootHover.__css = ".root-x7f3a:hover { background: blue; }"

// Descendant combinator
const rootIcon = rule`${c.root} > ${c.icon} {
  margin-right: 8px;
}`;
// rootIcon.__css = ".root-x7f3a > .icon-b2c4d { margin-right: 8px; }"

// Attribute selector
const rootDisabled = rule`${c.root}[disabled] { opacity: 0.5; }`;

// Global selector (no ClassRef)
const bodyReset = rule`body { margin: 0; }`;
```

**Why tagged template?**

- Single unified syntax for all selectors (simple, complex, global)
- ClassRef interpolation preserves type information and generates correct hashes
- Native CSS syntax - selector and block together, just like real CSS
- No confusion between function call vs tagged template

#### `rules(...tokens): StyleToken` - Combine Multiple Rules

Combines multiple StyleTokens into a single token for grouped injection.

```ts
const buttonStates = rules(
  rule`${c.root}:hover { background: blue; }`,
  rule`${c.root}:active { transform: scale(0.98); }`,
  rule`${c.root}:disabled { opacity: 0.5; }`,
);
// buttonStates.__css contains all three rules concatenated

// Combine base styles with states
const allStyles = rules(
  rule`${c.root} { padding: 8px; }`,
  rule`${c.icon} { width: 18px; }`,
  rule`${c.root} > ${c.icon} { margin-right: 8px; }`,
);
```

#### Reactive Values with Signals

When a signal is interpolated in `rule`, the system automatically:

1. Generates CSS with `var()` placeholders
2. Binds signals to CSS variables when the token is used in `class`
3. Updates element styles when signals change

**Design Principle:**

```
┌─────────────────────────────────────────────────────────────┐
│  rule`${c.box} { height: ${signal}px; }`                    │
│                 ↓                                           │
│  CSS generated: .box-xxx { height: var(--_v0); }            │
│  Token stores:  __bindings: [[signal, '--_v0', 'px']]       │
│                 ↓                                           │
│  class={token}  →  Inject CSS + subscribe signals           │
│                 ↓                                           │
│  Signal update  →  element.style.setProperty('--_v0', ...)  │
└─────────────────────────────────────────────────────────────┘
```

**Dynamic Rule with Signal Interpolation:**

```ts
// box.style.ts
import { classes, rule } from "@semajsx/style";
import type { Signal } from "@semajsx/signal";

const c = classes(["box"]);

// Signals are interpolated directly in the template
export const box = (height: Signal<number>, bg: Signal<string>) =>
  rule`${c.box} {
    height: ${height}px;
    background: ${bg};
    transition: all 0.3s;
  }`;
```

**Usage in SemaJSX - signal binding is automatic:**

```tsx
import { signal } from "@semajsx/signal";
import * as styles from "./box.style";

function Box() {
  const height = signal(100);
  const color = signal("#3b82f6");

  // Just use the token - signal binding is automatic
  return (
    <div class={styles.box(height, color)} onClick={() => (height.value += 10)}>
      Click to grow
    </div>
  );
}

// Rendered:
// <div class="box-x7f3a" style="--_v0: 100px; --_v1: #3b82f6">
//
// After click (signal update, no re-render):
// <div class="box-x7f3a" style="--_v0: 110px; --_v1: #3b82f6">
```

**How it works internally:**

`rule()` is a **pure function** - it only creates an immutable definition with no side effects. Variable name assignment and CSS injection are handled by `StyleAnchor`.

```ts
// rule() is pure - no global state, no side effects
function rule(strings: TemplateStringsArray, ...values: unknown[]): StyleToken {
  const bindingDefs: SignalBindingDef[] = [];

  // Build CSS template with placeholders for signals
  const cssTemplate = strings.reduce((acc, str, i) => {
    if (i === 0) return str;

    const value = values[i - 1];

    if (isClassRef(value)) {
      return acc + value.toString() + str;
    }

    if (isSignal(value)) {
      // Use placeholder {{index}} - variable name assigned by anchor later
      const index = bindingDefs.length;
      const unit = extractUnit(str);
      bindingDefs.push({ signal: value, index, unit });
      return acc + `{{${index}}}` + str;
    }

    return acc + String(value) + str;
  }, "");

  return {
    __kind: "style",
    _: extractClassName(cssTemplate),
    __cssTemplate: cssTemplate,
    __bindingDefs: bindingDefs.length > 0 ? bindingDefs : undefined,
    toString() {
      return this._ ?? "";
    },
  };
}
```

**Key insight: Separation of concerns**

```
┌─────────────────────────────────────────────────────────────────┐
│  rule() - Pure definition (module load time)                    │
│  ─────────────────────────────────────────                      │
│  Input:  rule`${c.box} { height: ${signal}px; }`                │
│  Output: { __cssTemplate: ".box-xxx { height: {{0}}px; }",      │
│            __bindingDefs: [{ signal, index: 0, unit: "px" }] }  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  StyleAnchor - Side effects (render time)                       │
│  ────────────────────────────────────────                       │
│  1. Assign variable name: signal → "--sig-x7f3a"                │
│  2. Generate final CSS: ".box-xxx { height: var(--sig-x7f3a); }"│
│  3. Inject CSS to target (if not already done)                  │
│  4. Set up signal subscription                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits of pure rule():**

- **Testable**: No global state to mock
- **SSR-friendly**: Each request has its own anchor, no shared state
- **Predictable**: Same input always produces same output
- **GC-friendly**: Tokens can be garbage collected when not referenced

**Static Rules (no signals):**

For static styles, just use regular values:

```ts
export const root = rule`${c.root} {
  display: flex;
  padding: 8px 16px;
}`;
// No __bindings, purely static CSS
```

**Token Caching:**

Same signal instances produce the same token:

```ts
const h = signal(100);
const c = signal("red");

const token1 = box(h, c);
const token2 = box(h, c);
token1 === token2; // true - same signals, cached token

const h2 = signal(100);
const token3 = box(h2, c);
token1 === token3; // false - different signal instance
```

**Usage in React:**

```tsx
import { useStyle, useSignal, StyleAnchor } from "@semajsx/style/react";
import * as styles from "./box.style";

function Box() {
  const cx = useStyle();
  const height = useSignal(100);
  const color = useSignal("#3b82f6");

  // cx() always returns string
  // StyleAnchor handles both CSS injection and signal bindings
  return (
    <StyleAnchor>
      <div className={cx(styles.box(height, color))} onClick={() => (height.value += 10)}>
        Click to grow
      </div>
    </StyleAnchor>
  );
}

// DOM structure:
// <div style="--_v0: 100px; --_v1: #3b82f6">  <!-- StyleAnchor -->
//   <div class="box-x7f3a">Click to grow</div>
// </div>
//
// After click (signal update directly to anchor, no React re-render!):
// <div style="--_v0: 110px; --_v1: #3b82f6">
//   <div class="box-x7f3a">Click to grow</div>
// </div>
```

**How it works:**

The `<StyleAnchor>` component handles both CSS injection and signal bindings. CSS variables are set on the anchor element and cascade to descendants via CSS inheritance. The anchor uses `display: contents` to avoid affecting layout.

**Benefits:**

- **Ergonomic**: Signal interpolation looks natural in CSS
- **Automatic binding**: No manual CSS variable mapping
- **Efficient updates**: Only CSS variable values change, no CSS re-injection
- **CSS transitions work**: `transition: all 0.3s` applies to variable changes
- **Memoized tokens**: Same signals = same cached token

#### `inject(tokens, options?): () => void`

Manually injects CSS into DOM. Supports single token, array, or object. Returns cleanup function.

**Important**: `inject()` only handles CSS stylesheet injection. It does NOT set up signal bindings for reactive tokens. Signal binding is handled separately:

- **SemaJSX**: The render system (`resolveClass()`) handles signal binding when processing `class` props (see Section 8.3)
- **React/Vue**: The `<StyleAnchor>` component captures signal bindings and sets up subscriptions (see Section 9.3)

```ts
// Single token
inject(button.root);

// Array of tokens
inject([button.root, button.icon, button.rootIcon]);

// Object - extracts all StyleTokens
inject(button);

// With target
inject(button, { target: shadowRoot });

// Cleanup removes the <style> element
const cleanup = inject(button);
cleanup();

// For reactive tokens, inject() only adds the CSS:
// .box-xxx { height: var(--_v0); }
// The signal → CSS variable binding must be set up separately
const boxToken = boxStyle(heightSignal, bgSignal);
inject(boxToken); // Injects CSS with var() placeholders
// Signal binding is set up by StyleAnchor in React/Vue
```

#### `createRegistry(options?): StyleRegistry`

Creates a style injection manager.

```ts
const registry = createRegistry({
  target: document.head, // default target
  dedupe: true, // prevent duplicate injection
});

registry.inject(button);
registry.inject(card);
registry.clear(); // remove all injected styles
```

#### `isStyleToken(value): boolean`

Type guard for StyleToken.

```ts
if (isStyleToken(value)) {
  // value is StyleToken
}
```

### 8.2 Type Definitions

```ts
// Class name reference
interface ClassRef {
  readonly id: symbol;
  toString(): string; // returns hashed class name
}

// Collection of class refs
type ClassRefs<T extends readonly string[]> = {
  readonly [K in T[number]]: ClassRef;
};

// Discriminated union for token types
// Use __kind for type narrowing in TypeScript

/** Signal binding definition (before variable name assignment) */
interface SignalBindingDef {
  signal: Signal<unknown>;
  index: number; // position in template (for placeholder replacement)
  unit: string; // suffix like "px", "em", etc.
}

/** Style token - immutable definition, no side effects */
interface StyleToken {
  readonly __kind: "style";
  readonly _?: string; // className (only for class selectors)
  readonly __cssTemplate: string; // CSS with {{0}}, {{1}} placeholders for signals
  readonly __bindingDefs?: SignalBindingDef[]; // signal references + positions
  toString(): string; // returns _ or empty string
}

// Note: No __injected here - injection state is managed by StyleAnchor

// Type guard
function isStyleToken(value: unknown): value is StyleToken {
  return (
    typeof value === "object" && value !== null && "__kind" in value && value.__kind === "style"
  );
}

// Note: Arbitrary values (Tailwind p`4px` syntax) now return regular StyleToken
// with dynamically generated class names. No separate ArbitraryStyleToken type needed.

// Registry options
interface RegistryOptions {
  target?: Element | ShadowRoot;
  dedupe?: boolean;
}

// rule`` tagged template - creates StyleToken from selector + CSS block
// Accepts ClassRef, Signal, string, or number as interpolated values
function rule(
  strings: TemplateStringsArray,
  ...values: (ClassRef | Signal<unknown> | string | number)[]
): StyleToken;

// rules() - combines multiple StyleTokens
function rules(...tokens: StyleToken[]): StyleToken;
```

### 8.3 Render System Integration

The render system delegates to `StyleAnchor` for all side effects:

```ts
// In render system - just extract class name, anchor handles the rest
function resolveClass(value: StyleToken, anchor: StyleAnchorRegistry): string {
  // Anchor processes the token (assign var names, inject CSS, set up subscriptions)
  anchor.processToken(value);
  return value._ ?? "";
}
```

See Section 9.3 for the full `StyleAnchor` implementation that handles:

- Signal variable name assignment
- CSS generation and injection
- Signal subscriptions and cleanup

### 8.4 Token Caching (Optional Optimization)

Since `rule()` is a pure function, tokens can optionally be cached for performance. This is handled by the caller, not by `rule()` itself.

```ts
// Optional: Cache tokens by template + signal identity
const tokenCache = new WeakMap<TemplateStringsArray, Map<string, StyleToken>>();

function cachedRule(strings: TemplateStringsArray, ...values: unknown[]): StyleToken {
  // Build cache key from signal identities
  const signalKey = values.map((v) => (isSignal(v) ? getObjectId(v) : String(v))).join("\0");

  let cache = tokenCache.get(strings);
  if (!cache) {
    cache = new Map();
    tokenCache.set(strings, cache);
  }

  if (cache.has(signalKey)) {
    return cache.get(signalKey)!;
  }

  const token = rule(strings, ...values);
  cache.set(signalKey, token);
  return token;
}

// Helper: Get stable ID for any object (for cache keys)
const objectIds = new WeakMap<object, number>();
let nextId = 0;
function getObjectId(obj: object): number {
  let id = objectIds.get(obj);
  if (id === undefined) {
    id = nextId++;
    objectIds.set(obj, id);
  }
  return id;
}
```

**When to use caching:**

- Dynamic rules called frequently with same signals
- Large applications with many rule definitions

**When caching is unnecessary:**

- Static rules (defined once at module level)
- Rules called once per component instance

### 8.5 rules() Return Type

When combining multiple tokens with `rules()`, binding definitions from all tokens are merged:

```ts
function rules(...tokens: StyleToken[]): StyleToken {
  const combinedCSS = tokens.map((t) => t.__cssTemplate).join("\n");
  const allBindingDefs = tokens.flatMap((t, tokenIndex) =>
    (t.__bindingDefs ?? []).map((def) => ({
      ...def,
      // Adjust index to be unique across combined tokens
      index: def.index + tokenIndex * 100,
    })),
  );

  return {
    __kind: "style",
    _: undefined, // Combined rules have no single class name
    __cssTemplate: combinedCSS,
    __bindingDefs: allBindingDefs.length > 0 ? allBindingDefs : undefined,
    toString() {
      return "";
    },
  };
}
```

**Behavior**:

- All CSS templates are concatenated
- All binding definitions are merged (with adjusted indices)
- The combined token has no `_` (class name) since it may contain multiple selectors
- StyleAnchor processes all binding definitions when the token is used

**Important**: Since `rules()` returns a token with `_: undefined`, it cannot be used as a standalone className. Use it for:

```tsx
// ✅ Injection only (global styles, state rules)
inject(buttonStates);

// ✅ Combined with other tokens that have class names
<button class={[button.root, button.states]}>  {/* button.root provides class */}

// ❌ Won't add any class to element
<div class={buttonStates}>  {/* toString() returns "" */}
```

### 8.6 SemaJSX Integration (`@semajsx/dom`)

#### Class Property Enhancement

```tsx
// StyleToken directly in class prop
<div class={button.root}>

// Array with conditions
<div class={[button.root, isLarge && button.large]}>

// Mixed with strings
<div class={[button.root, "custom-class"]}>
```

#### `<AppStyleAnchor>`

Sets the global style injection target.

```tsx
import { AppStyleAnchor } from "@semajsx/dom";

// For Shadow DOM
function MyWebComponent() {
  const shadow = useShadowRoot();

  return (
    <AppStyleAnchor target={shadow}>
      <App />
    </AppStyleAnchor>
  );
}
```

#### `<ComponentStyleAnchor>`

Sets style injection target for current component only.

```tsx
import { ComponentStyleAnchor } from "@semajsx/dom";

function IsolatedComponent() {
  const containerRef = signal<HTMLElement | null>(null);

  return (
    <div>
      <style-container ref={containerRef} />
      <ComponentStyleAnchor target={containerRef}>
        {/* Styles for THIS component inject into style-container */}
        <div class={card.root}>...</div>

        {/* Child components use App Anchor, NOT this anchor */}
        <ChildComponent />
      </ComponentStyleAnchor>
    </div>
  );
}
```

#### Injection Lifecycle

```ts
// Pseudo-code for class prop handling
function resolveClass(value, context) {
  if (isStyleToken(value)) {
    const target = context.componentAnchor ?? context.appAnchor ?? document.head;

    if (!value.__bundle.__injected.has(target)) {
      injectStyles(value.__bundle.__css, target);
      value.__bundle.__injected.add(target);
    }

    return value._;
  }

  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((v) => resolveClass(v, context))
      .join(" ");
  }

  return String(value);
}
```

---

## 9. Usage Examples

### 9.1 Basic Component

```ts
// button.style.ts
import { classes, rule, rules } from "@semajsx/style";

const c = classes(["root", "icon", "label", "large", "primary"]);

/** Base button styles */
export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}`;

/** Button states */
export const states = rules(
  rule`${c.root}:hover { transform: translateY(-1px); }`,
  rule`${c.root}:disabled { opacity: 0.5; cursor: not-allowed; }`,
);

/** Icon styling */
export const icon = rule`${c.icon} { width: 18px; height: 18px; }`;
export const iconInRoot = rule`${c.root} > ${c.icon}:first-child { margin-right: 8px; }`;

/** Label styling */
export const label = rule`${c.label} { font-weight: 500; }`;

/** Size variants */
export const large = rule`${c.large} { padding: 12px 24px; }`;

/** Color variants */
export const primary = rule`${c.primary} { background: var(--primary); color: white; }`;
```

```tsx
// Button.tsx
import * as button from "./button.style";

export function Button({ large, primary, icon, children }) {
  return (
    <button class={[button.root, large && button.large, primary && button.primary]}>
      {icon && <span class={button.icon}>{icon}</span>}
      <span class={button.label}>{children}</span>
    </button>
  );
}
```

### 9.2 With Shadow DOM

```tsx
import { AppStyleAnchor } from "@semajsx/dom";
import * as button from "./button.style";

class MyElement extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: "open" });

    render(
      <AppStyleAnchor target={shadow}>
        <button class={button.root}>Click me</button>
      </AppStyleAnchor>,
      shadow,
    );
  }
}
```

### 9.3 Framework Integrations

#### React Integration (`@semajsx/style/react`)

Anchor + hook pattern for seamless React usage:

```tsx
// App.tsx
import { StyleAnchor } from "@semajsx/style/react";

function App() {
  return (
    <StyleAnchor>
      <MyApp />
    </StyleAnchor>
  );
}

// For Shadow DOM
function WebComponent() {
  const shadowRef = useRef<ShadowRoot>(null);

  return (
    <StyleAnchor target={shadowRef.current}>
      <Content />
    </StyleAnchor>
  );
}
```

```tsx
// Button.tsx
import { useStyle } from "@semajsx/style/react";
import * as button from "./button.style";

function Button({ large, primary, disabled, children }) {
  const cx = useStyle();

  return (
    <button
      className={cx(
        button.root, // StyleToken
        button.states, // Combined rules
        large && button.large, // Conditional
        primary && button.primary,
        "custom-class", // Plain string
      )}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
```

The `useStyle()` hook returns a `cx` function that:

- Accepts StyleTokens, strings, and falsy values (like clsx)
- Auto-injects CSS for StyleTokens into the Provider's target
- Returns a combined className string
- Deduplicates injections automatically

```ts
// @semajsx/style/react implementation
import { createContext, useContext, useCallback, useRef, useEffect } from "react";
import { nanoid } from "nanoid";
import { isStyleToken, type StyleToken, type SignalBindingDef } from "@semajsx/style";

/** Registry managed by each StyleAnchor instance */
interface StyleAnchorRegistry {
  // Signal → CSS variable name (unique within this anchor)
  signalVars: WeakMap<Signal<unknown>, string>;
  // Already injected classNames (for deduplication)
  injectedClasses: Set<string>;
  // Process a token: assign var names, inject CSS, set up subscriptions
  processToken: (token: StyleToken, element: HTMLElement) => void;
}

const StyleAnchorContext = createContext<StyleAnchorRegistry | null>(null);

type CxArg = StyleToken | string | false | null | undefined;

export function useStyle() {
  const registry = useContext(StyleAnchorContext);

  const cx = useCallback((...args: CxArg[]): string => {
    const classes: string[] = [];

    for (const arg of args) {
      if (!arg) continue;

      if (isStyleToken(arg)) {
        // Registry handles all side effects
        if (registry) {
          registry.processToken(arg, /* element from render context */);
        }
        if (arg._) classes.push(arg._);
      } else {
        classes.push(arg);
      }
    }

    return classes.join(" ");
  }, [registry]);

  return cx;
}

/**
 * StyleAnchor - Manages all style-related state and side effects
 *
 * Responsibilities:
 * 1. Signal → CSS variable name mapping (scoped to this anchor)
 * 2. Arbitrary value token caching
 * 3. CSS injection deduplication
 * 4. Signal subscriptions and cleanup
 */
export function StyleAnchor({
  target,
  children,
}: {
  target?: ShadowRoot;
  children: React.ReactNode;
}) {
  const elementRef = useRef<HTMLDivElement>(null);
  const subscriptionsRef = useRef<Set<() => void>>(new Set());

  // Create registry once per anchor instance
  const registryRef = useRef<StyleAnchorRegistry | null>(null);
  if (!registryRef.current) {
    const signalVars = new WeakMap<Signal<unknown>, string>();
    const injectedClasses = new Set<string>();

    registryRef.current = {
      signalVars,
      injectedClasses,

      processToken(token: StyleToken, element: HTMLElement) {
        // 1. Generate final CSS by replacing placeholders with var names
        let css = token.__cssTemplate;
        const bindings: Array<{ signal: Signal<unknown>; varName: string; unit: string }> = [];

        if (token.__bindingDefs) {
          for (const def of token.__bindingDefs) {
            // Get or assign variable name for this signal
            let varName = signalVars.get(def.signal);
            if (!varName) {
              varName = `--sig-${nanoid(6)}`;
              signalVars.set(def.signal, varName);
            }
            // Replace placeholder with var()
            css = css.replace(`{{${def.index}}}`, `var(${varName})`);
            bindings.push({ signal: def.signal, varName, unit: def.unit });
          }
        }

        // 2. Inject CSS if className not already injected
        const className = token._;
        if (className && !injectedClasses.has(className)) {
          const injectionTarget = target ?? document.head;
          injectStyles(css, injectionTarget);
          injectedClasses.add(className);
        }

        // 3. Set up signal subscriptions on the anchor element
        const anchorElement = elementRef.current;
        if (anchorElement && bindings.length > 0) {
          for (const { signal, varName, unit } of bindings) {
            // Set initial value
            const value = unit ? `${signal.value}${unit}` : String(signal.value);
            anchorElement.style.setProperty(varName, value);

            // Subscribe to changes
            const unsub = signal.subscribe((newValue) => {
              const v = unit ? `${newValue}${unit}` : String(newValue);
              anchorElement.style.setProperty(varName, v);
            });
            subscriptionsRef.current.add(unsub);
          }
        }
      },
    };
  }

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach((unsub) => unsub());
      subscriptionsRef.current.clear();
    };
  }, []);

  return (
    <StyleAnchorContext.Provider value={registryRef.current}>
      <div ref={elementRef} style={{ display: "contents" }}>
        {children}
      </div>
    </StyleAnchorContext.Provider>
  );
}

```

**Key insight**: StyleAnchor manages all state and side effects:

- Signal → CSS variable name mapping (scoped to anchor)
- CSS injection deduplication (by className)
- Signal subscriptions with automatic cleanup

Note: Arbitrary values no longer need anchor-scoped caching because they use deterministic classNames (see Section 10.3).

#### Core JS Implementation (`@semajsx/style`)

Before framework integrations, here's the core framework-agnostic implementation:

```ts
// @semajsx/style - Core implementation (framework-agnostic)
import { nanoid } from "nanoid";

/**
 * StyleRegistry - Core class that manages all style state
 *
 * Can be used directly in vanilla JS or wrapped by framework integrations
 */
export class StyleRegistry {
  // Signal → CSS variable name
  private signalVars = new WeakMap<Signal<unknown>, string>();
  // Already injected classNames (for deduplication)
  private injectedClasses = new Set<string>();
  // Active subscriptions (for cleanup)
  private subscriptions = new Set<() => void>();
  // Injection target
  private target: Element | ShadowRoot;
  // Element for CSS variable values
  private anchorElement: HTMLElement | null = null;

  constructor(options: { target?: Element | ShadowRoot } = {}) {
    this.target = options.target ?? document.head;
  }

  /** Set anchor element for CSS variable values */
  setAnchorElement(element: HTMLElement) {
    this.anchorElement = element;
  }

  /** Process a token: generate CSS, inject, set up bindings */
  processToken(token: StyleToken): string {
    // 1. Generate final CSS with var() references
    let css = token.__cssTemplate;
    const bindings: Array<{ signal: Signal<unknown>; varName: string; unit: string }> = [];

    if (token.__bindingDefs) {
      for (const def of token.__bindingDefs) {
        let varName = this.signalVars.get(def.signal);
        if (!varName) {
          varName = `--sig-${nanoid(6)}`;
          this.signalVars.set(def.signal, varName);
        }
        css = css.replace(`{{${def.index}}}`, `var(${varName})`);
        bindings.push({ signal: def.signal, varName, unit: def.unit });
      }
    }

    // 2. Inject CSS if className not already injected
    const className = token._;
    if (className && !this.injectedClasses.has(className)) {
      injectStyles(css, this.target);
      this.injectedClasses.add(className);
    }

    // 3. Set up signal subscriptions
    if (this.anchorElement && bindings.length > 0) {
      for (const { signal, varName, unit } of bindings) {
        const value = unit ? `${signal.value}${unit}` : String(signal.value);
        this.anchorElement.style.setProperty(varName, value);

        const unsub = signal.subscribe((newValue) => {
          const v = unit ? `${newValue}${unit}` : String(newValue);
          this.anchorElement?.style.setProperty(varName, v);
        });
        this.subscriptions.add(unsub);
      }
    }

    return token._ ?? "";
  }

  /** Cleanup all subscriptions */
  dispose() {
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions.clear();
  }
}

/** Create cx() function bound to a registry */
export function createCx(registry: StyleRegistry) {
  return (...args: (StyleToken | string | false | null | undefined)[]): string => {
    const classes: string[] = [];
    for (const arg of args) {
      if (!arg) continue;
      if (isStyleToken(arg)) {
        const className = registry.processToken(arg);
        if (className) classes.push(className);
      } else {
        classes.push(arg);
      }
    }
    return classes.join(" ");
  };
}
```

#### Vanilla JS Usage

```ts
import { StyleRegistry, createCx } from "@semajsx/style";
import { signal } from "@semajsx/signal";
import * as button from "./button.style";

// Create registry (once per app or shadow root)
const registry = new StyleRegistry();

// Optional: set anchor element for reactive styles
const container = document.getElementById("app")!;
registry.setAnchorElement(container);

// Create cx helper
const cx = createCx(registry);

// Use tokens
const btn = document.createElement("button");
btn.className = cx(button.root, button.primary);
container.appendChild(btn);

// Reactive styles
const height = signal(100);
const boxToken = rule`${c.box} { height: ${height}px; }`;
const box = document.createElement("div");
box.className = cx(boxToken);
container.appendChild(box);

// Cleanup when done
registry.dispose();
```

#### Vue Integration (`@semajsx/style/vue`)

```vue
<script setup lang="ts">
import { useStyle } from "@semajsx/style/vue";
import * as button from "./button.style";

const props = defineProps<{ large?: boolean; primary?: boolean }>();
const cx = useStyle();
</script>

<template>
  <button :class="cx(button.root, large && button.large, primary && button.primary)">
    <slot />
  </button>
</template>
```

#### Reactive Styles in React/Vue

React and Vue use the same signal-based approach via `useSignal` hook and `StyleAnchor`:

```tsx
// React - Reactive values with useSignal and StyleAnchor
import { useStyle, useSignal, StyleAnchor } from "@semajsx/style/react";
import { classes, rule } from "@semajsx/style";

const c = classes(["box"]);

// Dynamic rule - function that accepts props object
interface BoxStyleProps {
  height: Signal<number>;
  bg: Signal<string>;
}

const boxStyle = ({ height, bg }: BoxStyleProps) =>
  rule`${c.box} {
    height: ${height}px;
    background: ${bg};
    transition: all 0.3s;
  }`;

function Box() {
  const cx = useStyle();
  const height = useSignal(100);
  const color = useSignal("#3b82f6");

  // cx() always returns string
  // StyleAnchor handles both CSS injection and signal bindings
  return (
    <StyleAnchor>
      <div className={cx(boxStyle({ height, bg: color }))} onClick={() => (height.value += 10)}>
        Click to grow
      </div>
    </StyleAnchor>
  );
}

// DOM structure:
// <div style="--_v0: 100px; --_v1: #3b82f6">  <!-- StyleAnchor wrapper -->
//   <div class="box-x7f3a">Click to grow</div>
// </div>
//
// After click (signal update directly to DOM, no React re-render!):
// <div style="--_v0: 110px; --_v1: #3b82f6">  <!-- CSS vars updated -->
//   <div class="box-x7f3a">Click to grow</div>
// </div>
```

**How it works**: CSS variables set on the anchor element cascade to descendants via CSS inheritance. The anchor uses `display: contents` to avoid affecting layout.

Vue with `useSignal` and `StyleAnchor`:

```vue
<script setup lang="ts">
import { useStyle, useSignal } from "@semajsx/style/vue";
import StyleAnchor from "@semajsx/style/vue/StyleAnchor.vue";

const cx = useStyle();
const height = useSignal(100);
const color = useSignal("#3b82f6");
</script>

<template>
  <StyleAnchor>
    <div :class="cx(boxStyle({ height, bg: color }))" @click="height.value += 10">
      Click to grow
    </div>
  </StyleAnchor>
</template>
```

**Unified API across frameworks:**

| Aspect           | SemaJSX                    | React/Vue                      |
| ---------------- | -------------------------- | ------------------------------ |
| Create signal    | `signal(100)`              | `useSignal(100)`               |
| Dynamic rule     | `boxStyle({ height, bg })` | `boxStyle({ height, bg })`     |
| Update           | `height.value += 10`       | `height.value += 10`           |
| Re-render needed | No - direct DOM update     | No - signal bypasses React/Vue |
| Syntax           | `<div class={style}>`      | `<StyleAnchor>` + `cx(style)`  |

The key insight: **signals bypass framework re-renders**. The CSS variable update happens directly on the anchor element via signal subscription, not through React/Vue's reconciliation. CSS variables cascade to descendants via CSS inheritance.

### 9.4 Global Styles

```ts
import { classes, rule, rules, inject } from "@semajsx/style";

const c = classes(["reset"]);

export const globals = rules(
  rule`:root {
    --primary: #3b82f6;
    --hover: #2563eb;
  }`,

  rule`*, *::before, *::after { box-sizing: border-box; }`,

  rule`body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }`,

  // Scoped class
  rule`${c.reset} { all: unset; }`,
);

// Inject globals at app start
inject(globals);
```

### 9.5 Shared Class Names Across Files

```ts
// tokens.ts
import { classes } from "@semajsx/style";
export const c = classes(["button", "card", "input", "icon"]);

// button.style.ts
import { rule } from "@semajsx/style";
import { c } from "./tokens";

export const root = rule`${c.button} { ... }`;
export const withIcon = rule`${c.button} > ${c.icon} { ... }`;

// card.style.ts
import { rule } from "@semajsx/style";
import { c } from "./tokens";

export const root = rule`${c.card} { ... }`;
export const cardButton = rule`${c.card} ${c.button} { width: 100%; }`;
```

---

## 10. Tailwind CSS Integration

The style system can integrate with Tailwind CSS to provide type-safe utility classes.

### 10.1 Package Structure

```
@semajsx/tailwind/
  ├── spacing.ts      # p, m, gap
  ├── sizing.ts       # w, h, min-w, max-w
  ├── colors.ts       # bg, text, border
  ├── flex.ts         # flex, justify, items
  ├── typography.ts   # font, text-size, leading
  ├── arbitrary.ts    # Arbitrary value functions
  └── index.ts        # Re-export all
```

### 10.2 Predefined Values (Template-First Approach)

Predefined Tailwind scale values use a **template-first approach**: define the utility template once, then generate all predefined values from it. This ensures consistency between predefined and arbitrary values.

**Design decision**: We chose template-first over direct CSS for predefined values because:

| Aspect              | Template-First (chosen)                    | Direct CSS                     |
| ------------------- | ------------------------------------------ | ------------------------------ |
| Single source       | ✅ Property defined once in template       | ❌ Repeated in each rule       |
| className prefix    | ✅ Automatically consistent                | ❌ Manual consistency required |
| Arbitrary values    | ✅ Same template, same prefix              | ❌ Separate implementation     |
| Runtime performance | ✅ Static tokens (generated at definition) | ✅ Static tokens               |
| Code size           | ✅ Less duplication                        | ❌ More verbose                |

**Note on tree-shaking**: Unlike component styles (Section 6.4), Tailwind utilities use object exports for ergonomics. This is acceptable because:

1. **Module-level tree-shaking still works**: If you don't import `spacing.ts`, it's eliminated
2. **Utilities are small**: Each rule is ~50 bytes, entire `spacing` object is ~500 bytes
3. **Typically used together**: Users import a category (spacing, colors) and use many values
4. **DOM injection is selective**: Even if bundled, only used rules are injected

For component styles where each rule is larger and usage is selective, prefer named exports (Section 6.4).

```ts
// @semajsx/tailwind/spacing.ts
import { classes } from "@semajsx/style";

// 1. Define class names (single source of truth)
const c = classes(["p", "m"]);

// 2. Create utility template (defines property + className prefix)
function createUtility(property: string, classPrefix: string) {
  return (value: string): StyleToken => ({
    __kind: "style",
    _: `${classPrefix}-${valueToSuffix(value)}`,
    __cssTemplate: `.${classPrefix}-${valueToSuffix(value)} { ${property}: ${value}; }`,
    toString() {
      return this._;
    },
  });
}

// Helper: Convert value to deterministic suffix
function valueToSuffix(value: string): string {
  // Simple values: use directly (sanitized)
  if (/^[\w.]+$/.test(value)) {
    return value.replace(".", "_");
  }
  // Complex values (calc, etc.): use short hash
  return hashString(value).slice(0, 6);
}

// 3. Create templates for each property
const padding = createUtility("padding", c.p.toString());
const margin = createUtility("margin", c.m.toString());

// 4. Generate predefined values (static tokens at definition time)
export const spacing = {
  /** padding: 0 */
  p0: padding("0"),
  /** padding: 0.25rem (4px) */
  p1: padding("0.25rem"),
  /** padding: 0.5rem (8px) */
  p2: padding("0.5rem"),
  /** padding: 1rem (16px) */
  p4: padding("1rem"),
  /** padding: 2rem (32px) */
  p8: padding("2rem"),

  /** margin: 0 */
  m0: margin("0"),
  /** margin: 0.25rem (4px) */
  m1: margin("0.25rem"),
  /** margin: 0.5rem (8px) */
  m2: margin("0.5rem"),
  /** margin: 1rem (16px) */
  m4: margin("1rem"),
  /** margin: 2rem (32px) */
  m8: margin("2rem"),
  /** margin: auto */
  mauto: margin("auto"),
};

// 5. Export templates for arbitrary values (same prefix!)
export { padding as p, margin as m };
```

**How it works:**

```ts
// Predefined values - generated from template at definition time
spacing.p4._; // "p-1rem" (deterministic)
spacing.p4.__cssTemplate; // ".p-1rem { padding: 1rem; }"

// Arbitrary values - same template, same prefix
p("4px")._; // "p-4px" (deterministic)
p("calc(100% - 40px)")._; // "p-a1b2c3" (hash for complex values)

// Prefix is always consistent: both come from c.p
```

IDE hover example:

```
spacing.p4
         ↓
┌─────────────────────────┐
│ (property) p4           │
│ padding: 1rem (16px)    │
└─────────────────────────┘
```

Batch injection:

```ts
// Inject all spacing styles at once
inject(spacing);

// Or inject specific ones
inject([spacing.p4, spacing.m2]);
```

Usage:

```tsx
import { spacing, colors } from "@semajsx/tailwind";

<div class={[spacing.p4, spacing.m2, colors.bgBlue500, colors.textWhite]}>Hello</div>;
```

### 10.3 Arbitrary Values (Same Template)

Arbitrary values use the **same template** as predefined values, ensuring consistent className prefixes. The className is **deterministic** based on the value, enabling deduplication by className.

```ts
// @semajsx/tailwind/spacing.ts (continued from 10.2)

// The same templates used for predefined values work for arbitrary values!
// p("4px") uses the same `padding` template, same `c.p` prefix

// Tagged template syntax for ergonomics
export function pTemplate(strings: TemplateStringsArray, ...values: unknown[]) {
  const value = String.raw(strings, ...values);
  return padding(value); // Uses same createUtility result
}

export function mTemplate(strings: TemplateStringsArray, ...values: unknown[]) {
  const value = String.raw(strings, ...values);
  return margin(value);
}

// Export as p`...` and m`...`
export { pTemplate as p, mTemplate as m };
```

**How it works:**

```ts
import { spacing, p, m } from "@semajsx/tailwind/spacing";

// Predefined and arbitrary share the same className prefix
spacing.p4._; // "p-abc123-1rem"  (c.p prefix + value suffix)
p`4px`._; // "p-abc123-4px"  (same c.p prefix + value suffix)
p`calc(100% - 40px)`._; // "p-abc123-a1b2c3"  (hash for complex)

// Same value = same className = deduplication works
p`4px` === p`4px`; // Same token (deterministic)
```

**Deduplication by className:**

The `StyleRegistry` deduplicates by className (not CSS hash), which is simpler and more efficient:

```ts
// StyleRegistry.processToken() - simplified
processToken(token: StyleToken): string {
  const className = token._;
  if (!className) return "";

  // Dedupe by className - simple Set lookup
  if (!this.injectedClasses.has(className)) {
    injectStyles(token.__cssTemplate, this.target);
    this.injectedClasses.add(className);
  }

  return className;
}
```

**Benefits:**

- **Deterministic**: Same value always produces same className
- **Consistent prefix**: Predefined and arbitrary share `c.p`, `c.m` prefixes
- **Simple deduplication**: Just check className in Set
- **No registry needed for tokens**: Tokens are pure, registry only handles injection

Usage:

```tsx
import { spacing, p, w, bg } from "@semajsx/tailwind";

function Card() {
  return (
    <div
      class={[
        spacing.p4, // Predefined: "p-xxx-1rem"
        w`calc(100% - 40px)`, // Arbitrary: "w-xxx-a1b2c3"
        bg`#f5f5f5`, // Arbitrary: "bg-xxx-f5f5f5"
      ]}
    >
      ...
    </div>
  );
}

// All class-based, deduplication by className
// If w`calc(100% - 40px)` appears twice, CSS only injected once
```

### 10.4 Render Handling

Since arbitrary values now return regular `StyleToken`, no special handling is needed. Both predefined and arbitrary tokens are processed identically:

```ts
function resolveClass(values: StyleToken[]): string {
  const classes: string[] = [];

  for (const token of values.flat().filter(Boolean)) {
    if (isStyleToken(token)) {
      // Inject CSS if not already done
      injectIfNeeded(token);
      if (token._) classes.push(token._);
    }
  }

  return classes.join(" ");
}
```

Rendered output:

```tsx
// Input
<div class={[spacing.p4, w`calc(100% - 40px)`, bg`#f5f5f5`]}>

// Output (all class-based, CSS injected automatically)
<div class="p-4 w-x7f3 bg-b2c4">
```

### 10.5 Why Dynamic Classes (Not Inline Styles)

We chose dynamic class generation over inline styles for arbitrary values:

| Aspect           | Dynamic Classes (chosen)          | Inline Styles              |
| ---------------- | --------------------------------- | -------------------------- |
| API consistency  | ✅ Same as predefined tokens      | ❌ Mixed class + style     |
| Component usage  | ✅ Just use in `class` prop       | ❌ Must handle `style` too |
| Caching          | ✅ Same value = same cached token | ❌ Creates new object      |
| CSS cascade      | ✅ Works with other classes       | ⚠️ Highest specificity     |
| DevTools inspect | ✅ See class name in Elements     | ⚠️ Inline style noise      |

**Trade-off**: Slightly larger CSS output, but simpler developer experience.

### 10.6 Complete Example

```tsx
import { spacing, colors, flex } from "@semajsx/tailwind";
import { w, h } from "@semajsx/tailwind/arbitrary";

function Card({ width, children }) {
  return (
    <div
      class={[
        // Predefined values (IDE autocomplete)
        spacing.p4,
        spacing.m2,
        colors.bgWhite,
        flex.col,

        // Arbitrary values (dynamic classes, same API)
        w`${width}px`,
        h`calc(100vh - 80px)`,
      ]}
    >
      {children}
    </div>
  );
}

// Rendered (all class-based):
// <div class="p-4 m-2 bg-white flex-col w-x7f3 h-b2c4">
//
// Injected CSS:
// .w-x7f3 { width: 300px; }
// .h-b2c4 { height: calc(100vh - 80px); }
```

### 10.7 Code Generation from Tailwind Config

A code generator reads Tailwind config to produce the rule objects with JSDoc comments:

```ts
// scripts/generate-tailwind.ts
import resolveConfig from "tailwindcss/resolveConfig";
import tailwindConfig from "../tailwind.config";

const config = resolveConfig(tailwindConfig);

function generateSpacing(): string {
  const names: string[] = [];
  const props: string[] = [];

  for (const [key, value] of Object.entries(config.theme.spacing)) {
    const name = `p${key}`;
    names.push(name);

    // Generate property with JSDoc
    const pxValue = convertToPixels(value); // e.g., "1rem" -> "16px"
    props.push(`  /** padding: ${value}${pxValue ? ` (${pxValue})` : ""} */`);
    props.push(`  ${name}: rule\`\${c.${name}} { padding: ${value}; }\`,`);
  }

  return `
import { classes, rule } from "@semajsx/style";

const c = classes(${JSON.stringify(names)});

export const spacing = {
${props.join("\n")}
};
`;
}

// Generate all category files
generateSpacing();
generateColors();
generateFlex();
// ...
```

---

## 11. Alternatives Considered

### Alternative A: CSS-in-JS Object Syntax

```ts
const button = style({
  root: {
    padding: "8px 16px",
    "&:hover": { background: "blue" },
  },
});
```

**Why not**: Loses native CSS syntax, IDE support, and familiar developer experience.

### Alternative B: Tagged Template Without Class Declaration

```ts
const button = css`
  .root {
    padding: 8px;
  }
  .icon {
    width: 18px;
  }
`;
```

**Why not**: Requires runtime CSS parsing to extract class names. Less type-safe.

### Alternative C: Compile-time Only (like Vanilla Extract)

**Why not**: Requires complex build setup. We want a runtime that works out of the box, with optional compile-time optimization.

---

## 12. Risks and Mitigation

| Risk                               | Impact | Probability | Mitigation                                                     |
| ---------------------------------- | ------ | ----------- | -------------------------------------------------------------- |
| CSS string parsing overhead        | Medium | Low         | Parsing happens once at definition time, not render time       |
| Hash collisions                    | High   | Very Low    | Use crypto-grade hash + namespace prefix + collision detection |
| Memory leaks from injected styles  | Medium | Medium      | Use WeakSet for tracking, provide explicit cleanup API         |
| Breaking existing class prop usage | High   | Low         | StyleToken stringifies to class name, backward compatible      |
| Layout thrashing on first inject   | Medium | Medium      | Batch injections, provide preload API                          |
| Invalid CSS strings                | Low    | Medium      | Validate at definition time in dev mode, skip invalid rules    |
| Target element removed from DOM    | Medium | Low         | WeakRef for targets, auto-cleanup on GC                        |

### 12.1 Memory Management Strategy

```ts
// Use WeakSet to track injection targets - allows GC when targets are removed
interface StyleToken {
  readonly _?: string;
  readonly __css: string;
  readonly __injected: WeakSet<Element | ShadowRoot>;
}

// WeakRef for registry targets
class StyleRegistry {
  private targetRef: WeakRef<Element | ShadowRoot>;
  private injectedStyles: Set<string>;

  inject(token: StyleToken) {
    const target = this.targetRef.deref();
    if (!target) {
      // Target was GC'd, cleanup registry
      this.dispose();
      return;
    }
    // ... injection logic
  }

  dispose() {
    // Explicit cleanup
  }
}
```

### 12.2 Performance: Explicit Preload

```ts
// Problem: Multiple cx() calls cause multiple style injections
cx(button.root); // inject
cx(button.icon); // inject
cx(button.label); // inject  <- 3 separate DOM writes

// Solution: Explicit preload() at app/route entry
import { preload } from "@semajsx/style";

// At app startup
preload(button, card, input); // Single batched injection

// Or at route entry
function ProductPage() {
  // Preload all styles needed for this page
  preload(productCard, pricing, gallery);

  return <div>...</div>;
}
```

Benefits of explicit preload:

- Predictable injection timing
- Developer controls when styles are added
- No hidden microtask overhead
- Easier to debug and profile

Development mode warning for non-preloaded injections:

```ts
// Track which tokens have been preloaded
const preloadedTokens = new WeakSet<StyleToken>();

export function preload(...styles: StyleToken[]) {
  for (const token of styles.flat()) {
    preloadedTokens.add(token);
  }
  batchInject(styles);
}

// In inject() or cx()
function inject(token: StyleToken, options?: InjectOptions) {
  if (process.env.NODE_ENV === "development" && !preloadedTokens.has(token)) {
    console.warn(
      `[@semajsx/style] Injecting "${token._}" without preload. ` +
        `Consider using preload() at app/route entry for better performance.`,
    );
  }
  // ... injection logic
}
```

### 12.3 Error Handling

```ts
// Dev mode: validate CSS at definition time
function rule(strings: TemplateStringsArray, ...values: unknown[]): StyleToken {
  const cssBlock = buildCSSBlock(strings, values);

  if (process.env.NODE_ENV === "development") {
    validateCSS(cssBlock); // Throws with helpful message
  }
  // ...
}

// Hash collision detection
const hashRegistry = new Map<string, string>();

function generateHash(content: string): string {
  const hash = computeHash(content);

  if (hashRegistry.has(hash) && hashRegistry.get(hash) !== content) {
    console.warn(`Hash collision detected for ${hash}, using fallback`);
    return computeHash(content + Date.now());
  }

  hashRegistry.set(hash, content);
  return hash;
}
```

---

## 13. Shadow DOM Considerations

### 13.1 Nested Shadow DOM

```tsx
// Outer shadow root
<AppStyleAnchor target={outerShadow}>
  <div class={button.root}>
    {/* Inner web component with its own shadow */}
    <inner-component>
      #shadow-root
      {/* Styles here need separate injection */}
      <AppStyleAnchor target={innerShadow}>
        <div class={button.root}>...</div>
      </AppStyleAnchor>
    </inner-component>
  </div>
</AppStyleAnchor>
```

Each Shadow DOM boundary requires its own `AppStyleAnchor`. Styles don't pierce shadow boundaries.

### 13.2 Anchor Target Removal

```ts
// When anchor target is removed from DOM
const registry = createRegistry({ target: shadowRoot });

// Later, shadowRoot is removed
shadowRoot.host.remove();

// Next injection attempt detects removed target
registry.inject(button); // No-op, logs warning in dev mode
```

### 13.3 Multiple Shadow Roots Performance

For apps with many shadow roots (e.g., micro-frontends):

```ts
// Shared style cache across shadow roots
const sharedCache = new Map<string, CSSStyleSheet>();

function injectToShadow(token: StyleToken, shadow: ShadowRoot) {
  // Use constructable stylesheets for efficient sharing
  let sheet = sharedCache.get(token.__css);

  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(token.__css);
    sharedCache.set(token.__css, sheet);
  }

  // Adopt shared stylesheet (no duplication)
  shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
}
```

---

## 14. Server-Side Rendering (SSR)

### 14.1 SSR Strategy

The style system supports SSR by collecting styles during server render and injecting them into the HTML:

```ts
// @semajsx/style/server
import { collectStyles, renderStylesToString } from "@semajsx/style/server";

// Server-side render
const styleCollector = collectStyles();

const html = renderToString(
  <StyleCollectorProvider collector={styleCollector}>
    <App />
  </StyleCollectorProvider>
);

// Get collected CSS
const css = renderStylesToString(styleCollector);

// Inject into HTML
const fullHtml = `
<!DOCTYPE html>
<html>
  <head>
    <style id="__semajsx_styles__">${css}</style>
  </head>
  <body>
    <div id="root">${html}</div>
  </body>
</html>
`;
```

### 14.2 Style Collection

During SSR, the `cx()` function collects styles instead of injecting to DOM:

```ts
// Server-side cx() implementation
function createServerCx(collector: StyleCollector) {
  return function cx(...args: CxArg[]): string {
    const classes: string[] = [];

    for (const arg of args) {
      if (!arg) continue;

      if (isStyleToken(arg)) {
        // Collect CSS instead of injecting
        collector.add(arg.__css);
        if (arg._) classes.push(arg._);
      } else {
        classes.push(String(arg));
      }
    }

    return classes.join(" ");
  };
}

interface StyleCollector {
  styles: Set<string>;
  add(css: string): void;
}

export function collectStyles(): StyleCollector {
  return {
    styles: new Set(),
    add(css: string) {
      this.styles.add(css);
    },
  };
}

export function renderStylesToString(collector: StyleCollector): string {
  return [...collector.styles].join("\n");
}
```

### 14.3 Hydration

On client-side hydration, skip re-injection for styles already in the page:

```ts
// Client-side hydration
import { hydrateStyles } from "@semajsx/style";

// Mark existing styles as injected
hydrateStyles();

// Now cx() won't re-inject styles that are already in <style id="__semajsx_styles__">
```

**Timing Considerations**:

1. `hydrateStyles()` should be called **after** style modules are imported
2. Since `rule()` registers tokens at module load time, ensure style imports come before `hydrateStyles()`
3. For lazy-loaded modules, hydration happens on-demand via the inject check

```ts
// Correct order - style imports first
import * as button from "./button.style"; // rule() registers tokens here
import * as card from "./card.style";
import { hydrateStyles } from "@semajsx/style";

hydrateStyles(); // Now globalTokenRegistry contains all tokens
```

**Implementation with hash-based matching**:

SSR embeds token hashes in a data attribute, enabling reliable matching even after CSS minification:

```html
<!-- Server-rendered HTML -->
<style id="__semajsx_styles__" data-hashes="a1b2c3,d4e5f6,g7h8i9">
  .root-a1b2c3 { ... }
  .icon-d4e5f6 { ... }
</style>
```

```ts
let hydratedHashes: Set<string> | null = null;

function getHydratedHashes(): Set<string> {
  if (hydratedHashes === null) {
    const styleEl = document.getElementById("__semajsx_styles__");
    const hashAttr = styleEl?.getAttribute("data-hashes") || "";
    hydratedHashes = new Set(hashAttr.split(",").filter(Boolean));
  }
  return hydratedHashes;
}

export function hydrateStyles() {
  const hashes = getHydratedHashes();
  if (hashes.size === 0) return;

  // Mark tokens whose hash exists in SSR'd styles
  for (const [hash, token] of globalTokenRegistry) {
    if (hashes.has(hash)) {
      token.__injected.add(document.head);
    }
  }
}

// Lazy hydration check in inject()
function inject(token: StyleToken, options?: InjectOptions) {
  const target = options?.target ?? document.head;

  if (target === document.head && !token.__injected.has(target)) {
    const hashes = getHydratedHashes();
    const tokenHash = computeHash(token.__css);

    if (hashes.has(tokenHash)) {
      token.__injected.add(target);
      return; // Already in page, skip injection
    }
  }

  // ... proceed with injection
}
```

**Why hash-based matching?**

1. **Minification-safe**: Hash comparison works regardless of whitespace changes
2. **Fast lookup**: `Set.has()` is O(1) vs `String.includes()` which is O(n)
3. **Reliable**: Exact match via hash, no false positives from partial matches

**SSR style rendering with hashes**:

```ts
export function renderStylesToString(collector: StyleCollector): string {
  const hashes: string[] = [];
  const css: string[] = [];

  for (const [hash, cssContent] of collector.styles) {
    hashes.push(hash);
    css.push(cssContent);
  }

  return `<style id="__semajsx_styles__" data-hashes="${hashes.join(",")}">${css.join("\n")}</style>`;
}
```

This dual approach ensures:

- **Eager hydration**: `hydrateStyles()` marks all known tokens immediately
- **Lazy hydration**: Tokens from lazy-loaded modules are checked on first use
- **Minification-safe**: Hash comparison works after CSS minification

### 14.4 Streaming SSR

For streaming SSR (React 18+), styles can be flushed incrementally. **The same `StyleCollectorProvider` and `collectStyles()` are used** - streaming vs sync is determined by how you consume the collector.

```ts
// Streaming SSR with style chunks
import { renderToPipeableStream } from "react-dom/server";
import { StyleCollectorProvider, collectStyles, flushStyles } from "@semajsx/style/server";

const collector = collectStyles();

const { pipe } = renderToPipeableStream(
  <StyleCollectorProvider collector={collector}>
    <App />
  </StyleCollectorProvider>,
  {
    onShellReady() {
      // Flush styles collected so far (clears the collector)
      const css = flushStyles(collector);
      res.write(`<style>${css}</style>`);
      pipe(res);
    },
    onAllReady() {
      // Optionally flush any remaining styles after full render
      const remainingCss = flushStyles(collector);
      if (remainingCss) {
        res.write(`<style>${remainingCss}</style>`);
      }
    },
  }
);
```

**API difference**:

- `renderStylesToString(collector)`: Returns all styles, leaves collector intact (for sync SSR)
- `flushStyles(collector)`: Returns new styles since last flush, clears them (for streaming)

### 14.5 Framework Integration

**Next.js App Router:**

```tsx
// lib/style-registry.tsx
"use client";

import { useServerInsertedHTML } from "next/navigation";
import { useRef } from "react";
import { collectStyles, renderStylesToString, StyleCollectorProvider } from "@semajsx/style/server";

export function StyleRegistry({ children }: { children: React.ReactNode }) {
  const collectorRef = useRef(collectStyles());
  const isServerInserted = useRef(false);

  useServerInsertedHTML(() => {
    if (isServerInserted.current) return null;
    isServerInserted.current = true;

    const css = renderStylesToString(collectorRef.current);
    return <style id="__semajsx_styles__" dangerouslySetInnerHTML={{ __html: css }} />;
  });

  return (
    <StyleCollectorProvider collector={collectorRef.current}>{children}</StyleCollectorProvider>
  );
}

// app/layout.tsx
import { StyleRegistry } from "@/lib/style-registry";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head />
      <body>
        <StyleRegistry>{children}</StyleRegistry>
      </body>
    </html>
  );
}
```

**Remix:**

```tsx
// root.tsx
import { collectStyles, renderStylesToString } from "@semajsx/style/server";

export default function App() {
  const collector = collectStyles();

  return (
    <html>
      <head>
        <style dangerouslySetInnerHTML={{ __html: renderStylesToString(collector) }} />
      </head>
      <body>
        <StyleCollectorProvider collector={collector}>
          <Outlet />
        </StyleCollectorProvider>
      </body>
    </html>
  );
}
```

---

## 15. Dependencies

### 15.1 Technical Dependencies

- None for core `@semajsx/style` package
- `@semajsx/dom` for SemaJSX integration (optional)

### 15.2 Optional Build Tools

- Vite plugin for `.css` → `.css.ts` transformation
- CSS minification in production builds

---

## 16. Open Questions

- [ ] **Q1**: Should CSS be auto-split per class for finer tree-shaking?
  - **Context**: Currently, entire `rule` block is one unit
  - **Options**: A) Keep as-is (simpler), B) Compile-time splitting
  - **Leaning**: A - per-component granularity is sufficient

- [ ] **Q2**: How to handle CSS custom properties (variables)?
  - **Context**: Variables don't need hashing but should be type-safe
  - **Options**: A) Separate API, B) Convention (--prefix), C) Just use strings

- [ ] **Q3**: Should we provide a CSS-to-TS transformation tool?
  - **Context**: Users may prefer writing `.css` files
  - **Options**: A) Vite plugin, B) CLI tool, C) Both, D) None (manual)

- [x] ~~**Q4**: Is the dual syntax for `rule()` confusing?~~
  - **Resolved**: Unified to single tagged template syntax: `` rule`${c.root} { ... }` ``

---

## 17. Success Criteria

- [ ] `@semajsx/style` works standalone with any framework
- [ ] Tree-shaking eliminates unused style bundles
- [ ] Native CSS syntax with full IDE support
- [ ] Type-safe class name references
- [ ] Shadow DOM injection works correctly
- [ ] Zero runtime CSS parsing (parse once at definition)
- [ ] Backward compatible with existing string class names
- [ ] No memory leaks with proper cleanup
- [ ] Performant with batched injections

---

## 18. Next Steps

If accepted:

### 18.1 Phase 1: Core Implementation

- [ ] Create design document: `design/designs/style-system-design.md`
- [ ] Implement `@semajsx/style` package (core runtime)
- [ ] Integrate with `@semajsx/dom` class property handling
- [ ] Add StyleAnchor components
- [ ] Implement `preload()` and dev mode warnings
- [ ] Write documentation and examples

### 18.2 Phase 2: Framework Integrations

- [ ] Implement `@semajsx/style/react` (StyleAnchor, useStyle, useSignal)
- [ ] Implement `@semajsx/style/vue` (useStyle, useSignal composables)
- [ ] Implement `@semajsx/style/server` (SSR support)
- [ ] Add hydration support

### 18.3 Phase 3: Toolchain

- [ ] **Vite Plugin** (`vite-plugin-semajsx-style`)
  - Transform `.css` files to `.css.ts` modules
  - Automatic class name extraction
  - HMR support for style changes
  - Production CSS minification

- [ ] **VSCode Extension** (`vscode-semajsx-style`)
  - CSS syntax highlighting in `rule\`\`` templates
  - Go-to-definition for ClassRef references
  - Autocomplete for class names
  - CSS validation and linting
  - Hover hints for class name hashes

- [ ] **ESLint Plugin** (`eslint-plugin-semajsx-style`)
  - Warn on unused style tokens
  - Enforce `preload()` usage
  - Detect potential memory leaks

---

## 19. Appendix

### References

- [CSS Modules](https://github.com/css-modules/css-modules)
- [Vanilla Extract](https://vanilla-extract.style/)
- [StyleX](https://stylexjs.com/)
- [Panda CSS](https://panda-css.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadow DOM Styling](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)

### Glossary

- **ClassRef**: A reference object that stringifies to a hashed class name
- **StyleToken**: Contains className (optional) + CSS rule(s), used in class props or injected
- **Arbitrary Value**: Tailwind-style arbitrary syntax (e.g., `p\`4px\``) that generates a StyleToken with dynamic class name
- **ReactiveVar**: Signal binding info for dynamic CSS variables
- **Dynamic Rule**: A function that accepts props object with signals and returns a StyleToken (like Component)
- **App Anchor**: Global style injection target (default: document.head)
- **Component Anchor**: Per-component injection target (doesn't affect children)

### Change Log

| Date       | Change                                                                    | Author       |
| ---------- | ------------------------------------------------------------------------- | ------------ |
| 2026-01-10 | Initial draft                                                             | SemaJSX Team |
| 2026-01-10 | Added Tailwind CSS integration                                            | SemaJSX Team |
| 2026-01-10 | Refined style() API: per-property with JSDoc                              | SemaJSX Team |
| 2026-01-10 | Added batch inject() and multiple rules support                           | SemaJSX Team |
| 2026-01-10 | Renamed style→rule, added rules() for combining                           | SemaJSX Team |
| 2026-01-10 | Added tagged template syntax for complex selectors                        | SemaJSX Team |
| 2026-01-10 | Added React/Vue integrations with Provider + useStyle() hook              | SemaJSX Team |
| 2026-01-10 | Added memory management, performance, error handling, Shadow DOM sections | SemaJSX Team |
| 2026-01-10 | Unified to single tagged template syntax: rule\`selector { css }\`        | SemaJSX Team |
| 2026-01-10 | Changed preload() to explicit only (no automatic batching)                | SemaJSX Team |
| 2026-01-10 | Added reactive values with signals (CSS variables for dynamic updates)    | SemaJSX Team |
| 2026-01-10 | Introduced dynamic rules (functions) + useSignal hook for React/Vue       | SemaJSX Team |
| 2026-01-10 | Changed dynamic rule to use props object pattern (like Component)         | SemaJSX Team |
| 2026-01-10 | Added dev mode warning for non-preloaded style injections                 | SemaJSX Team |
| 2026-01-10 | Added SSR support (style collection, hydration, streaming)                | SemaJSX Team |
| 2026-01-10 | Type system cleanup with discriminated union pattern                      | SemaJSX Team |
| 2026-01-10 | Added toolchain planning (Vite plugin, VSCode extension, ESLint)          | SemaJSX Team |
| 2026-01-10 | Fixed ArbitraryStyleToken to use \_\_kind discriminant                    | SemaJSX Team |
| 2026-01-10 | Added globalTokenRegistry and rules() return type documentation           | SemaJSX Team |
| 2026-01-10 | Fixed Next.js SSR example with proper StyleRegistry implementation        | SemaJSX Team |
| 2026-01-10 | Fixed section numbering (removed gap at section 11)                       | SemaJSX Team |
| 2026-01-10 | Clarified streaming SSR uses same Provider, added flushStyles API         | SemaJSX Team |
| 2026-01-10 | Added hydration timing explanation with lazy fallback                     | SemaJSX Team |
| 2026-01-10 | Added honest tree-shaking analysis (module vs property level)             | SemaJSX Team |
| 2026-01-10 | Changed to named exports as default pattern for tree-shaking              | SemaJSX Team |
| 2026-01-10 | Added Tailwind tree-shaking trade-off explanation                         | SemaJSX Team |
| 2026-01-10 | Added dynamic rules registry behavior (hash by signal identity)           | SemaJSX Team |
| 2026-01-10 | Changed hydration to hash-based matching (minification-safe)              | SemaJSX Team |
| 2026-01-10 | Redesigned reactive: signals in template, auto-binding via \_\_bindings   | SemaJSX Team |
| 2026-01-10 | Clarified inject() only handles CSS, signal binding handled by framework  | SemaJSX Team |
| 2026-01-10 | Fixed signal identity: use WeakMap since Signal has no id property        | SemaJSX Team |
| 2026-01-10 | Clarified hashKey vs hash relationship in token caching                   | SemaJSX Team |
| 2026-01-10 | Redesigned cx() to always return string, use anchor for signal bindings   | SemaJSX Team |
| 2026-01-10 | Unified StyleProvider and SignalStyleAnchor into single StyleAnchor       | SemaJSX Team |
| 2026-01-10 | Fixed CSS variable collision: use sig- prefix + nanoid per signal         | SemaJSX Team |
| 2026-01-10 | Fixed StyleAnchor first render: default to document.head for CSS inject   | SemaJSX Team |
| 2026-01-10 | Added toString() implementation to StyleToken and rules() return          | SemaJSX Team |
| 2026-01-10 | Clarified rules() returns token without className (injection only)        | SemaJSX Team |
| 2026-01-10 | Changed arbitrary values to dynamic classes (not inline styles)           | SemaJSX Team |
| 2026-01-10 | Removed ArbitraryStyleToken type - arbitrary values return StyleToken     | SemaJSX Team |
| 2026-01-10 | Made rule() pure function with placeholder syntax (no global state)       | SemaJSX Team |
| 2026-01-10 | Changed StyleToken to use \_\_cssTemplate and \_\_bindingDefs             | SemaJSX Team |
| 2026-01-10 | Introduced StyleRegistry class for anchor-scoped state management         | SemaJSX Team |
| 2026-01-10 | Moved all caches (signalVars, arbitraryTokens, injectedCSS) to registry   | SemaJSX Team |
| 2026-01-10 | Added core JS implementation before framework integrations                | SemaJSX Team |
| 2026-01-10 | Redesigned Tailwind utils with template-first approach                    | SemaJSX Team |
| 2026-01-10 | Changed arbitrary values to use deterministic className (valueToSuffix)   | SemaJSX Team |
| 2026-01-10 | Changed deduplication from CSS hash to className (simpler, faster)        | SemaJSX Team |
| 2026-01-10 | Removed arbitraryTokens cache (deterministic tokens don't need caching)   | SemaJSX Team |
