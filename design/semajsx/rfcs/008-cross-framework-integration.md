# RFC: Cross-Framework Integration (React & Vue Adapters)

**Date**: 2026-01-10
**Author**: SemaJSX Team
**Status**: Draft
**Related**: RFC 007 (Component Library Runtime)

---

## 1. Summary

This RFC defines the architecture and API for bidirectional framework adapters that enable SemaJSX components to be used in React/Vue applications, and React/Vue components to be used in SemaJSX applications, with full support for props, events, context, slots, and lifecycle management.

**Goal**: Enable seamless cross-framework nesting like `React → SemaJSX → React → SemaJSX → Vue → ...`

---

## 2. Motivation

### 2.1 Problem Statement

**Current State:**

- Component libraries are locked to specific frameworks
- React components cannot be used in Vue apps
- Vue components cannot be used in React apps
- Micro-frontends require iframe isolation
- Design systems must maintain separate implementations

**Desired State:**

- Write component once in SemaJSX
- Use in any framework (React, Vue, Angular, Svelte)
- Nest frameworks freely (React inside SemaJSX inside Vue)
- Share components across micro-frontends without iframes

### 2.2 User Scenarios

**Scenario 1: Component Library Author**

```typescript
// Write once in SemaJSX
export function Button({ children, onClick, primary }) {
  return <button class={[btn.root, primary && btn.primary]} onClick={onClick}>
    {children}
  </button>;
}

// Use in React
import { Button } from '@my-lib/ui/react';
<Button primary onClick={() => alert('Hi')}>Click</Button>

// Use in Vue
import { Button } from '@my-lib/ui/vue';
<Button primary @click="handleClick">Click</Button>
```

**Scenario 2: Micro-Frontend Developer**

```typescript
// Main app in React
function App() {
  return (
    <div>
      <ReactHeader />
      <SemaJSXDashboard> {/* SemaJSX component in React */}
        <VueChart data={data} /> {/* Vue component in SemaJSX */}
      </SemaJSXDashboard>
      <ReactFooter />
    </div>
  );
}
```

**Scenario 3: Gradual Migration**

```typescript
// Migrate from React to SemaJSX incrementally
function OldReactApp() {
  return (
    <div>
      {/* Keep existing React components */}
      <ReactDataTable />

      {/* New components in SemaJSX */}
      <SemaJSXButton primary>New Button</SemaJSXButton>

      {/* Nested: SemaJSX uses legacy React component */}
      <SemaJSXCard>
        <LegacyReactForm />
      </SemaJSXCard>
    </div>
  );
}
```

### 2.3 Success Metrics

- [ ] Props pass through correctly (95%+ compatibility)
- [ ] Events fire in both directions
- [ ] Context is shared across boundaries
- [ ] Slots/children work naturally
- [ ] TypeScript types are inferred correctly
- [ ] Performance overhead <1ms per adapter
- [ ] Memory leaks are prevented

---

## 3. Design Principles

1. **Transparent API** - Adapters should be invisible to end users
2. **Type Safety** - Full TypeScript support with inference
3. **Performance** - Minimal overhead (<1ms per boundary)
4. **Predictable** - No surprises, follow framework conventions
5. **Debuggable** - Clear error messages, inspectable in DevTools

---

## 4. Architecture Overview

### 4.1 Adapter Packages

```
packages/
├── adapter-react/        # React ↔ SemaJSX adapters
│   ├── src/
│   │   ├── toReact.tsx    # SemaJSX -> React wrapper
│   │   ├── fromReact.tsx  # React -> SemaJSX wrapper
│   │   ├── context.ts     # Context bridging
│   │   └── index.ts
│   └── package.json
│
├── adapter-vue/          # Vue ↔ SemaJSX adapters
│   ├── src/
│   │   ├── toVue.ts       # SemaJSX -> Vue wrapper
│   │   ├── fromVue.ts     # Vue -> SemaJSX wrapper
│   │   ├── provide.ts     # Provide/inject bridging
│   │   └── index.ts
│   └── package.json
```

### 4.2 Data Flow

**SemaJSX → React:**

```
React Parent
  ↓ (props)
ReactWrapper Component
  ↓ (mount SemaJSX)
SemaJSX Component
  ↑ (events via callbacks)
ReactWrapper
  ↑ (propagate to React)
React Parent
```

**React → SemaJSX:**

```
SemaJSX Parent
  ↓ (props)
SemaWrapper Component
  ↓ (createRoot + mount)
React Component
  ↑ (events via props)
SemaWrapper
  ↑ (propagate to SemaJSX)
SemaJSX Parent
```

---

## 5. API Design

### 5.1 `toReact()` - SemaJSX → React

#### 5.1.1 Basic Usage

```typescript
// @semajsx/adapter-react
export function toReact<P extends object>(SemaComponent: Component<P>): React.ComponentType<P>;
```

**Example:**

```typescript
import { toReact } from '@semajsx/adapter-react';
import { Button } from '@my-lib/semajsx';

// Wrap SemaJSX component for React
const ReactButton = toReact(Button);

// Use in React
function App() {
  return (
    <ReactButton
      primary
      onClick={() => console.log('Clicked')}
    >
      Click Me
    </ReactButton>
  );
}
```

#### 5.1.2 Implementation

```typescript
// packages/adapter-react/src/toReact.tsx
import { useRef, useEffect, createElement } from "react";
import { render, unmount } from "@semajsx/dom";
import type { Component, JSXNode } from "@semajsx/core";

export function toReact<P extends object>(SemaComponent: Component<P>): React.ComponentType<P> {
  return function ReactWrapper(props: P) {
    const containerRef = useRef<HTMLDivElement>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
      if (!containerRef.current) return;

      // Convert React props to SemaJSX props
      const semaProps = convertPropsToSema(props);

      // Render SemaJSX component
      const vnode = createElement(SemaComponent, semaProps);
      const cleanup = render(vnode, containerRef.current);
      cleanupRef.current = cleanup;

      // Cleanup on unmount
      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
      };
    }, [props]); // Re-render when props change

    return createElement("div", {
      ref: containerRef,
      style: { display: "contents" }, // Don't affect layout
    });
  };
}

// Props conversion: React -> SemaJSX
function convertPropsToSema(reactProps: any): any {
  const semaProps: any = {};

  for (const key in reactProps) {
    // className -> class
    if (key === "className") {
      semaProps.class = reactProps.className;
      continue;
    }

    // Pass through everything else
    semaProps[key] = reactProps[key];
  }

  return semaProps;
}
```

#### 5.1.3 Advanced Features

**Ref Support:**

```typescript
import { forwardRef } from "react";

export function toReact<P extends object, R = any>(
  SemaComponent: Component<P>,
  options?: { ref?: boolean },
): React.ComponentType<P> {
  if (options?.ref) {
    return forwardRef<R, P>((props, ref) => {
      const containerRef = useRef<HTMLDivElement>(null);

      useImperativeHandle(ref, () => {
        // Expose SemaJSX component instance
        return containerRef.current?.firstChild as R;
      });

      // ... rest of implementation
    });
  }

  // ... non-ref implementation
}
```

**Context Bridging:**

```typescript
// Bridge React Context to SemaJSX Context
export function toReact<P extends object>(
  SemaComponent: Component<P>,
  options?: {
    contextMap?: Map<React.Context<any>, SemaContext<any>>;
  },
): React.ComponentType<P> {
  return function ReactWrapper(props: P) {
    // ... setup

    // Collect React Context values
    const contextValues = new Map();
    if (options?.contextMap) {
      for (const [reactCtx, semaCtx] of options.contextMap) {
        const value = useContext(reactCtx);
        contextValues.set(semaCtx, value);
      }
    }

    useEffect(() => {
      // Pass context to SemaJSX component
      const vnode = createElement(SemaComponent, semaProps, {
        provide: Array.from(contextValues.entries()),
      });
      // ... render
    }, [props, contextValues]);

    // ...
  };
}
```

---

### 5.2 `fromReact()` - React → SemaJSX

#### 5.2.1 Basic Usage

```typescript
// @semajsx/adapter-react
export function fromReact<P extends object>(ReactComponent: React.ComponentType<P>): Component<P>;
```

**Example:**

```typescript
import { fromReact } from '@semajsx/adapter-react';
import ReactDatePicker from 'react-datepicker';

// Wrap React component for SemaJSX
const DatePicker = fromReact(ReactDatePicker);

// Use in SemaJSX
function Form() {
  const date = signal(new Date());

  return (
    <div>
      <DatePicker
        selected={date.value}
        onChange={(d) => date.value = d}
      />
    </div>
  );
}
```

#### 5.2.2 Implementation

```typescript
// packages/adapter-react/src/fromReact.tsx
import { createRoot, type Root } from "react-dom/client";
import { createElement as h } from "react";
import type { Component } from "@semajsx/core";

export function fromReact<P extends object>(ReactComponent: React.ComponentType<P>): Component<P> {
  return function SemaWrapper(props: P, ctx) {
    // Create container for React component
    const container = document.createElement("div");
    container.style.display = "contents";

    let root: Root | null = null;

    // Mount React component
    const semaProps = convertPropsToReact(props);
    root = createRoot(container);
    root.render(h(ReactComponent, semaProps));

    // Cleanup on unmount
    ctx.onCleanup(() => {
      if (root) {
        root.unmount();
        root = null;
      }
    });

    return container;
  };
}

// Props conversion: SemaJSX -> React
function convertPropsToReact(semaProps: any): any {
  const reactProps: any = {};

  for (const key in semaProps) {
    // class -> className
    if (key === "class") {
      reactProps.className = semaProps.class;
      continue;
    }

    // Pass through everything else
    reactProps[key] = semaProps[key];
  }

  return reactProps;
}
```

#### 5.2.3 Props Reactivity

**Problem**: React components don't re-render when SemaJSX signals change

**Solution**: Subscribe to signals and trigger React re-render

```typescript
import { isSignal, type Signal } from "@semajsx/signal";

export function fromReact<P extends object>(ReactComponent: React.ComponentType<P>): Component<P> {
  return function SemaWrapper(props: P, ctx) {
    const container = document.createElement("div");
    container.style.display = "contents";

    let root: Root | null = null;
    const subscriptions: (() => void)[] = [];

    // Track signals in props
    const signalProps: Map<string, Signal<any>> = new Map();
    for (const key in props) {
      if (isSignal(props[key])) {
        signalProps.set(key, props[key] as Signal<any>);
      }
    }

    // Render function
    function renderReact() {
      const reactProps = convertPropsToReact(props, signalProps);
      if (root) {
        root.render(h(ReactComponent, reactProps));
      } else {
        root = createRoot(container);
        root.render(h(ReactComponent, reactProps));
      }
    }

    // Subscribe to signal changes
    for (const [key, signal] of signalProps) {
      const unsub = signal.subscribe(() => {
        renderReact(); // Re-render React component
      });
      subscriptions.push(unsub);
    }

    // Initial render
    renderReact();

    // Cleanup
    ctx.onCleanup(() => {
      subscriptions.forEach((unsub) => unsub());
      if (root) root.unmount();
    });

    return container;
  };
}

// Convert props, unwrapping signals
function convertPropsToReact(semaProps: any, signalProps: Map<string, Signal<any>>): any {
  const reactProps: any = {};

  for (const key in semaProps) {
    if (key === "class") {
      reactProps.className = semaProps.class;
    } else if (signalProps.has(key)) {
      // Unwrap signal to value
      reactProps[key] = signalProps.get(key)!.value;
    } else {
      reactProps[key] = semaProps[key];
    }
  }

  return reactProps;
}
```

---

### 5.3 Vue Adapters

#### 5.3.1 `toVue()` - SemaJSX → Vue

```typescript
// @semajsx/adapter-vue
import { defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import { render } from "@semajsx/dom";
import type { Component } from "@semajsx/core";

export function toVue<P extends object>(SemaComponent: Component<P>): any {
  return defineComponent({
    name: `SemaJSX(${SemaComponent.name})`,
    props: extractProps<P>(),

    setup(props, { slots, emit }) {
      const containerRef = ref<HTMLElement | null>(null);
      let cleanup: (() => void) | null = null;

      onMounted(() => {
        if (!containerRef.value) return;

        // Convert Vue props to SemaJSX props
        const semaProps = convertVuePropsToSema(props, emit, slots);

        // Render SemaJSX component
        cleanup = render(createElement(SemaComponent, semaProps), containerRef.value);
      });

      onUnmounted(() => {
        if (cleanup) cleanup();
      });

      return () =>
        h("div", {
          ref: containerRef,
          style: { display: "contents" },
        });
    },
  });
}

// Convert Vue props -> SemaJSX props
function convertVuePropsToSema(vueProps: any, emit: any, slots: any): any {
  const semaProps: any = {};

  // Props
  for (const key in vueProps) {
    semaProps[key] = vueProps[key];
  }

  // Events: @click -> onClick
  // Vue uses emit, but we need to convert to callback props
  const eventHandlers: any = {};
  semaProps.onEmit = (event: string, ...args: any[]) => {
    emit(event, ...args);
  };

  // Slots -> children
  if (slots.default) {
    semaProps.children = slots.default();
  }

  return semaProps;
}
```

#### 5.3.2 `fromVue()` - Vue → SemaJSX

```typescript
// @semajsx/adapter-vue
import { createApp, type App } from "vue";
import type { Component } from "@semajsx/core";

export function fromVue<P extends object>(VueComponent: any): Component<P> {
  return function SemaWrapper(props: P, ctx) {
    const container = document.createElement("div");
    container.style.display = "contents";

    let app: App | null = null;

    // Convert SemaJSX props to Vue props
    const vueProps = convertSemaPropsToVue(props);

    // Mount Vue component
    app = createApp(VueComponent, vueProps);
    app.mount(container);

    // Cleanup
    ctx.onCleanup(() => {
      if (app) {
        app.unmount();
        app = null;
      }
    });

    return container;
  };
}

// Convert SemaJSX props -> Vue props
function convertSemaPropsToVue(semaProps: any): any {
  const vueProps: any = {};

  for (const key in semaProps) {
    // onClick -> @click (onXxx -> xxx event)
    if (key.startsWith("on") && typeof semaProps[key] === "function") {
      const eventName = key.slice(2).toLowerCase();
      vueProps[`on${eventName.charAt(0).toUpperCase()}${eventName.slice(1)}`] = semaProps[key];
    } else {
      vueProps[key] = semaProps[key];
    }
  }

  return vueProps;
}
```

---

## 6. Props Mapping

### 6.1 Mapping Table

| Aspect       | React           | SemaJSX         | Vue                   |
| ------------ | --------------- | --------------- | --------------------- |
| **Class**    | `className`     | `class`         | `class`               |
| **Style**    | `style` object  | `style` object  | `style` object        |
| **Events**   | `onClick`       | `onClick`       | `@click` or `onClick` |
| **Children** | `children` prop | `children` prop | `slots.default()`     |
| **Ref**      | `ref`           | `ref`           | `ref`                 |
| **Key**      | `key`           | `key`           | `key`                 |

### 6.2 Event Name Conversion

```typescript
// Event name mapping table
const EVENT_MAP = {
  // React -> SemaJSX (already aligned)
  onClick: "onClick",
  onChange: "onChange",
  onInput: "onInput",
  onFocus: "onFocus",
  onBlur: "onBlur",
  onSubmit: "onSubmit",
  // ... all events are camelCase in both

  // Vue -> SemaJSX
  click: "onClick",
  change: "onChange",
  input: "onInput",
  focus: "onFocus",
  blur: "onBlur",
  submit: "onSubmit",
  // ...
};

function convertVueEventToSema(vueEvent: string): string {
  // @click -> onClick
  return EVENT_MAP[vueEvent] || `on${capitalize(vueEvent)}`;
}

function convertSemaEventToVue(semaEvent: string): string {
  // onClick -> click
  if (semaEvent.startsWith("on")) {
    return semaEvent.slice(2).toLowerCase();
  }
  return semaEvent;
}
```

### 6.3 Special Props Handling

**Boolean Props:**

```typescript
// React/SemaJSX: <Button primary /> (primary=true)
// Vue: <Button primary /> (primary=true) or <Button :primary="true" />

// No conversion needed - all frameworks handle boolean attributes
```

**Children:**

```typescript
// React:
<Button>Click Me</Button>
// props.children = "Click Me"

// SemaJSX:
<Button>Click Me</Button>
// props.children = "Click Me"

// Vue:
<Button>Click Me</Button>
// slots.default() returns VNodes

// Conversion needed for Vue -> SemaJSX:
function convertVueSlots(slots: any): any {
  if (slots.default) {
    // Render Vue VNodes to DOM, then return
    const div = document.createElement('div');
    // ... render Vue VNodes to div
    return div.childNodes;
  }
  return null;
}
```

---

## 7. Context Bridging

### 7.1 React Context ↔ SemaJSX Context

**Problem**: React uses `React.createContext()`, SemaJSX uses `context<T>()`

**Solution**: Explicit mapping

```typescript
// Define contexts
import { createContext } from 'react';
import { context } from '@semajsx/core';

// React
const ReactThemeContext = createContext({ theme: 'light' });

// SemaJSX
const SemaThemeContext = context<{ theme: string }>();

// Bridge when wrapping
const Button = toReact(SemaButton, {
  contextMap: new Map([
    [ReactThemeContext, SemaThemeContext]
  ])
});

// Usage in React app
<ReactThemeContext.Provider value={{ theme: 'dark' }}>
  <Button>Click</Button> {/* SemaButton gets theme='dark' */}
</ReactThemeContext.Provider>
```

**Implementation:**

```typescript
export function toReact<P extends object>(
  SemaComponent: Component<P>,
  options?: {
    contextMap?: Map<React.Context<any>, SemaContext<any>>
  }
): React.ComponentType<P> {
  return function ReactWrapper(props: P) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Collect React Context values
    const contextEntries: [SemaContext<any>, any][] = [];
    if (options?.contextMap) {
      for (const [reactCtx, semaCtx] of options.contextMap) {
        const value = useContext(reactCtx);
        contextEntries.push([semaCtx, value]);
      }
    }

    useEffect(() => {
      if (!containerRef.current) return;

      // Render with context
      const vnode = createElement(SemaComponent, props);
      const wrapper = (
        <Context provide={contextEntries}>
          {vnode}
        </Context>
      );
      return render(wrapper, containerRef.current);
    }, [props, contextEntries]);

    return createElement('div', { ref: containerRef, style: { display: 'contents' } });
  };
}
```

### 7.2 Vue Provide/Inject ↔ SemaJSX Context

```typescript
// Vue provide/inject
const ThemeKey = Symbol('theme');

// SemaJSX
const SemaThemeContext = context<{ theme: string }>();

// Bridge
const Button = toVue(SemaButton, {
  injectMap: new Map([
    [ThemeKey, SemaThemeContext]
  ])
});

// Usage in Vue app
<script setup>
provide(ThemeKey, { theme: 'dark' });
</script>

<template>
  <Button>Click</Button> <!-- SemaButton gets theme='dark' -->
</template>
```

---

## 8. Slots & Children

### 8.1 React Children

**React:**

```tsx
<Button>
  <Icon name="check" />
  <span>Submit</span>
</Button>

// props.children = [<Icon />, <span />]
```

**SemaJSX receives:**

```tsx
props.children = [<Icon />, <span />];
// Renders directly
```

### 8.2 Vue Slots

**Vue:**

```vue
<Button>
  <template #icon>
    <Icon name="check" />
  </template>
  <template #default>
    Submit
  </template>
</Button>
```

**SemaJSX receives:**

```typescript
// In toVue() conversion
const semaProps = {
  children: slots.default?.(), // Default slot
  icon: slots.icon?.(), // Named slot
};
```

**Implementation:**

```typescript
function convertVuePropsToSema(vueProps: any, emit: any, slots: any): any {
  const semaProps: any = { ...vueProps };

  // Default slot -> children
  if (slots.default) {
    semaProps.children = renderVueSlotToDOM(slots.default());
  }

  // Named slots -> props
  for (const slotName in slots) {
    if (slotName !== "default") {
      semaProps[slotName] = renderVueSlotToDOM(slots[slotName]());
    }
  }

  return semaProps;
}

// Render Vue VNode to DOM
function renderVueSlotToDOM(vnode: any): Node | Node[] {
  const container = document.createElement("div");
  // Use Vue's internal renderer to convert VNode to DOM
  // ... (implementation depends on Vue internals)
  return Array.from(container.childNodes);
}
```

---

## 9. Lifecycle Synchronization

### 9.1 Lifecycle Mapping

| Event       | React                          | SemaJSX           | Vue             |
| ----------- | ------------------------------ | ----------------- | --------------- |
| **Mount**   | `useEffect(() => {}, [])`      | Rendered          | `onMounted()`   |
| **Update**  | `useEffect(() => {}, [deps])`  | Signal change     | `onUpdated()`   |
| **Unmount** | `useEffect(() => cleanup, [])` | `ctx.onCleanup()` | `onUnmounted()` |

### 9.2 Cleanup Coordination

**React wrapper for SemaJSX:**

```typescript
useEffect(() => {
  // Mount SemaJSX component
  const cleanup = render(vnode, container);

  // React cleanup calls SemaJSX cleanup
  return () => {
    cleanup();
  };
}, []);
```

**SemaJSX wrapper for React:**

```typescript
function SemaWrapper(props, ctx) {
  const root = createRoot(container);
  root.render(<ReactComponent {...props} />);

  // SemaJSX cleanup calls React unmount
  ctx.onCleanup(() => {
    root.unmount();
  });

  return container;
}
```

### 9.3 Update Propagation

**Problem**: When to re-render wrapped components?

**Strategy**:

1. **Shallow props comparison** - Re-render on props change
2. **Signal subscription** - Re-render on signal change (for React/Vue wrappers)
3. **Manual trigger** - Expose `forceUpdate()` if needed

```typescript
// Track previous props
let prevProps: any = null;

useEffect(() => {
  // Shallow compare props
  if (!shallowEqual(props, prevProps)) {
    // Re-render SemaJSX component
    render(createElement(SemaComponent, props), container);
    prevProps = { ...props };
  }
}, [props]);

function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object") return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}
```

---

## 10. TypeScript Support

### 10.1 Type Inference

**Goal**: Preserve component prop types through adapters

```typescript
// SemaJSX component
interface ButtonProps {
  children: JSXNode;
  primary?: boolean;
  onClick?: (e: MouseEvent) => void;
}

const SemaButton: Component<ButtonProps> = (props) => { /* ... */ };

// React wrapper should infer ButtonProps
const ReactButton = toReact(SemaButton);
// ReactButton: React.ComponentType<ButtonProps>

// Usage: TypeScript knows props
<ReactButton primary onClick={(e) => {/* e: MouseEvent */}}>
  Click
</ReactButton>
```

**Implementation:**

```typescript
export function toReact<P extends object>(SemaComponent: Component<P>): React.ComponentType<P> {
  // Type is preserved through generic P
  return function ReactWrapper(props: P) {
    // ...
  };
}
```

### 10.2 Props Type Conversion

**React `className` vs SemaJSX `class`:**

```typescript
// Define conversion types
type ReactifyProps<P> = Omit<P, "class"> & {
  className?: P extends { class: infer C } ? C : never;
};

type SemaifyProps<P> = Omit<P, "className"> & {
  class?: P extends { className: infer C } ? C : never;
};

// Apply conversion in adapter
export function toReact<P extends object>(
  SemaComponent: Component<P>,
): React.ComponentType<ReactifyProps<P>> {
  return function ReactWrapper(props: ReactifyProps<P>) {
    // Convert className -> class
    const semaProps = {
      ...props,
      class: (props as any).className,
    } as P;
    // ...
  };
}
```

### 10.3 Event Handler Types

```typescript
// React: MouseEvent from React
import type { MouseEvent as ReactMouseEvent } from "react";

// SemaJSX: MouseEvent from DOM
type SemaMouseEvent = MouseEvent;

// Need conversion
type EventHandler<E> = (event: E) => void;

interface ButtonProps {
  onClick?: EventHandler<SemaMouseEvent>; // SemaJSX expects DOM event
}

// React wrapper needs to accept React event
type ReactButtonProps = Omit<ButtonProps, "onClick"> & {
  onClick?: EventHandler<ReactMouseEvent>;
};

export function toReact<P extends object>(
  SemaComponent: Component<P>,
): React.ComponentType<ReactButtonProps> {
  return function ReactWrapper(props: ReactButtonProps) {
    // Convert React event -> DOM event
    const semaProps = {
      ...props,
      onClick: (e: SemaMouseEvent) => {
        // e is native DOM event
        props.onClick?.(e as any as ReactMouseEvent);
      },
    };
    // ...
  };
}
```

---

## 11. Performance Considerations

### 11.1 Overhead Measurement

**Target**: <1ms per adapter boundary

**Measurement:**

```typescript
// Benchmark adapter overhead
console.time('adapter');

// SemaJSX -> React -> SemaJSX -> React (4 boundaries)
const ReactButton = toReact(SemaButton);
const SemaReactButton = fromReact(ReactButton);
const ReactSemaButton = toReact(SemaReactButton);

<ReactSemaButton>Test</ReactSemaButton>

console.timeEnd('adapter'); // Should be <4ms total
```

### 11.2 Optimization Strategies

**1. Shallow Props Comparison:**

```typescript
// Only re-render if props actually changed
if (shallowEqual(props, prevProps)) {
  return; // Skip re-render
}
```

**2. Batch Updates:**

```typescript
// Batch multiple prop changes
let updateScheduled = false;

function scheduleUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;

  queueMicrotask(() => {
    renderComponent();
    updateScheduled = false;
  });
}
```

**3. Lazy Container Creation:**

```typescript
// Only create container when needed
let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (!container) {
    container = document.createElement("div");
    container.style.display = "contents";
  }
  return container;
}
```

**4. WeakMap Caching:**

```typescript
// Cache wrapped components
const wrappedComponents = new WeakMap<Component<any>, React.ComponentType<any>>();

export function toReact<P extends object>(SemaComponent: Component<P>): React.ComponentType<P> {
  if (wrappedComponents.has(SemaComponent)) {
    return wrappedComponents.get(SemaComponent)!;
  }

  const ReactWrapper = function (props: P) {
    /* ... */
  };
  wrappedComponents.set(SemaComponent, ReactWrapper);
  return ReactWrapper;
}
```

### 11.3 Memory Management

**Prevent Memory Leaks:**

```typescript
// Track all subscriptions
const subscriptions = new Set<() => void>();

// Subscribe to signal
const unsub = signal.subscribe(() => {
  /* ... */
});
subscriptions.add(unsub);

// Cleanup all on unmount
ctx.onCleanup(() => {
  subscriptions.forEach((unsub) => unsub());
  subscriptions.clear();
});
```

**WeakRef for DOM Elements:**

```typescript
// Don't hold strong refs to removed DOM elements
const containerRef = new WeakRef(container);

// Check if still alive
const container = containerRef.deref();
if (!container) return; // Already garbage collected
```

---

## 12. Error Handling

### 12.1 Error Boundaries

**React Error Boundary:**

```typescript
class AdapterErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('SemaJSX component error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <div>SemaJSX component failed to render</div>;
    }
    return this.props.children;
  }
}

// Wrap SemaJSX component
export function toReact<P>(SemaComponent: Component<P>) {
  return function ReactWrapper(props: P) {
    return (
      <AdapterErrorBoundary>
        {/* Render SemaJSX component */}
      </AdapterErrorBoundary>
    );
  };
}
```

**Vue Error Handling:**

```typescript
export function toVue<P>(SemaComponent: Component<P>) {
  return defineComponent({
    errorCaptured(err: Error, instance, info) {
      console.error("SemaJSX component error:", err);
      return false; // Propagate to parent
    },

    setup(props) {
      // ...
    },
  });
}
```

### 12.2 Developer Experience

**Clear Error Messages:**

```typescript
function validateProps(props: any, componentName: string) {
  if (process.env.NODE_ENV === "development") {
    // Check for common mistakes
    if ("className" in props && "class" in props) {
      console.warn(
        `${componentName}: Both 'className' and 'class' props provided. ` +
          `Use 'className' for React components, 'class' for SemaJSX components.`,
      );
    }

    if ("onClick" in props && "onclick" in props) {
      console.warn(
        `${componentName}: Both 'onClick' (camelCase) and 'onclick' (lowercase) ` +
          `event handlers provided. Use camelCase.`,
      );
    }
  }
}
```

**DevTools Integration:**

```typescript
// Add display name for better debugging
export function toReact<P>(SemaComponent: Component<P>) {
  const ReactWrapper = function (props: P) {
    /* ... */
  };

  // Set display name for React DevTools
  ReactWrapper.displayName = `SemaJSX(${SemaComponent.name || "Anonymous"})`;

  return ReactWrapper;
}
```

---

## 13. Testing Strategy

### 13.1 Unit Tests

**Test Props Conversion:**

```typescript
describe('toReact', () => {
  it('should convert className to class', () => {
    const SemaButton = ({ class: className }) => <button class={className} />;
    const ReactButton = toReact(SemaButton);

    const { container } = render(<ReactButton className="btn" />);
    expect(container.querySelector('button')).toHaveClass('btn');
  });

  it('should pass through event handlers', () => {
    const handleClick = jest.fn();
    const SemaButton = ({ onClick }) => <button onClick={onClick} />;
    const ReactButton = toReact(SemaButton);

    const { getByRole } = render(<ReactButton onClick={handleClick} />);
    fireEvent.click(getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

**Test Context Bridging:**

```typescript
describe('context bridging', () => {
  it('should pass React Context to SemaJSX', () => {
    const ReactTheme = createContext({ color: 'blue' });
    const SemaTheme = context<{ color: string }>();

    const SemaButton = (props, ctx) => {
      const theme = ctx.inject(SemaTheme);
      return <button style={{ color: theme.color }}>Button</button>;
    };

    const ReactButton = toReact(SemaButton, {
      contextMap: new Map([[ReactTheme, SemaTheme]])
    });

    const { getByRole } = render(
      <ReactTheme.Provider value={{ color: 'red' }}>
        <ReactButton />
      </ReactTheme.Provider>
    );

    expect(getByRole('button')).toHaveStyle({ color: 'red' });
  });
});
```

### 13.2 Integration Tests

**Cross-Framework Nesting:**

```typescript
describe('cross-framework nesting', () => {
  it('should support React -> SemaJSX -> React', () => {
    // React component
    const ReactInner = ({ text }) => <span>{text}</span>;

    // SemaJSX component that uses React component
    const SemaOuter = ({ children }) => {
      const ReactSpan = fromReact(ReactInner);
      return (
        <div>
          <ReactSpan text="Nested" />
          {children}
        </div>
      );
    };

    // Wrap SemaJSX for React
    const ReactOuter = toReact(SemaOuter);

    // Use in React app
    const { container } = render(
      <ReactOuter>
        <p>Child</p>
      </ReactOuter>
    );

    expect(container.querySelector('span')).toHaveTextContent('Nested');
    expect(container.querySelector('p')).toHaveTextContent('Child');
  });
});
```

### 13.3 Performance Tests

**Benchmark Adapter Overhead:**

```typescript
describe('performance', () => {
  it('should have <1ms overhead per boundary', () => {
    const SemaButton = ({ children }) => <button>{children}</button>;
    const ReactButton = toReact(SemaButton);

    const start = performance.now();
    render(<ReactButton>Click</ReactButton>);
    const end = performance.now();

    expect(end - start).toBeLessThan(1);
  });

  it('should not leak memory after 1000 mounts', () => {
    const SemaButton = ({ children }) => <button>{children}</button>;
    const ReactButton = toReact(SemaButton);

    for (let i = 0; i < 1000; i++) {
      const { unmount } = render(<ReactButton>Click</ReactButton>);
      unmount();
    }

    // Force garbage collection (if available)
    if (global.gc) global.gc();

    // Memory usage should be stable
    const memUsage = process.memoryUsage().heapUsed;
    expect(memUsage).toBeLessThan(100 * 1024 * 1024); // <100MB
  });
});
```

---

## 14. Documentation Requirements

### 14.1 Getting Started Guide

**Topics:**

1. Installation
2. Basic usage (toReact, fromReact)
3. Props mapping
4. Event handling
5. Context bridging
6. Common pitfalls

### 14.2 API Reference

**For each adapter:**

- Function signature
- Parameters
- Return type
- Examples
- TypeScript types
- Performance characteristics

### 14.3 Migration Guides

**From React to SemaJSX:**

1. Wrap existing React components with `fromReact()`
2. Gradually replace with native SemaJSX
3. Remove adapters when fully migrated

**From Vue to SemaJSX:**

1. Wrap existing Vue components with `fromVue()`
2. Gradually replace with native SemaJSX
3. Remove adapters when fully migrated

---

## 15. Open Questions

- [ ] **Q1: Async Components**
  - How to handle React Suspense?
  - How to handle Vue async components?
  - Should we support SemaJSX async components?

- [ ] **Q2: Portals**
  - How to handle React portals in SemaJSX?
  - How to handle Vue teleport in SemaJSX?

- [ ] **Q3: Custom Elements**
  - Should we support wrapping Web Components?
  - How to handle Custom Elements registry?

- [ ] **Q4: Streaming SSR**
  - How to handle React Server Components?
  - How to handle Vue server-side streaming?

- [ ] **Q5: Performance Budget**
  - What's the acceptable overhead? (currently targeting <1ms)
  - Should we provide opt-in optimizations?

---

## 16. Success Criteria

- [ ] `toReact()` and `fromReact()` work with 95%+ React components
- [ ] `toVue()` and `fromVue()` work with 95%+ Vue components
- [ ] Props pass through correctly (automated tests)
- [ ] Events fire in both directions
- [ ] Context bridging works (with explicit mapping)
- [ ] TypeScript types are preserved
- [ ] Performance overhead <1ms per boundary
- [ ] No memory leaks after 10,000 mount/unmount cycles
- [ ] Clear documentation with 20+ examples
- [ ] Test coverage ≥ 85%

---

## 17. Implementation Plan

### Phase 1 (Weeks 7-9): React Adapter

- [ ] Week 7: `toReact()` basic implementation
- [ ] Week 8: `fromReact()` basic implementation + signal reactivity
- [ ] Week 9: Context bridging + TypeScript types

### Phase 2 (Weeks 13-15): Vue Adapter

- [ ] Week 13: `toVue()` basic implementation
- [ ] Week 14: `fromVue()` basic implementation
- [ ] Week 15: Provide/inject bridging + TypeScript types

### Phase 3 (Ongoing): Refinement

- [ ] Performance optimization
- [ ] Edge case fixes
- [ ] Documentation improvements
- [ ] Community feedback integration

---

## 18. Alternatives Considered

### Alternative A: Compile-Time Transpilation

**Approach**: Convert SemaJSX to React/Vue at build time (like Mitosis)

**Pros:**

- Zero runtime overhead
- Native performance

**Cons:**

- Loses runtime flexibility
- Complex build setup
- Harder to debug

**Decision**: ❌ Rejected - Contradicts "no-build" vision

---

### Alternative B: Web Components as Bridge

**Approach**: Convert SemaJSX to Web Components, use in all frameworks

**Pros:**

- Universal compatibility

**Cons:**

- Web Components overhead is high (3-5ms)
- Shadow DOM styling issues
- Limited interoperability

**Decision**: ❌ Rejected - Performance penalty too high

---

### Alternative C: Runtime Adapters (CHOSEN ✅)

**Approach**: Lightweight runtime wrappers that bridge frameworks

**Pros:**

- No build required
- Flexible and debuggable
- Can optimize incrementally

**Cons:**

- Small runtime overhead (<1ms)
- Need separate adapter for each framework

**Decision**: ✅ Accepted - Best balance of performance and flexibility

---

## 19. Appendix

### A. Reference Implementations

- **Preact Compat**: `/node_modules/preact/compat` - React compatibility layer
- **Vue React Wrapper**: https://github.com/devilwjp/veaury - Vue/React interop
- **@lit/react**: Lit Web Components in React

### B. Props Conversion Examples

**React → SemaJSX:**

```typescript
// React props
{
  className: 'btn btn-primary',
  onClick: (e: React.MouseEvent) => {},
  style: { color: 'red' },
  children: [<Icon />, 'Text']
}

// Converted to SemaJSX props
{
  class: 'btn btn-primary',
  onClick: (e: MouseEvent) => {},
  style: { color: 'red' },
  children: [<Icon />, 'Text']
}
```

**Vue → SemaJSX:**

```typescript
// Vue props + slots
{
  props: { primary: true },
  slots: {
    default: () => [VNode],
    icon: () => [VNode]
  },
  emit: (event, ...args) => {}
}

// Converted to SemaJSX props
{
  primary: true,
  children: [DOMNode], // from slots.default
  icon: [DOMNode],     // from slots.icon
  onEmit: (event, ...args) => emit(event, ...args)
}
```

### C. Performance Benchmarks

| Operation                 | Target   | Actual (TBD) |
| ------------------------- | -------- | ------------ |
| `toReact()` overhead      | <1ms     | -            |
| `fromReact()` overhead    | <1ms     | -            |
| `toVue()` overhead        | <1ms     | -            |
| `fromVue()` overhead      | <1ms     | -            |
| 4-level nesting           | <4ms     | -            |
| 1000 mount/unmount cycles | No leaks | -            |

---

**End of RFC**
