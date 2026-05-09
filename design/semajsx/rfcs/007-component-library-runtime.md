# RFC: Component Library Runtime - No-Build Component Library Development Platform

**Date**: 2026-01-10
**Author**: SemaJSX Team
**Status**: Draft

---

## 1. Executive Summary

This RFC proposes positioning SemaJSX as a **no-build component library runtime** that solves the fundamental problem of tight coupling between UI component libraries and specific frameworks (React, Vue, etc.).

### Vision

Enable developers to build framework-agnostic component libraries with:

- **No build dependencies** at runtime
- **Signal-based lightweight state management**
- **Build-free styling system**
- **Framework wrappers** for React/Vue/etc. that enable **cross-framework nesting** (React → SemaJSX → React → ...)

This transforms component library development from framework-specific implementations to a unified runtime approach.

---

## 2. Problem Statement

### 2.1 Current Component Library Pain Points

**Tight Framework Coupling:**

- Material-UI locks you into React
- Element-UI locks you into Vue
- Each framework requires separate component implementations
- Cannot reuse components across framework boundaries

**Heavy Build Toolchains:**

- Component libraries require complex build setups (Webpack, Rollup, tsup)
- Breaking changes in build tools affect component stability
- Large dependency trees increase security risks
- Build-time errors reduce developer productivity

**Style System Fragmentation:**

- CSS-in-JS solutions are framework-specific (styled-components → React only)
- Traditional CSS has no tree-shaking
- Tailwind requires build-time processing
- Shadow DOM styling is poorly supported

**Cross-Framework Nesting Impossible:**

- Cannot nest React component inside Vue component
- Micro-frontends require iframe isolation
- Design system consistency across frameworks is hard

### 2.2 Market Opportunity

**Target Users:**

1. **Component Library Authors** - Want to write once, support all frameworks
2. **Design System Teams** - Need consistency across React/Vue/Angular apps
3. **Micro-Frontend Developers** - Need framework interoperability
4. **Enterprise Teams** - Want to reduce framework lock-in risks

**Success Metrics:**

- Component libraries adopt SemaJSX as runtime layer
- Framework wrappers enable cross-framework component usage
- No-build development becomes the preferred workflow
- Performance matches or exceeds framework-native components

---

## 3. Feasibility Analysis

### 3.1 Key Technical Goals

Let's evaluate each critical technical capability:

#### Goal 1: No-Build Runtime Execution ⭐⭐⭐⭐⭐ (Highly Feasible)

**Current State:**

- ✅ Signal system is pure JavaScript (~4KB)
- ✅ DOM rendering is pure JavaScript
- ✅ Packages ship as ESM modules (.mjs)
- ✅ Can be imported directly in browsers with `<script type="module">`

**Challenges:**

- ❌ JSX syntax requires compilation (not valid JavaScript)
- ❌ TypeScript requires compilation

**Solutions:**

```tsx
// Option A: Use h() directly (no JSX)
import { h } from "semajsx";
const Button = ({ children }) => h("button", { class: "btn" }, children);

// Option B: Runtime JSX compilation (development)
import { transform } from "@babel/standalone";
const code = transform(jsxSource, { presets: ["react"] }).code;

// Option C: Pre-compiled components (production)
// Ship compiled .mjs files alongside .tsx source
```

**Verdict:** ✅ **Feasible** - Multiple viable approaches exist

---

#### Goal 2: Signal-Based Lightweight State Management ⭐⭐⭐⭐⭐ (Production Ready)

**Current State:**

- ✅ `@semajsx/signal` is mature and production-ready
- ✅ Explicit dependency model: `computed([deps], fn)`
- ✅ Fine-grained reactivity (no VDOM)
- ✅ Minimal API surface (`.value`, `.subscribe()`)
- ✅ Performance: ~0.3ms updates, ~4KB bundle
- ✅ Preact Signals compatible

**Component State Example:**

```tsx
import { signal, computed } from "@semajsx/signal";

function Counter() {
  const count = signal(0);
  const doubled = computed([count], () => count.value * 2);

  return (
    <div>
      <p>Count: {count}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => count.value++}>Increment</button>
    </div>
  );
}
```

**Advantages over React/Vue:**

- No hooks complexity (no rules of hooks)
- No useCallback/useMemo needed (signals are stable references)
- Simpler mental model (direct assignment vs setState)
- Works outside components (global state is trivial)

**Verdict:** ✅ **Production Ready** - This is a core strength

---

#### Goal 3: Build-Free Styling System ⭐⭐⭐⭐☆ (Design Ready, Implementation Needed)

**Current State:**

- ✅ Comprehensive RFC 006 completed (2500+ lines)
- ✅ Design is solid and well-thought-out
- ❌ Not yet implemented (critical gap)

**Proposed API (from RFC 006):**

```tsx
// button.style.ts - No build required, pure TypeScript
import { classes, rule } from "@semajsx/style";

const c = classes(["root", "icon", "primary"]);

export const root = rule`${c.root} {
  display: inline-flex;
  padding: 8px 16px;
  border-radius: 6px;
}`;

export const primary = rule`${c.primary} {
  background: var(--primary);
  color: white;
}`;

// Usage in component
import * as btn from "./button.style";
<button class={[btn.root, btn.primary]}>Click</button>;
```

**Key Features:**

- ✅ Native CSS syntax (not CSS-in-JS objects)
- ✅ Tree-shakeable at module level
- ✅ Type-safe class names
- ✅ Shadow DOM support
- ✅ Signal-based reactive styles
- ✅ Zero runtime CSS parsing

**Framework Integration:**

```tsx
// React usage
import { useStyle } from '@semajsx/style/react';
function Button() {
  const cx = useStyle();
  return <button className={cx(btn.root, btn.primary)}>Click</button>;
}

// Vue usage
import { useStyle } from '@semajsx/style/vue';
const cx = useStyle();
<button :class="cx(btn.root, btn.primary)">Click</button>
```

**Implementation Effort:**

- Core runtime: ~2-3 weeks
- React integration: ~1 week
- Vue integration: ~1 week
- SSR support: ~1 week
- Total: **~6 weeks for MVP**

**Verdict:** ✅ **Feasible** - Design is complete, needs implementation

---

#### Goal 4: Framework Wrappers & Cross-Framework Nesting ⭐⭐⭐⭐☆ (Architecturally Feasible)

**Current State:**

- ❌ No existing framework wrappers
- ✅ Clean component model enables wrapping
- ✅ Signal system is framework-agnostic

**Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│  React App                                              │
│  ┌───────────────────────────────────────────────────┐ │
│  │ SemaJSX Wrapper (React)                           │ │
│  │  ┌─────────────────────────────────────────────┐ │ │
│  │  │ SemaJSX Component (Native)                  │ │ │
│  │  │  ┌───────────────────────────────────────┐  │ │ │
│  │  │  │ React Wrapper (SemaJSX)               │  │ │ │
│  │  │  │  ┌─────────────────────────────────┐  │  │ │ │
│  │  │  │  │ React Component (Native)        │  │  │ │ │
│  │  │  │  └─────────────────────────────────┘  │  │ │ │
│  │  │  └───────────────────────────────────────┘  │ │ │
│  │  └─────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Implementation Strategy:**

**A. SemaJSX → React Wrapper:**

```tsx
// @semajsx/adapter-react
import { createElement } from "react";
import { render as semaRender } from "@semajsx/dom";

export function toReact(SemaComponent) {
  return function ReactWrapper(props) {
    const containerRef = useRef(null);

    useEffect(() => {
      if (containerRef.current) {
        // Render SemaJSX component into container
        semaRender(<SemaComponent {...props} />, containerRef.current);
      }
    }, [props]);

    return createElement("div", { ref: containerRef });
  };
}

// Usage
import { Button } from "@my-library/semajsx";
import { toReact } from "@semajsx/adapter-react";

const ReactButton = toReact(Button);
<ReactButton onClick={handleClick}>Click me</ReactButton>;
```

**B. React → SemaJSX Wrapper:**

```tsx
// @semajsx/adapter-react
import { createPortal } from "react-dom";

export function fromReact(ReactComponent) {
  return function SemaWrapper(props, ctx) {
    const container = document.createElement("div");

    // Mount React component
    const root = createRoot(container);
    root.render(<ReactComponent {...props} />);

    // Cleanup on unmount
    ctx.onCleanup(() => root.unmount());

    return container;
  };
}
```

**C. Vue Adapters:**

```tsx
// @semajsx/adapter-vue
export function toVue(SemaComponent) {
  /* ... */
}
export function fromVue(VueComponent) {
  /* ... */
}
```

**Challenges:**

1. **Props mapping** - Different frameworks have different prop conventions
2. **Event handling** - React uses camelCase (onClick), Vue uses kebab-case (@click)
3. **Lifecycle sync** - Coordinate mounting/unmounting across boundaries
4. **Performance** - Extra wrapper overhead

**Solutions:**

- Props normalization layer
- Event name mapping table
- Shared lifecycle coordination via context
- Lazy mounting (only render when visible)

**Implementation Effort:**

- React adapters: ~2 weeks
- Vue adapters: ~2 weeks
- Testing & debugging: ~2 weeks
- Total: **~6 weeks**

**Verdict:** ✅ **Feasible** - Technical path is clear, needs careful implementation

---

#### Goal 5: Component Library Development Experience ⭐⭐⭐⭐☆ (Good Foundation)

**Current State:**

- ✅ TypeScript-first architecture
- ✅ JSX as primary API
- ✅ Context API for dependency injection
- ✅ Ref support for element references
- ✅ Portal support for teleportation
- ✅ SSR & hydration support
- ⚠️ No component dev tooling (Storybook, etc.)

**Developer Workflow:**

```tsx
// 1. Define component with signals
// components/Button.tsx
import { signal } from '@semajsx/signal';
import * as btn from './Button.style';

export function Button({ children, onClick }) {
  const isPressed = signal(false);

  return (
    <button
      class={[btn.root, isPressed.value && btn.pressed]}
      onClick={(e) => {
        isPressed.value = true;
        onClick?.(e);
        setTimeout(() => isPressed.value = false, 200);
      }}
    >
      {children}
    </button>
  );
}

// 2. Define styles (no build)
// components/Button.style.ts
import { classes, rule } from '@semajsx/style';

const c = classes(['root', 'pressed']);

export const root = rule`${c.root} {
  padding: 8px 16px;
  transition: transform 0.2s;
}`;

export const pressed = rule`${c.pressed} {
  transform: scale(0.95);
}`;

// 3. Export for all frameworks
// components/index.ts
export { Button } from './Button';

// 4. Publish as package
// package.json
{
  "name": "@my-library/components",
  "type": "module",
  "exports": {
    ".": "./dist/index.mjs",
    "./react": "./dist/react.mjs",  // Auto-wrapped
    "./vue": "./dist/vue.mjs"        // Auto-wrapped
  }
}
```

**What's Missing:**

- Component documentation generator
- Visual testing tool (like Storybook)
- Accessibility testing helpers
- Component playground

**Verdict:** ✅ **Good Foundation** - Core is solid, tooling can be added incrementally

---

### 3.2 Feasibility Summary

| Technical Goal          | Feasibility | Status         | Effort    | Priority |
| ----------------------- | ----------- | -------------- | --------- | -------- |
| No-Build Runtime        | ⭐⭐⭐⭐⭐  | ✅ Ready       | 0 weeks   | P0       |
| Signal State Management | ⭐⭐⭐⭐⭐  | ✅ Ready       | 0 weeks   | P0       |
| Build-Free Styling      | ⭐⭐⭐⭐☆   | 📝 Design done | 6 weeks   | P0       |
| Framework Adapters      | ⭐⭐⭐⭐☆   | ❌ Not started | 6 weeks   | P1       |
| Dev Tooling             | ⭐⭐⭐☆☆    | ⚠️ Partial     | 12+ weeks | P2       |

**Overall Feasibility:** ✅ **Highly Feasible**

The core technical goals (no-build, signals, styling) are either ready or have clear implementation paths. Framework adapters are architecturally sound. The biggest gap is the style system implementation, which has a complete RFC and ~6 week effort estimate.

---

## 4. Competitive Analysis

### 4.1 Existing Solutions

| Solution           | Approach              | Pros                       | Cons                                | Differentiation                   |
| ------------------ | --------------------- | -------------------------- | ----------------------------------- | --------------------------------- |
| **Web Components** | Browser standard      | Native, framework-agnostic | Heavy, slow, styling issues         | SemaJSX is lighter, better DX     |
| **Mitosis**        | Compile to frameworks | Targets many frameworks    | Build-time only, limited reactivity | SemaJSX is runtime-first          |
| **Stencil**        | Compiler to WC        | Mature tooling             | Requires build, WC overhead         | SemaJSX has no build requirement  |
| **Lit**            | Lightweight WC        | Small, efficient           | Still WC limitations                | SemaJSX uses fine-grained signals |
| **Preact Signals** | Signal library        | Great reactivity           | Just signals, no components         | SemaJSX is full component system  |
| **Qwik**           | Resumability          | Great performance          | Requires build, learning curve      | SemaJSX is simpler, no build      |

### 4.2 Unique Value Proposition

**SemaJSX's Differentiation:**

1. **True No-Build Runtime**
   - Unlike Mitosis/Stencil (compile-time)
   - Unlike Web Components (still need tooling for DX)
   - Ship .mjs files directly to browsers

2. **Signal-First Architecture**
   - Unlike React (hooks are complex)
   - Unlike Vue (ref() is less elegant)
   - Simple, direct, performant

3. **Build-Free Styling**
   - Unlike CSS Modules (requires build)
   - Unlike Tailwind (requires PostCSS)
   - Unlike CSS-in-JS (framework-specific)
   - Native CSS syntax with tree-shaking

4. **Framework Adapters**
   - Unlike Web Components (limited integration)
   - Unlike Lit (doesn't integrate with React/Vue)
   - True cross-framework nesting

**Positioning Statement:**

> "SemaJSX is the first no-build component library runtime that enables framework-agnostic component development with signal-based reactivity and build-free styling. Write components once in SemaJSX, use them in React, Vue, or any framework."

---

## 5. Roadmap

### 5.1 Phase 1: Foundation (Q1 2026 - 12 weeks)

**Goal:** Establish SemaJSX as a viable component library runtime

**Deliverables:**

1. **Style System Implementation (Weeks 1-6)**
   - [ ] Implement `@semajsx/style` core package
   - [ ] `classes()`, `rule()`, `rules()` APIs
   - [ ] StyleRegistry and injection deduplication
   - [ ] Signal-based reactive styles
   - [ ] Shadow DOM support
   - [ ] Write comprehensive tests
   - [ ] Write documentation and examples

2. **Framework Adapter - React (Weeks 7-9)**
   - [ ] Implement `@semajsx/adapter-react`
   - [ ] `toReact()` - Wrap SemaJSX components for React
   - [ ] `fromReact()` - Use React components in SemaJSX
   - [ ] Props normalization
   - [ ] Event handling
   - [ ] Lifecycle coordination
   - [ ] Integration tests

3. **Style System - React Integration (Weeks 7-9)**
   - [ ] Implement `@semajsx/style/react`
   - [ ] `<StyleAnchor>` component
   - [ ] `useStyle()` hook
   - [ ] `useSignal()` hook for reactive styles
   - [ ] SSR support basics

4. **First Component Library Example (Weeks 10-12)**
   - [ ] Create `@semajsx/ui` as reference implementation
   - [ ] 5-10 foundational components:
     - Button (variants, sizes, disabled)
     - Card (header, body, footer)
     - Input (text, password, validation)
     - Select (dropdown, multi-select)
     - Modal (overlay, focus trap)
   - [ ] Full TypeScript types
   - [ ] Comprehensive examples
   - [ ] React wrapper package

**Success Metrics:**

- Style system passes all tests from RFC 006
- React adapter enables bi-directional nesting
- Example component library works in React apps
- Bundle size ≤ 15KB for runtime (gzip)
- Performance: <16ms for component updates

---

### 5.2 Phase 2: Expansion (Q2 2026 - 12 weeks)

**Goal:** Expand framework support and component library

**Deliverables:**

1. **Framework Adapter - Vue (Weeks 13-15)**
   - [ ] Implement `@semajsx/adapter-vue`
   - [ ] `toVue()` and `fromVue()` adapters
   - [ ] Composition API integration
   - [ ] Props and events mapping

2. **Style System - Vue Integration (Weeks 13-15)**
   - [ ] Implement `@semajsx/style/vue`
   - [ ] `<StyleAnchor>` component (Vue)
   - [ ] `useStyle()` composable
   - [ ] `useSignal()` composable

3. **Component Library Expansion (Weeks 16-20)**
   - [ ] Add 10-15 more components:
     - Tabs
     - Accordion
     - Tooltip
     - Popover
     - Toast/Notifications
     - Badge
     - Avatar
     - Checkbox
     - Radio
     - Switch
     - Slider
     - Progress
     - Spinner
     - Alert
     - Breadcrumb

4. **Developer Experience (Weeks 21-24)**
   - [ ] Component documentation generator
   - [ ] Interactive playground (iframe-based)
   - [ ] Accessibility testing helpers
   - [ ] Performance profiling tools

**Success Metrics:**

- Vue adapter works as well as React adapter
- Component library has 25+ production-ready components
- Documentation covers all components
- Accessibility score ≥90% (Lighthouse)

---

### 5.3 Phase 3: Ecosystem (Q3 2026 - 12 weeks)

**Goal:** Build ecosystem and community adoption

**Deliverables:**

1. **Tailwind Integration (Weeks 25-28)**
   - [ ] Implement `@semajsx/tailwind` package
   - [ ] Generate utility tokens from Tailwind config
   - [ ] Type-safe utility classes
   - [ ] Arbitrary value support
   - [ ] Documentation and examples

2. **Advanced Styling Features (Weeks 29-32)**
   - [ ] Theme system (CSS custom properties)
   - [ ] Design tokens package
   - [ ] Animation utilities
   - [ ] Responsive design helpers
   - [ ] Dark mode support

3. **SSR & Meta-Frameworks (Weeks 33-36)**
   - [ ] `@semajsx/style/server` SSR support
   - [ ] Style collection and hydration
   - [ ] Next.js integration guide
   - [ ] Remix integration guide
   - [ ] Nuxt integration guide

4. **Documentation Site (Weeks 25-36)**
   - [ ] Build with SemaJSX SSR
   - [ ] Component API docs
   - [ ] Interactive examples
   - [ ] Migration guides
   - [ ] Blog for announcements

**Success Metrics:**

- Tailwind integration matches native DX
- SSR works with all major meta-frameworks
- Documentation site has 100+ examples
- First external component library adopts SemaJSX

---

### 5.4 Phase 4: Production Readiness (Q4 2026 - 12 weeks)

**Goal:** Reach production stability and enterprise adoption

**Deliverables:**

1. **Performance Optimization (Weeks 37-40)**
   - [ ] Bundle size optimization (target: <10KB gzip)
   - [ ] Rendering performance benchmarks
   - [ ] Memory leak detection and fixes
   - [ ] Lazy loading optimizations

2. **Tooling & DX (Weeks 41-44)**
   - [ ] VSCode extension for style system
   - [ ] ESLint plugin for best practices
   - [ ] Vite plugin for style transformation
   - [ ] CLI for component scaffolding

3. **Testing & Quality (Weeks 45-48)**
   - [ ] Comprehensive test coverage (>90%)
   - [ ] Visual regression testing
   - [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
   - [ ] Mobile browser testing
   - [ ] Accessibility audit (WCAG 2.1 AA)

4. **Enterprise Features (Weeks 45-48)**
   - [ ] Security audit
   - [ ] Long-term support (LTS) plan
   - [ ] Migration tooling from other libraries
   - [ ] Enterprise support options

**Success Metrics:**

- Bundle size <10KB (gzip)
- Test coverage >90%
- All browsers supported
- WCAG 2.1 AA compliance
- First enterprise customer

---

## 6. Phase 1 Detailed Plan (First 12 Weeks)

### 6.1 Week-by-Week Breakdown

**Weeks 1-2: Style System Core**

- Implement `classes()`, `ClassRef` type
- Implement `rule()` tagged template parsing
- Implement `rules()` combinator
- StyleToken type and toString()
- Unit tests for all APIs

**Weeks 3-4: Style System Injection**

- StyleRegistry class
- CSS injection to DOM/Shadow DOM
- Deduplication logic
- WeakMap for tracking
- Cleanup and memory management

**Weeks 5-6: Style System Reactivity**

- Signal detection in templates
- CSS variable generation
- Signal subscription setup
- Dynamic style updates
- Integration tests with signals

**Weeks 7-8: React Adapter**

- toReact() wrapper implementation
- fromReact() wrapper implementation
- Props normalization
- Event handling
- Lifecycle management
- Basic tests

**Week 9: React Style Integration**

- StyleAnchor component
- useStyle() hook
- useSignal() hook
- cx() helper function
- Integration tests

**Weeks 10-11: Example Component Library**

- Set up @semajsx/ui package
- Implement 5 core components
- TypeScript types
- Documentation for each component
- React wrappers

**Week 12: Documentation & Polish**

- Write getting started guide
- Write migration guide
- Write API reference
- Create example applications
- Performance benchmarking

### 6.2 Success Criteria for Phase 1

**Functional Requirements:**

- [ ] All style system APIs from RFC 006 are implemented
- [ ] React adapters enable bi-directional component nesting
- [ ] Example component library has 5+ production-quality components
- [ ] Components work in pure SemaJSX and React

**Performance Requirements:**

- [ ] Runtime bundle size ≤ 15KB (gzip)
- [ ] Style injection overhead <2ms per component
- [ ] Component render time <5ms (on modern hardware)
- [ ] No memory leaks after 1000 mount/unmount cycles

**Quality Requirements:**

- [ ] Test coverage ≥ 80%
- [ ] TypeScript strict mode passes
- [ ] All examples run without errors
- [ ] Documentation covers all public APIs

**Developer Experience:**

- [ ] Getting started guide is <5 minutes
- [ ] Component creation is intuitive
- [ ] Error messages are helpful
- [ ] VSCode autocomplete works well

---

## 7. Technical Architecture

### 7.1 Package Structure

```
semajsx/
├── packages/
│   ├── signal/              # Already exists ✅
│   ├── core/                # Already exists ✅
│   ├── dom/                 # Already exists ✅
│   │
│   ├── style/               # NEW - Phase 1 ⭐
│   │   ├── src/
│   │   │   ├── classes.ts
│   │   │   ├── rule.ts
│   │   │   ├── registry.ts
│   │   │   ├── inject.ts
│   │   │   └── index.ts
│   │   └── react/           # React integration
│   │       ├── StyleAnchor.tsx
│   │       ├── useStyle.ts
│   │       └── useSignal.ts
│   │
│   ├── adapter-react/       # NEW - Phase 1 ⭐
│   │   ├── src/
│   │   │   ├── toReact.tsx
│   │   │   ├── fromReact.tsx
│   │   │   └── index.ts
│   │   └── README.md
│   │
│   ├── adapter-vue/         # NEW - Phase 2
│   │   └── src/
│   │       ├── toVue.ts
│   │       ├── fromVue.ts
│   │       └── index.ts
│   │
│   ├── ui/                  # NEW - Phase 1 ⭐
│   │   ├── src/
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Button.style.ts
│   │   │   │   └── Button.test.tsx
│   │   │   ├── Card/
│   │   │   ├── Input/
│   │   │   └── index.ts
│   │   └── react/           # React-wrapped exports
│   │       └── index.ts
│   │
│   └── tailwind/            # NEW - Phase 3
│       └── src/
│           ├── spacing.ts
│           ├── colors.ts
│           └── index.ts
```

### 7.2 Component Library Package Layout

```typescript
// @semajsx/ui package structure
{
  "name": "@semajsx/ui",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    // Native SemaJSX components
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.mjs"
    },
    // React-wrapped components
    "./react": {
      "types": "./dist/react.d.ts",
      "default": "./dist/react.mjs"
    },
    // Vue-wrapped components (Phase 2)
    "./vue": {
      "types": "./dist/vue.d.ts",
      "default": "./dist/vue.mjs"
    },
    // Individual components (for tree-shaking)
    "./Button": "./dist/Button.mjs",
    "./Card": "./dist/Card.mjs"
  },
  "peerDependencies": {
    "@semajsx/signal": "^0.1.0",
    "@semajsx/dom": "^0.1.0",
    "@semajsx/style": "^0.1.0"
  }
}
```

### 7.3 Usage Examples

**A. Pure SemaJSX (No Framework):**

```tsx
import { render } from "@semajsx/dom";
import { Button } from "@semajsx/ui";

render(
  <Button primary onClick={() => alert("Clicked!")}>
    Click Me
  </Button>,
  document.getElementById("app"),
);
```

**B. SemaJSX Components in React:**

```tsx
import { Button } from "@semajsx/ui/react";

function App() {
  return (
    <div>
      <h1>My React App</h1>
      <Button primary onClick={() => console.log("Clicked")}>
        SemaJSX Button in React
      </Button>
    </div>
  );
}
```

**C. React Components in SemaJSX:**

```tsx
import { render } from "@semajsx/dom";
import { fromReact } from "@semajsx/adapter-react";
import ReactDatePicker from "react-datepicker";

const DatePicker = fromReact(ReactDatePicker);

render(
  <div>
    <DatePicker selected={date} onChange={setDate} />
  </div>,
  document.getElementById("app"),
);
```

**D. Cross-Framework Nesting:**

```tsx
import { render } from "@semajsx/dom";
import { Button as SemaButton } from "@semajsx/ui";
import { fromReact } from "@semajsx/adapter-react";
import ReactComplexChart from "react-chartjs-2";

const Chart = fromReact(ReactComplexChart);

render(
  <div>
    <SemaButton primary>Native SemaJSX Button</SemaButton>

    <Chart data={chartData} />

    <SemaButton onClick={() => console.log("Refresh")}>Refresh Chart</SemaButton>
  </div>,
  document.getElementById("app"),
);
```

---

## 8. Risks and Mitigation

### 8.1 Technical Risks

| Risk                        | Probability | Impact | Mitigation                             |
| --------------------------- | ----------- | ------ | -------------------------------------- |
| **Style system complexity** | Medium      | High   | RFC is detailed; follow spec closely   |
| **Framework adapter bugs**  | High        | High   | Extensive testing; incremental rollout |
| **Performance issues**      | Medium      | High   | Early benchmarking; profiling tools    |
| **Memory leaks**            | Medium      | Medium | WeakMap usage; cleanup protocol        |
| **Browser compatibility**   | Low         | High   | Polyfills; transpilation; CI testing   |
| **Bundle size creep**       | Medium      | Medium | Size budgets; regular audits           |

### 8.2 Market Risks

| Risk                             | Probability | Impact | Mitigation                               |
| -------------------------------- | ----------- | ------ | ---------------------------------------- |
| **Low adoption**                 | Medium      | High   | Focus on DX; showcase benefits; examples |
| **Web Components evolve**        | Low         | Medium | Monitor standards; adapt if needed       |
| **Framework lock-in preference** | Medium      | Medium | Educate on vendor risk; show flexibility |
| **Competition (Lit, Stencil)**   | Medium      | Medium | Emphasize no-build + signals advantages  |

### 8.3 Resource Risks

| Risk                            | Probability | Impact | Mitigation                                  |
| ------------------------------- | ----------- | ------ | ------------------------------------------- |
| **Insufficient developer time** | Medium      | High   | Prioritize Phase 1; defer Phase 4 if needed |
| **Knowledge gaps**              | Low         | Medium | RFC study; prototyping; ask for help        |
| **Burnout**                     | Medium      | Medium | Realistic timeline; breaks; scope cuts      |

---

## 9. Open Questions

- [ ] **Q1: JSX Compilation Strategy**
  - Should we ship pre-compiled .mjs files alongside .tsx source?
  - Should we provide a runtime JSX transformer for development?
  - Should we require users to set up their own build for JSX?

- [ ] **Q2: TypeScript Handling**
  - Ship .mjs + .d.ts files?
  - Require users to set up TypeScript compilation?
  - Provide a dev server with on-the-fly TS compilation?

- [ ] **Q3: Style System Build Optimization**
  - Is runtime-only styling sufficient?
  - Should we provide a Vite plugin for compile-time optimization?
  - Priority: Runtime-first, build optimization later

- [ ] **Q4: Component Library Scope**
  - How many components should @semajsx/ui include?
  - Should we target headless components (like Radix UI)?
  - Should we provide styled components (like Material-UI)?

- [ ] **Q5: Framework Adapter API**
  - Should adapters be automatic or explicit?
  - Should we auto-detect framework context?
  - Should users manually wrap components?

- [ ] **Q6: Long-term Maintenance**
  - Who will maintain the framework adapters?
  - How to handle breaking changes in React/Vue?
  - Should we create a sustainability plan?

---

## 10. Success Metrics

### 10.1 Phase 1 Goals (12 weeks)

**Technical Metrics:**

- [ ] Style system: 100% of RFC 006 features implemented
- [ ] React adapter: bi-directional nesting works
- [ ] Bundle size: ≤15KB (runtime + style system, gzip)
- [ ] Test coverage: ≥80%

**Product Metrics:**

- [ ] Component library: 5+ production-ready components
- [ ] Documentation: Complete getting started guide
- [ ] Examples: 10+ working examples
- [ ] Performance: <16ms component updates

**Adoption Metrics:**

- [ ] 1+ external team piloting SemaJSX
- [ ] 100+ GitHub stars
- [ ] 50+ weekly npm downloads
- [ ] 5+ community contributions

### 10.2 Long-term Goals (1 year)

**Ecosystem Metrics:**

- [ ] 3+ component libraries built with SemaJSX
- [ ] 100+ production applications using SemaJSX
- [ ] 1000+ GitHub stars
- [ ] 10,000+ weekly npm downloads

**Quality Metrics:**

- [ ] Test coverage ≥90%
- [ ] Zero critical security issues
- [ ] WCAG 2.1 AA compliance
- [ ] All major browsers supported

**Community Metrics:**

- [ ] 50+ contributors
- [ ] Active Discord/Slack community
- [ ] Regular blog posts and tutorials
- [ ] Conference talks about SemaJSX

---

## 11. Alternatives Considered

### Alternative A: Focus on Web Components

**Approach:** Position SemaJSX as a Web Components framework

**Pros:**

- Browser standard
- Native framework interoperability

**Cons:**

- Web Components are slow and heavy
- Shadow DOM styling is painful
- Limited adoption in enterprise

**Decision:** ❌ Rejected - Web Components have fundamental limitations

---

### Alternative B: Compile-Time Only (like Mitosis)

**Approach:** Compile SemaJSX to React/Vue at build time

**Pros:**

- No runtime overhead
- Native framework performance

**Cons:**

- Loses no-build advantage
- More complex toolchain
- Debugging is harder (source maps)

**Decision:** ❌ Rejected - Contradicts no-build vision

---

### Alternative C: React-Only with Signals

**Approach:** Just add signals to React (like Preact Signals)

**Pros:**

- Simpler scope
- Leverage React ecosystem

**Cons:**

- Doesn't solve framework lock-in
- React team may resist signals
- Misses broader opportunity

**Decision:** ❌ Rejected - Too narrow scope

---

### Alternative D: Runtime-First with Optional Build (CHOSEN ✅)

**Approach:** Ship runtime that works without build, with optional optimizations

**Pros:**

- Works immediately (import from CDN)
- Progressive enhancement
- Flexibility for users

**Cons:**

- JSX requires some solution
- TypeScript requires some solution

**Decision:** ✅ Accepted - Best balance of DX and vision

**Solution:**

- Ship pre-compiled .mjs files for production
- Provide optional dev server for development
- Users can bring their own build tool if they want

---

## 12. Conclusion

### 12.1 Recommendation

**Proceed with Phase 1 implementation.**

The technical feasibility analysis shows that:

1. ✅ Core capabilities (signals, rendering) are production-ready
2. ✅ Style system has complete design (RFC 006)
3. ✅ Framework adapters are architecturally sound
4. ⚠️ Critical gap: Style system needs implementation (~6 weeks)

The market opportunity is significant:

- Component libraries are frustrated with framework lock-in
- No-build development is increasingly desired
- Signal-based reactivity is gaining traction

SemaJSX is uniquely positioned to become the **de facto runtime for framework-agnostic component libraries**.

### 12.2 Immediate Next Steps

1. **Accept this RFC** and move to design phase
2. **Create detailed design doc** for style system implementation
3. **Start Phase 1, Week 1** - Begin style system core implementation
4. **Set up project tracking** - GitHub project board for 12-week plan
5. **Community announcement** - Share vision and roadmap

### 12.3 Decision Required

**Should we commit to positioning SemaJSX as a component library runtime?**

- ✅ **Yes** - Full commitment to Phase 1 (12 weeks)
- ⚠️ **Pilot** - Build style system only, defer framework adapters
- ❌ **No** - Continue as general-purpose JSX runtime

**Recommended:** ✅ **Yes** - The vision is achievable and the opportunity is real.

---

## 13. Appendix

### A. Bundle Size Estimates

| Package                    | Size (gzip) | Notes                  |
| -------------------------- | ----------- | ---------------------- |
| @semajsx/signal            | 4KB         | Already exists ✅      |
| @semajsx/core              | 3KB         | Already exists ✅      |
| @semajsx/dom               | 6KB         | Already exists ✅      |
| @semajsx/style             | 5KB         | Estimated from RFC     |
| @semajsx/adapter-react     | 3KB         | Estimated              |
| **Total Runtime**          | **15KB**    | **Target for Phase 1** |
| @semajsx/ui (5 components) | 8KB         | Estimated              |
| **App Bundle**             | **23KB**    | Runtime + components   |

### B. Performance Benchmarks

| Operation        | Target | Comparison            |
| ---------------- | ------ | --------------------- |
| Signal update    | <0.5ms | Preact Signals: 0.3ms |
| Component render | <5ms   | React: 8-12ms         |
| Style injection  | <2ms   | CSS Modules: 1ms      |
| Adapter overhead | <1ms   | Web Components: 3-5ms |

### C. Reference Links

- RFC 006: Style System - `/design/rfcs/006-style-system.md`
- SemaJSX Signal Docs - `/packages/signal/README.md`
- Component Architecture - `/design/designs/`
- Testing Guide - `/TESTING.md`

---

**End of RFC**
