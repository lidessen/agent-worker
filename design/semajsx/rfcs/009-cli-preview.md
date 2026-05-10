# RFC 009: `semajsx` CLI with Quick Preview

**Date**: 2026-04-20
**Author**: @ztytotoro
**Status**: Accepted

**Decisions locked during review (2026-04-20):**

- Q1: prefer default export, fall back to sole named export, error on ambiguity.
- Q2: use `cac` for arg parsing.
- Q3: `preview` accepts a single file only in v1; directory support deferred to a future `semajsx dev`.

---

## 1. Summary

Introduce a first-party `semajsx` CLI so users can preview a single component
file instantly: `semajsx ./Component.tsx` opens the component in a browser via
a Vite-backed dev server, with zero project setup required.

## 2. Motivation

### 2.1 Problem

Today, the only way to see a SemaJSX component render in a browser is to
hand-wire an SSR `createApp` server (see `packages/ssr/examples/`), a Vite
config, and an HTML shell. That's appropriate for apps — too heavy for "I
wrote a component, does it look right?"

Peer frameworks have solved this:

- Storybook / Ladle / Histoire — component workbench (heavyweight)
- `vite preview`, `wrangler dev` — project-scoped preview
- `vue-preview-web`, `astro preview` — framework CLIs

SemaJSX has none. Contributors and docs authors drop back to hand-rolled
example servers, and first-time users can't kick tires without scaffolding.

### 2.2 User scenarios

- **As a component author**, I want to run `semajsx ./Button.tsx` and see it
  render immediately, so I can iterate visually without scaffolding.
- **As a docs/tutorial author**, I want stable `semajsx` invocations I can
  paste into guides.
- **As a new user**, I want `bunx semajsx ./Hello.tsx` to work with no
  project setup.

## 3. Goals

- A `semajsx` binary published with the `semajsx` package.
- `semajsx <file>` (default = preview) boots a dev server with HMR and opens
  the component.
- `semajsx preview <file>` is an explicit alias for the default.
- Works on a bare `.tsx` file with **no** `package.json`, `vite.config`, or
  SemaJSX-specific configuration in the target directory.
- Reuses `@semajsx/ssr` Vite integration (don't reinvent rendering).

## 4. Non-goals

- **Not** a component workbench (no story files, no controls panel, no
  visual regression). That's future work, possibly `semajsx workbench`.
- **Not** a build tool for shipping apps — `semajsx build` is deliberately
  out of scope for this RFC (follow-up).
- **Not** a scaffolding tool — no `semajsx create`/`init` in this RFC.
- **Not** a terminal-target preview — DOM only for v1. Terminal preview
  can be added later under the same command tree (`semajsx preview --target=terminal`).

## 5. High-level proposal

### 5.1 Command surface (v1)

```
semajsx <file>                 # alias for `preview <file>`
semajsx preview <file> [opts]  # boot a Vite dev server rendering <file>
semajsx --help / -h
semajsx --version / -v
```

Options for `preview`:

- `--port <n>` (default: 3000, auto-increment if taken)
- `--host <addr>` (default: `localhost`)
- `--open` / `--no-open` (default: open)
- `--ssr` / `--no-ssr` (default: no-ssr for v1 — pure CSR is simpler and
  sufficient for component preview; SSR via `@semajsx/ssr` is a follow-up)

Room is left for future subcommands (`build`, `workbench`, `create`)
without breaking the default-preview ergonomics.

### 5.2 Where the CLI lives

**Option A (recommended):** Add a `bin` entry to the existing `semajsx`
package so `bunx semajsx` / `npx semajsx` work without installing anything
extra. Implementation lives in `packages/semajsx/src/cli/`.

**Option B:** New `@semajsx/cli` package, `semajsx` package depends on it.

Recommendation: **A**. One package, one install, zero confusion. Split to B
only if CLI deps bloat the runtime bundle — we can mitigate by keeping CLI
code out of any `exports` path other than `bin`.

### 5.3 How `preview` works

1. Resolve `<file>` to an absolute path; verify it exists and exports a
   component (default export preferred, else single named export).
2. Generate an in-memory virtual entry that imports the user's file and
   calls `render(<UserComponent />, document.getElementById('root')!)`
   from `@semajsx/dom`.
3. Generate an in-memory `index.html` with a `<div id="root">` mount point
   and `<script type="module" src="/virtual-entry">`.
4. Boot a Vite dev server (programmatic API, same pattern as
   `@semajsx/ssr`) with:
   - `@semajsx/dom` JSX runtime preconfigured
   - Virtual modules plugin for the entry + HTML
   - `root` pointed at `cwd()` so user's relative imports resolve
5. Open the browser (unless `--no-open`).
6. HMR works out of the box via Vite — signal state persists on module
   updates where possible (Vite's built-in behavior; no custom HMR glue in
   v1).

### 5.4 Example usage

```bash
# Zero-config preview of a file
bunx semajsx ./Button.tsx

# Explicit command with port
bunx semajsx preview ./pages/Home.tsx --port 4000 --no-open
```

## 6. Alternatives considered

### A. Require users to scaffold an SSR example

_Status quo._ Pro: no new code. Con: every user pays scaffolding tax,
every tutorial starts with boilerplate. Rejected — this is exactly the
friction the RFC is trying to remove.

### B. Ship as a Vite plugin instead of a CLI

A `semajsxPreview()` Vite plugin that users wire into their own
`vite.config`. Pro: composable. Con: requires users to already have a
Vite project. Fails the "zero setup" goal. Could coexist later.

### C. Use `@semajsx/ssr`'s `createApp` directly

The CLI internally is an `app.prepare()` caller. Pro: reuses tested code.
Con: SSR-by-default slows first paint for single-component preview and
couples CLI to island infrastructure. Decision: reuse Vite _config
primitives_ from `@semajsx/ssr` (JSX runtime resolution, plugin list) but
run CSR-only by default; `--ssr` opts in.

### D. New `@semajsx/cli` package

See 5.2 Option B. Deferred.

## 7. Risks

| Risk                                                                             | Impact | Prob. | Mitigation                                                                  |
| -------------------------------------------------------------------------------- | ------ | ----- | --------------------------------------------------------------------------- |
| CLI deps bloat `semajsx` install size                                            | M      | M     | Lazy-load heavy deps (Vite) only when CLI runs; audit with `bunx --dry-run` |
| Virtual module approach conflicts with user's own Vite config (e.g. in monorepo) | M      | L     | `root` resolution + opt-in `--config <path>` escape hatch (follow-up)       |
| Windows path handling (file:// URLs in virtual modules)                          | M      | L     | Use `pathe` / `url.pathToFileURL`; add CI matrix                            |
| Component exports that aren't renderable (e.g. hook files)                       | L      | M     | Detect via runtime error, print friendly message                            |

## 8. Open questions

- [ ] **Q1**: Default export vs named export — if the file has multiple
      named exports, do we require `default`, pick the first capitalized one,
      or prompt? _Proposed_: prefer default, fall back to sole named export,
      error if ambiguous. Ambiguity can be resolved later by `--export <name>`.
- [ ] **Q2**: CLI framework — `commander` / `cac` / hand-rolled? _Proposed_:
      `cac` (small, used widely in Vite ecosystem) or hand-rolled (no dep, but
      more code). Leaning `cac` for help-text quality.
- [ ] **Q3**: Should `preview` also accept a **directory** (boot the project
      with auto-route detection)? _Proposed_: no for v1, add later as
      `semajsx dev` when we have routing.

## 9. Dependencies

- `vite` (already a peer dep of `@semajsx/ssr`) — promoted to direct dep
  of `semajsx` for the CLI.
- CLI arg parser (see Q2).
- `open` (tiny npm package) for launching browser, or use `Bun.$` / `exec`.

## 10. Next steps (if accepted)

- [ ] Create `packages/semajsx/src/cli/` with `index.ts`, `preview.ts`,
      `virtual-entry.ts`.
- [ ] Add `"bin": { "semajsx": "./dist/cli/index.mjs" }` + shebang handling
      in `tsdown.config`.
- [ ] Add design note in `design/designs/cli-preview-design.md` covering
      virtual-module layout and Vite config composition.
- [ ] Docs: `packages/semajsx/README.md` section + `apps/docs/content/guides/quick-preview.md`.
- [ ] Tests: integration test that boots the CLI against a fixture
      component and asserts the rendered HTML.

---

## Decision

**Decision**: Accepted
**Date**: 2026-04-20
**Decision Maker**: @ztytotoro
