# @semajsx/mermaid

Mermaid diagram rendering for SemaJSX — composable, themeable SVG components with signal-driven reactivity.

## Features

- **Flowcharts** — All directions (TD, LR, BT, RL), 12 node shapes, nested subgraphs
- **Sequence diagrams** — Participants, messages, self-messages, activations, control flow blocks, notes
- **Layout engine** — Sugiyama layered layout with barycenter ordering, bezier/polyline/orthogonal routing
- **Theming** — Light and dark themes with design tokens
- **Custom renderers** — Override any shape, edge, or annotation component
- **MDX integration** — Remark plugin transforms fenced code blocks into live diagrams
- **Reactive** — Pass signals for code or diagram IR to auto-update on change

## Quick Start

```tsx
/** @jsxImportSource @semajsx/dom */

import { render } from "@semajsx/dom";
import { Mermaid } from "@semajsx/mermaid";

render(
  <Mermaid
    code={`graph TD
      A[Start] --> B{Decision}
      B -->|Yes| C[OK]
      B -->|No| D[Cancel]`}
  />,
  document.getElementById("app"),
);
```

## MDX Usage

Add the remark plugin to render mermaid code blocks in markdown:

```ts
import { remarkMermaid } from "@semajsx/mermaid/remark";

// remarkPlugins: [remarkMermaid]
```

Use the `raw` meta flag to show code without rendering:

````md
```mermaid raw
graph TD
  A --> B
```
````

## Documentation

See the full [Mermaid reference](../../apps/docs/content/reference/mermaid.md) for syntax, theming, custom renderers, and layout options.
