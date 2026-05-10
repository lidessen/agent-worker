# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- EditorConfig for consistent coding style across editors
- Comprehensive contribution guidelines in CONTRIBUTING.md
- Code of Conduct for community interactions
- This CHANGELOG to track version history

### Changed

- Updated CLAUDE.md to accurately reflect project architecture
- Improved package.json metadata (author, repository info)

### Fixed

- Documentation inconsistencies between CLAUDE.md and actual codebase

## [0.1.0] - 2025-01-15

### Added

- **Core Features**
  - Signal-based reactivity system with fine-grained updates
  - Computed signals with automatic dependency tracking
  - Batch updates for performance optimization
  - Signal utilities (isSignal, unwrap)

- **Dual Rendering Targets**
  - DOM rendering with full browser support
  - Terminal rendering with Ink-like API
  - Flexbox layout engine powered by Yoga
  - Built-in terminal components (Box, Text)
  - ANSI color support with chalk

- **Runtime**
  - VNode creation and normalization
  - Runtime helpers (when, resource, stream)
  - JSX runtime for both production and development
  - Support for fragments and children normalization

- **Developer Experience**
  - TypeScript support with full type safety
  - Multiple export paths for tree-shaking
  - Comprehensive examples (Vite, Bun server, terminal apps)
  - Performance optimization examples
  - Vitest test suite with browser and unit tests

- **Build & Tooling**
  - Modern build system with tsdown
  - ESM-only output
  - Source maps and declaration files
  - Oxlint for fast linting
  - Prettier with oxc plugin
  - Husky git hooks for code quality
  - Conventional commits enforcement

- **Documentation**
  - Comprehensive README with examples
  - API reference
  - Example applications with READMEs
  - Terminal rendering guide

### Performance

- Implemented node pooling for efficient DOM updates
- Batched updates to minimize reflows
- Keyed list rendering for optimal reconciliation
- Direct DOM property updates (no virtual DOM diffing)

---

## Version History

- `0.1.0` - Initial release with core features
- `Unreleased` - Work in progress

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute to this project.

## Links

- [Repository](https://github.com/semajsx/semajsx)
- [Issues](https://github.com/semajsx/semajsx/issues)
- [Releases](https://github.com/semajsx/semajsx/releases)
