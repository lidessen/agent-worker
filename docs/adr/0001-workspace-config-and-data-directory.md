# ADR-0001: Workspace Config and Data Directory Design

- **Status:** Accepted
- **Date:** 2026-03-15

## Context

`~/.agent-worker/` serves as both the daemon's data directory and the global workspace's storage, mixing daemon-level files (daemon.json, secrets.json) with workspace runtime data (channels/, inbox/). There is no support for user-configurable global workspace, no standard location for workspace configs, and no clear convention for where runtime data goes across different scenarios (global, project-level, remote, one-shot task).

## Decision

### Config and data separation

- **Config files** (`*.yml`): stored in `~/.agent-worker/workspaces/` for global workspaces, or anywhere the user chooses (project dir, remote URL, inline YAML).
- **Runtime data** (channels/, inbox/, docs/, status.json): stored in `~/.agent-worker/workspace-data/<name>[--<tag>]/` by default.

### Directory structure

```
~/.agent-worker/
├── daemon.json                     # daemon process info
├── event-log.jsonl                 # global event log
├── secrets.json                    # credentials (aw auth)
├── connections/                    # platform connections (aw connect)
│   └── telegram.json
│
├── workspaces/                     # global workspace config files
│   ├── _global.yml                 # global workspace (read at daemon startup)
│   ├── monitor.yml                 # user-created global workspace
│   └── ...
│
└── workspace-data/                 # runtime data for all workspaces
    ├── global/
    │   ├── status.json
    │   ├── channels/
    │   ├── inbox/
    │   └── docs/
    ├── monitor/
    │   └── ...
    └── review--pr-123/
        └── ...
```

### Naming convention

- **`_global.yml`**: the underscore prefix is a file naming convention to sort it first and signal "special". It is only used for the config file name.
- **`global`**: the workspace name (used as the key, data directory name, and API identifier). Derived from `_global.yml` by stripping the `_` prefix.
- All other workspaces use their name directly: `monitor.yml` → name `monitor`, data dir `monitor/`.

### Data directory resolution

One rule with one override:

1. YAML specifies `data_dir` field → use it (relative paths resolve from config file location)
2. Otherwise → `~/.agent-worker/workspace-data/<name>[--<tag>]/`

### Name resolution

Workspace name is resolved in priority order (first match wins):

1. **Explicit `name` field in YAML** — always takes precedence when present
2. **File name inference** — when `name` is omitted: `review.yml` → `review`, `_global.yml` → `global` (strip `_` prefix)
3. **`opts.name`** — passed programmatically by API callers or `ensureDefault()`
4. **Error** — if none of the above yields a name, loading fails

### CLI commands

Commands always take a config file path. No "lookup by name" shorthand.

```bash
aw create <config.yml> [--tag <tag>] [--var K=V]   # service mode
aw run <config.yml> [--tag <tag>] [--var K=V]       # task mode (auto-remove on completion)
```

The config source can be a local file path or (future) a URL. The CLI reads the file, sends the YAML content to the daemon API. The daemon determines the data directory.

### Scenario mapping

| Scenario | Command | Config source | Workspace name | Data directory |
|----------|---------|--------------|----------------|----------------|
| Global workspace | daemon startup | `~/.agent-worker/workspaces/_global.yml` (fallback to built-in default) | `global` | `workspace-data/global/` |
| Global named | `aw create ~/.agent-worker/workspaces/monitor.yml` | `~/.agent-worker/workspaces/monitor.yml` | `monitor` (from YAML or file name) | `workspace-data/monitor/` |
| Local file | `aw run ./review.yml` | `./review.yml` | `review` (from YAML or file name) | `workspace-data/review/` |
| Local + tag | `aw run ./review.yml --tag pr-123` | `./review.yml` | `review` | `workspace-data/review--pr-123/` |
| Remote URL | `aw run https://.../review.yml` (future) | fetched at runtime | `review` (from YAML or URL file name) | `workspace-data/review/` |
| API inline | POST /workspaces `{source: "name: foo\nagents: ..."}` | request body YAML | `foo` (from YAML content, name required for inline) | `workspace-data/foo/` |
| Project-local data | `aw run ./review.yml` (YAML has `data_dir: ./.aw`) | `./review.yml` | `review` | `./.aw/` (relative to config file) |

### Global workspace behavior

- Daemon reads `~/.agent-worker/workspaces/_global.yml` at startup
- If file does not exist, uses built-in default config:
  ```yaml
  agents:
    default: {}
  storage: file
  ```
  Name is set to `global` by `ensureDefault()` via `opts.name`.
- The `default: {}` agent triggers runtime auto-discovery (CLI first, then API key)
- If auto-discovery fails (no CLI, no API key), falls back to empty agents (`agents: {}`) so the daemon can still start

### YAML schema changes

**`WorkspaceDef` type:**

| Field | Before | After |
|-------|--------|-------|
| `name` | `string` (required) | `string?` (optional, inferred from file name) |
| `storage_dir` | `string?` | removed |
| `data_dir` | — | `string?` (custom data directory, default: `~/.agent-worker/workspace-data/<name>/`) |
| `storage` | `"memory" \| "file"` | unchanged |

### Code changes required

**`packages/workspace/src/config/types.ts`:**
- `name` → `name?: string`
- Remove `storage_dir`, add `data_dir?: string`

**`packages/workspace/src/config/loader.ts`:**
- `parseWorkspaceDef()`: allow `name` to be absent
- `loadWorkspaceDef()`: resolve name using priority order (YAML → file name → opts.name → error)
- `toWorkspaceConfig()`: replace `def.storage_dir` with `def.data_dir`

**`packages/agent-worker/src/workspace-registry.ts`:**
- `workspaceDir()`: change path from `<dataDir>/workspaces/<key>` to `<dataDir>/workspace-data/<key>`
- `ensureDefault()`: read from `<dataDir>/workspaces/_global.yml`, data to `<dataDir>/workspace-data/global/`, pass `opts.name = "global"`
- `create()`: replace `storage_dir` reference with `data_dir`

**`packages/workspace/test/config.test.ts`:**
- Update name-required test to name-optional test
- Add `data_dir` field test

## Consequences

- All workspace runtime data has a single default location (`~/.agent-worker/workspace-data/`)
- Config files can live anywhere — no coupling between config location and data location
- Users can opt into project-local data via `data_dir` in YAML
- Global workspace becomes user-configurable via `~/.agent-worker/workspaces/_global.yml`
- CLI commands remain `aw create/run <config.yml>` — no new command forms
