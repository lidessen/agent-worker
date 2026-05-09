---
"semajsx": minor
---

Add `semajsx preview` CLI — boot a Vite dev server and mount any
component's default (or sole named) export with zero config:

```bash
semajsx ./Component.tsx
```

See [design/rfcs/009-cli-preview.md](./design/rfcs/009-cli-preview.md)
for the full shape.

Also bumps most major dependencies across the monorepo (TypeScript 6
and `@typescript/native-preview` stay pinned pending a separate
ambient-type regression fix).
