---
title: Style System Examples
description: Real-world examples using semajsx/style and semajsx/tailwind
order: 2
difficulty: intermediate
---

# Style System Examples

Complete, runnable examples for common UI patterns. Each example shows when to use `semajsx/style`, `semajsx/tailwind`, or both.

## Choosing Your Approach

| Scenario                                   | Use              | Why                  |
| ------------------------------------------ | ---------------- | -------------------- |
| Quick layouts, spacing, typography         | semajsx/tailwind | Faster, less code    |
| Custom design system, unique styles        | semajsx/style    | Full CSS control     |
| Reactive styles (values change at runtime) | semajsx/style    | Signal integration   |
| Pseudo-classes, animations, media queries  | semajsx/style    | Native CSS selectors |
| Mix of utility + custom                    | Both             | Best of both worlds  |

---

## Button Component

A complete button with variants, sizes, and states.

### Using semajsx/tailwind

Best for rapid prototyping or when Tailwind covers your needs:

```tsx
import {
  cx,
  px4,
  px6,
  py2,
  py3,
  roundedMd,
  fontMedium,
  border0,
  bgBlue500,
  bgGray200,
  bgRed500,
  textWhite,
  textGray800,
  textSm,
  textBase,
  textLg,
  opacity50,
  cursorPointer,
  cursorNotAllowed,
} from "semajsx/tailwind";

type ButtonProps = {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  children: React.ReactNode;
};

const variants = {
  primary: [bgBlue500, textWhite],
  secondary: [bgGray200, textGray800],
  danger: [bgRed500, textWhite],
};

const sizes = {
  sm: [px4, py2, textSm],
  md: [px4, py2, textBase],
  lg: [px6, py3, textLg],
};

function Button({ variant = "primary", size = "md", disabled, children }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cx(
        roundedMd,
        fontMedium,
        border0,
        cursorPointer,
        variants[variant],
        sizes[size],
        disabled && [opacity50, cursorNotAllowed],
      )}
    >
      {children}
    </button>
  );
}
```

### Using semajsx/style

Better when you need hover states, focus rings, or custom animations:

```ts
// button.style.ts
import { classes, rule, rules } from "semajsx/style";

const c = classes(["root", "primary", "secondary", "danger", "sm", "md", "lg"]);

export const root = rule`${c.root} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}`;

export const states = rules(
  rule`${c.root}:hover { filter: brightness(1.1); }`,
  rule`${c.root}:active { transform: scale(0.98); }`,
  rule`${c.root}:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }`,
  rule`${c.root}:disabled { opacity: 0.5; cursor: not-allowed; filter: none; transform: none; }`,
);

export const primary = rule`${c.primary} { background: #3b82f6; color: white; }`;
export const secondary = rule`${c.secondary} { background: #e5e7eb; color: #1f2937; }`;
export const danger = rule`${c.danger} { background: #ef4444; color: white; }`;

export const sm = rule`${c.sm} { padding: 6px 12px; font-size: 14px; }`;
export const md = rule`${c.md} { padding: 8px 16px; font-size: 16px; }`;
export const lg = rule`${c.lg} { padding: 12px 24px; font-size: 18px; }`;
```

```tsx
// Button.tsx
import { useStyle } from "semajsx/style/react";
import * as button from "./button.style";

function Button({ variant = "primary", size = "md", disabled, children }) {
  const cx = useStyle();
  const variantStyle = button[variant];
  const sizeStyle = button[size];

  return (
    <button disabled={disabled} className={cx(button.root, variantStyle, sizeStyle)}>
      {children}
    </button>
  );
}
```

---

## Card Component

A flexible card with header, body, and footer sections.

### Combined Approach (Recommended)

Use semajsx/tailwind for layout, semajsx/style for the shadow and border:

```ts
// card.style.ts
import { classes, rule } from "semajsx/style";

const c = classes(["card"]);

export const card = rule`${c.card} {
  background: white;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}`;

export const cardHover = rule`${c.card}:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  transition: all 0.2s ease;
}`;
```

```tsx
// Card.tsx
import { useStyle } from "semajsx/style/react";
import {
  cx as tw,
  p4,
  p6,
  borderB,
  borderGray200,
  textXl,
  fontBold,
  textGray600,
} from "semajsx/tailwind";
import * as card from "./card.style";

function Card({ title, children, footer }) {
  const cx = useStyle();

  return (
    <div className={cx(card.card)}>
      {title && (
        <div className={tw(p4, borderB, borderGray200)}>
          <h3 className={tw(textXl, fontBold)}>{title}</h3>
        </div>
      )}
      <div className={tw(p6)}>{children}</div>
      {footer && <div className={tw(p4, borderT, borderGray200, textGray600)}>{footer}</div>}
    </div>
  );
}
```

---

## Responsive Navbar

A navbar that collapses to a hamburger menu on mobile.

```ts
// navbar.style.ts
import { classes, rule, rules } from "semajsx/style";

const c = classes(["nav", "brand", "links", "link", "hamburger", "mobileMenu"]);

export const nav = rule`${c.nav} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}`;

export const brand = rule`${c.brand} {
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}`;

export const links = rule`${c.links} {
  display: flex;
  gap: 24px;
}`;

export const linksResponsive = rule`@media (max-width: 768px) {
  ${c.links} { display: none; }
}`;

export const link = rule`${c.link} {
  color: #4b5563;
  text-decoration: none;
  font-weight: 500;
}`;

export const linkStates = rules(
  rule`${c.link}:hover { color: #3b82f6; }`,
  rule`${c.link}.active { color: #3b82f6; }`,
);

export const hamburger = rule`${c.hamburger} {
  display: none;
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
}`;

export const hamburgerResponsive = rule`@media (max-width: 768px) {
  ${c.hamburger} { display: block; }
}`;

export const mobileMenu = rule`${c.mobileMenu} {
  display: none;
  flex-direction: column;
  gap: 16px;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}`;

export const mobileMenuOpen = rule`${c.mobileMenu}.open {
  display: flex;
}`;
```

```tsx
// Navbar.tsx
import { useState } from "react";
import { useStyle } from "semajsx/style/react";
import * as nav from "./navbar.style";

function Navbar({ links }) {
  const cx = useStyle();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <nav className={cx(nav.nav)}>
        <a href="/" className={cx(nav.brand)}>
          Logo
        </a>

        {/* Desktop links */}
        <div className={cx(nav.links)}>
          {links.map((link) => (
            <a key={link.href} href={link.href} className={cx(nav.link)}>
              {link.label}
            </a>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button className={cx(nav.hamburger)} onClick={() => setIsOpen(!isOpen)}>
          ☰
        </button>
      </nav>

      {/* Mobile menu */}
      <div className={cx(nav.mobileMenu, isOpen && "open")}>
        {links.map((link) => (
          <a key={link.href} href={link.href} className={cx(nav.link)}>
            {link.label}
          </a>
        ))}
      </div>
    </>
  );
}
```

---

## Form with Validation

Input fields with error states and validation feedback.

```ts
// form.style.ts
import { classes, rule, rules } from "semajsx/style";

const c = classes(["field", "label", "input", "error", "hint"]);

export const field = rule`${c.field} {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}`;

export const label = rule`${c.label} {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}`;

export const input = rule`${c.input} {
  padding: 10px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}`;

export const inputStates = rules(
  rule`${c.input}:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); outline: none; }`,
  rule`${c.input}::placeholder { color: #9ca3af; }`,
  rule`${c.input}.error { border-color: #ef4444; }`,
  rule`${c.input}.error:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1); }`,
);

export const error = rule`${c.error} {
  font-size: 13px;
  color: #ef4444;
}`;

export const hint = rule`${c.hint} {
  font-size: 13px;
  color: #6b7280;
}`;
```

```tsx
// FormField.tsx
import { useStyle } from "semajsx/style/react";
import * as form from "./form.style";

function FormField({ label, error, hint, ...inputProps }) {
  const cx = useStyle();

  return (
    <div className={cx(form.field)}>
      <label className={cx(form.label)}>{label}</label>
      <input className={cx(form.input, error && "error")} {...inputProps} />
      {error && <span className={cx(form.error)}>{error}</span>}
      {hint && !error && <span className={cx(form.hint)}>{hint}</span>}
    </div>
  );
}

// Usage
function LoginForm() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (value: string) => {
    if (!value.includes("@")) {
      setEmailError("Please enter a valid email");
    } else {
      setEmailError("");
    }
  };

  return (
    <form>
      <FormField
        label="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={(e) => validateEmail(e.target.value)}
        error={emailError}
        hint="We'll never share your email"
      />
    </form>
  );
}
```

---

## Reactive Theme Toggle

Dynamic theme switching using signals.

```ts
// theme.style.ts
import { classes, rule } from "semajsx/style";
import { signal } from "semajsx/signal";

// Theme signal
export const isDark = signal(false);
export const bgColor = signal("#ffffff");
export const textColor = signal("#1f2937");

// Toggle function
export function toggleTheme() {
  isDark.value = !isDark.value;
  bgColor.value = isDark.value ? "#1f2937" : "#ffffff";
  textColor.value = isDark.value ? "#f3f4f6" : "#1f2937";
}

const c = classes(["container"]);

// Reactive rule using signals
export const container = rule`${c.container} {
  background: ${bgColor};
  color: ${textColor};
  min-height: 100vh;
  padding: 24px;
  transition: background 0.3s ease, color 0.3s ease;
}`;
```

```tsx
// App.tsx
import { StyleAnchor, useStyle } from "semajsx/style/react";
import * as theme from "./theme.style";

function App() {
  const cx = useStyle();

  return (
    <StyleAnchor>
      <div className={cx(theme.container)}>
        <h1>Hello World</h1>
        <button onClick={theme.toggleTheme}>Toggle Theme</button>
      </div>
    </StyleAnchor>
  );
}
```

<Callout type="tip" title="Signal Requirement">
Reactive styles require `StyleAnchor` to work. Without it, signal changes won't update the DOM.
</Callout>

---

## Modal Dialog

A modal with backdrop, animation, and focus trap.

```ts
// modal.style.ts
import { classes, rule, rules } from "semajsx/style";

const c = classes(["backdrop", "dialog", "header", "body", "footer", "close"]);

export const backdrop = rule`${c.backdrop} {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.2s ease, visibility 0.2s ease;
}`;

export const backdropOpen = rule`${c.backdrop}.open {
  opacity: 1;
  visibility: visible;
}`;

export const dialog = rule`${c.dialog} {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  transform: scale(0.95);
  transition: transform 0.2s ease;
}`;

export const dialogOpen = rule`${c.backdrop}.open ${c.dialog} {
  transform: scale(1);
}`;

export const header = rule`${c.header} {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}`;

export const body = rule`${c.body} {
  padding: 20px;
  overflow-y: auto;
}`;

export const footer = rule`${c.footer} {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}`;

export const close = rule`${c.close} {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6b7280;
}`;

export const closeHover = rule`${c.close}:hover {
  color: #1f2937;
}`;
```

```tsx
// Modal.tsx
import { useEffect, useRef } from "react";
import { useStyle } from "semajsx/style/react";
import * as modal from "./modal.style";

function Modal({ isOpen, onClose, title, children, footer }) {
  const cx = useStyle();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className={cx(modal.backdrop, isOpen && "open")} onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cx(modal.dialog)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cx(modal.header)}>
          <h2>{title}</h2>
          <button className={cx(modal.close)} onClick={onClose}>
            ×
          </button>
        </div>
        <div className={cx(modal.body)}>{children}</div>
        {footer && <div className={cx(modal.footer)}>{footer}</div>}
      </div>
    </div>
  );
}
```

---

## Vue Integration

Complete example with Vue 3 Composition API.

```vue
<script setup lang="ts">
import { ref } from "vue";
import { StyleAnchor, useStyle } from "semajsx/style/vue";
import * as button from "./button.style";
import * as card from "./card.style";

const cx = useStyle();
const count = ref(0);
</script>

<template>
  <StyleAnchor>
    <div :class="cx(card.card)">
      <h2>Vue Counter</h2>
      <p>Count: {{ count }}</p>
      <button :class="cx(button.root, button.primary)" @click="count++">Increment</button>
    </div>
  </StyleAnchor>
</template>
```

---

## SSR with Preloading

Extract CSS for server-side rendering.

```tsx
// server.ts
import { preload, extractCss } from "semajsx/style";
import * as button from "./button.style";
import * as card from "./card.style";
import * as modal from "./modal.style";

// Collect all styles
const allStyles = { ...button, ...card, ...modal };

// Preload and extract
preload(allStyles);
const css = extractCss(allStyles);

// Render HTML with inline styles
const html = `
<!DOCTYPE html>
<html>
<head>
  <style>${css}</style>
</head>
<body>
  <div id="app">${renderedContent}</div>
  <script src="/client.js"></script>
</body>
</html>
`;
```

<Callout type="info" title="Hydration">
When hydrating on the client, styles are already in the DOM. The registry detects duplicates and skips re-injection.
</Callout>

---

## Next Steps

- Explore the full [Style API](/reference/styling)
- Learn [Tailwind utilities](/reference/tailwind)
- Check out [DOM Rendering](/reference/dom-rendering) for component integration
