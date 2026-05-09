# SemaJSX Monorepo Architecture

## Overview

This document describes the monorepo structure for SemaJSX, a signal-based reactive JSX runtime. The project uses a monorepo architecture powered by Bun workspaces for efficient build orchestration.

## Directory Structure

```
semajsx/
├── apps/
│   └── docs/                        # Documentation site
│       ├── package.json
│       ├── src/
│       └── tsconfig.json
│
├── packages/
│   ├── semajsx/                     # Main package (umbrella package)
│   │   ├── package.json             # name: "semajsx"
│   │   ├── src/
│   │   │   ├── index.ts             # Re-exports from all packages
│   │   │   ├── jsx-runtime.ts
│   │   │   └── jsx-dev-runtime.ts
│   │   ├── tests/                   # Integration tests
│   │   ├── examples/                # Examples using semajsx
│   │   └── tsconfig.json
│   │
│   ├── core/                        # Runtime core (VNode, helpers)
│   │   ├── package.json             # name: "@semajsx/core"
│   │   ├── src/
│   │   │   ├── vnode.ts
│   │   │   ├── helpers.ts
│   │   │   ├── context.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit tests for core
│   │   └── tsconfig.json
│   │
│   ├── signal/                      # Signal reactivity system
│   │   ├── package.json             # name: "@semajsx/signal"
│   │   ├── src/
│   │   │   ├── signal.ts
│   │   │   ├── computed.ts
│   │   │   ├── batch.ts
│   │   │   ├── utils.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit tests for signal
│   │   └── tsconfig.json
│   │
│   ├── dom/                         # DOM rendering
│   │   ├── package.json             # name: "@semajsx/dom"
│   │   ├── src/
│   │   │   ├── operations.ts
│   │   │   ├── properties.ts
│   │   │   ├── render.ts
│   │   │   ├── jsx-runtime.ts
│   │   │   ├── jsx-dev-runtime.ts
│   │   │   ├── ref.ts
│   │   │   ├── portal.ts
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit tests for DOM
│   │   ├── examples/                # DOM-specific examples
│   │   └── tsconfig.json
│   │
│   ├── terminal/                    # Terminal rendering
│   │   ├── package.json             # name: "@semajsx/terminal"
│   │   ├── src/
│   │   │   ├── operations.ts
│   │   │   ├── properties.ts
│   │   │   ├── render.ts
│   │   │   ├── renderer.ts
│   │   │   ├── jsx-runtime.ts
│   │   │   ├── jsx-dev-runtime.ts
│   │   │   ├── components/
│   │   │   ├── utils/
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit tests for terminal
│   │   ├── examples/                # Terminal-specific examples
│   │   └── tsconfig.json
│   │
│   ├── ssr/                         # SSR and Island architecture
│   │   ├── package.json             # name: "@semajsx/ssr"
│   │   ├── src/
│   │   │   ├── island.ts
│   │   │   ├── island-noop.ts
│   │   │   ├── render.ts
│   │   │   ├── collector.ts
│   │   │   ├── vite-builder.ts
│   │   │   ├── vite-router.ts
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit tests for SSR
│   │   ├── examples/                # SSR examples
│   │   └── tsconfig.json
│   │
│   ├── ssg/                         # Static site generation
│   │   ├── package.json             # name: "@semajsx/ssg"
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── examples/                # SSG examples
│   │   └── tsconfig.json
│   │
│   ├── style/                       # Modular styling system
│   │   ├── package.json             # name: "@semajsx/style"
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── tsconfig.json
│   │
│   ├── logger/                      # Logging utility
│   │   ├── package.json             # name: "@semajsx/logger"
│   │   ├── src/
│   │   │   ├── logger.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit tests for logger
│   │   ├── examples/                # Logger examples
│   │   └── tsconfig.json
│   │
│   ├── utils/                       # Shared utilities
│   │   ├── package.json             # name: "@semajsx/utils"
│   │   ├── src/
│   │   │   ├── array.ts
│   │   │   ├── object.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── tests/                   # Unit tests for utils
│   │   └── tsconfig.json
│   │
│   └── configs/                     # Shared TypeScript configurations (internal)
│       ├── package.json             # name: "@semajsx/configs", private: true
│       ├── tsconfig.base.json       # Base TypeScript config
│       ├── tsconfig.lib.json        # Library package config
│       ├── tsconfig.app.json        # Application config
│       └── README.md
│
├── .github/                         # GitHub workflows and configs
├── .husky/                          # Git hooks
├── scripts/                         # Build and utility scripts
│
├── package.json                     # Root package.json with workspaces
├── tsconfig.json                    # Root TypeScript config
├── oxlint.json                      # OxLint configuration
├── oxfmt.json                       # OxFmt configuration
├── .lintstagedrc.json              # Lint-staged configuration
├── commitlint.config.js            # Commitlint configuration
└── README.md                        # Root README
```

## Package Dependencies

### Dependency Graph

```
semajsx (main package)
├── @semajsx/core
│   ├── @semajsx/signal
│   └── @semajsx/utils
├── @semajsx/signal
│   └── @semajsx/utils
├── @semajsx/dom
│   ├── @semajsx/core
│   ├── @semajsx/signal
│   └── @semajsx/utils
├── @semajsx/terminal
│   ├── @semajsx/core
│   ├── @semajsx/signal
│   └── @semajsx/utils
├── @semajsx/ssr
│   ├── @semajsx/core
│   ├── @semajsx/signal
│   ├── @semajsx/dom
│   └── @semajsx/utils
├── @semajsx/ssg
│   ├── @semajsx/core
│   └── @semajsx/utils
├── @semajsx/style
│   ├── @semajsx/signal
│   └── @semajsx/utils
└── @semajsx/logger
    └── @semajsx/utils

Internal:
└── @semajsx/configs (used by all packages via tsconfig extends)
```

### Package Details

#### `semajsx` (Main Package)

- **Description**: Umbrella package that re-exports all sub-packages
- **Exports**: All features from signal, dom, terminal, server, client
- **Purpose**: Single entry point for users who want all features
- **Type**: Published package

#### `@semajsx/core`

- **Description**: Runtime core with VNode and helpers
- **Exports**: `vnode`, `helpers`, `context`, types
- **Dependencies**: `@semajsx/signal`, `@semajsx/utils`
- **Type**: Published package

#### `@semajsx/signal`

- **Description**: Signal reactivity system
- **Exports**: `signal`, `computed`, `batch`, `effect`, utility functions
- **Dependencies**: `@semajsx/utils`
- **Type**: Published package

#### `@semajsx/dom`

- **Description**: DOM rendering engine
- **Exports**: `render`, `jsx-runtime`, DOM utilities
- **Dependencies**: `@semajsx/core`, `@semajsx/signal`, `@semajsx/utils`
- **Type**: Published package

#### `@semajsx/terminal`

- **Description**: Terminal rendering with Ink-like API
- **Exports**: `render`, `jsx-runtime`, terminal components
- **Dependencies**: `@semajsx/core`, `@semajsx/signal`, `@semajsx/utils`, `yoga-layout-prebuilt`, `chalk`, etc.
- **Type**: Published package

#### `@semajsx/ssr`

- **Description**: SSR and Island architecture
- **Exports**: `island`, `renderToString`, `createViteRouter`
- **Dependencies**: `@semajsx/core`, `@semajsx/signal`, `@semajsx/dom`, `@semajsx/utils`, `vite`
- **Type**: Published package

#### `@semajsx/ssg`

- **Description**: Static site generation with collections and MDX support
- **Exports**: `defineCollection`, `getCollection`, MDX utilities
- **Dependencies**: `@semajsx/core`, `@semajsx/utils`
- **Type**: Published package

#### `@semajsx/style`

- **Description**: Modular styling system with tree-shakeable CSS
- **Exports**: `css`, `styled`, style utilities
- **Dependencies**: `@semajsx/signal`, `@semajsx/utils`
- **Type**: Published package

#### `@semajsx/logger`

- **Description**: Logging utility for terminal and server
- **Exports**: `createLogger`, logger instances
- **Dependencies**: `@semajsx/utils`, `chalk`
- **Type**: Published package

#### `@semajsx/utils`

- **Description**: Shared utility functions
- **Exports**: Common utilities used across packages
- **Dependencies**: None (base package)
- **Type**: Published package

#### `@semajsx/configs`

- **Description**: Shared TypeScript configurations
- **Exports**: TypeScript config files
- **Purpose**: DRY configuration management
- **Type**: Internal package (not published)

## Migration Strategy

### Phase 1: Foundation (Current)

1. **Setup root monorepo configuration**
   - Configure Bun workspaces in `package.json`
   - Update root `package.json` with workspace configuration
   - Move lint configs to root

2. **Create `packages/configs`**
   - Create shared TypeScript configurations
   - `tsconfig.base.json` - Base config
   - `tsconfig.lib.json` - Library packages
   - `tsconfig.app.json` - Application packages

3. **Move existing code to `packages/semajsx`**
   - Copy entire current `src/` to `packages/semajsx/src/`
   - Copy `tests/` to `packages/semajsx/tests/`
   - Copy `examples/` to `packages/semajsx/examples/`
   - Update `package.json` to use `@semajsx/configs`

4. **Create `apps/docs` structure**
   - Basic directory and package.json
   - Placeholder for future documentation site

### Phase 2: Package Extraction (Future)

Each package will be extracted one by one:

1. **Extract `@semajsx/signal`**
   - Move `src/signal/` to `packages/signal/src/`
   - Move related tests
   - Update imports in `packages/semajsx`

2. **Extract `@semajsx/utils`**
   - Move shared utilities
   - Update imports

3. **Extract `@semajsx/core`**
   - Move `src/runtime/` to `packages/core/src/`
   - Move related tests
   - Update imports

4. **Extract `@semajsx/dom`**
   - Move `src/dom/` to `packages/dom/src/`
   - Move DOM tests and examples
   - Update imports

5. **Extract `@semajsx/terminal`**
   - Move `src/terminal/` to `packages/terminal/src/`
   - Move terminal tests and examples
   - Update imports

6. **Extract `@semajsx/ssr`**
   - Move `src/server/` and `src/client/` to `packages/ssr/src/`
   - Move SSR tests and examples
   - Update imports

7. **Extract `@semajsx/logger`**
   - Move logger code
   - Move logger tests and examples
   - Update imports

8. **Update main `semajsx` package**
   - Convert to umbrella package
   - Re-export all sub-packages
   - Keep integration tests

## Tooling

### Build System

- **Bun workspaces**: Orchestrates builds across packages
- **tsdown**: TypeScript compilation for library packages
- **Vite**: Build tool for examples and apps

### Package Manager

- **Bun**: Fast package manager with native workspace support
- **Reason**: Efficient disk usage, fast installs, workspace support

### Testing

- **Vitest**: Test runner for all packages
- **Playwright**: Browser-based testing for DOM package
- **Coverage**: Each package has its own coverage
- **Integration tests**: In main `semajsx` package

### Linting & Formatting

- **oxlint**: Fast Rust-based linter (root level)
- **oxfmt**: Fast Rust-based formatter (root level, 30x faster than Prettier)
- **lint-staged**: Pre-commit hooks (root level)

## Scripts Organization

### Root Level

```json
{
  "scripts": {
    "build": "bun run --filter '*' build",
    "dev": "bun run --filter '*' dev",
    "test": "vitest",
    "test:unit": "vitest --config vitest.unit.config.ts",
    "typecheck": "tsgo --build --pretty",
    "typecheck:tsc": "bun run --filter '*' typecheck",
    "lint": "oxlint packages",
    "lint:fix": "oxlint --fix packages",
    "format": "oxfmt",
    "clean": "bun run --filter '*' clean && rm -rf node_modules"
  }
}
```

### Package Level

Each package has:

```json
{
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

## Benefits

1. **Clear Separation**: Each package has a single responsibility
2. **Independent Versioning**: Packages can be versioned independently
3. **Better Tree-Shaking**: Users can import only what they need
4. **Faster Builds**: Bun workspaces caches and parallelizes builds
5. **Easier Testing**: Each package has focused tests
6. **Better DX**: Clear boundaries and dependencies

## Publishing Strategy

### NPM Package

Only the `semajsx` package is published to npm. All `@semajsx/*` packages are internal workspace packages that get built into `semajsx` via subpath exports:

- `semajsx` — The single published package
  - `semajsx/dom` — DOM rendering (from `@semajsx/dom`)
  - `semajsx/signal` — Signal reactivity (from `@semajsx/signal`)
  - `semajsx/terminal` — Terminal rendering (from `@semajsx/terminal`)
  - `semajsx/ssr` — Server-side rendering (from `@semajsx/ssr`)
  - `semajsx/ssg` — Static site generation (from `@semajsx/ssg`)
  - `semajsx/style` — Styling system (from `@semajsx/style`)
  - `semajsx/tailwind` — Tailwind utilities (from `@semajsx/tailwind`)

This approach reduces publishing complexity — one package, one version, one release.

### Versioning

The project uses [Changesets](https://github.com/changesets/changesets) for version management. All `@semajsx/*` packages are in the changeset `ignore` list, so only `semajsx` is versioned and published.

## Future Enhancements

1. **apps/docs**: Documentation site with examples
2. **apps/playground**: Interactive playground for trying SemaJSX
3. **packages/devtools**: Browser devtools extension
4. **packages/testing**: Testing utilities for SemaJSX apps
