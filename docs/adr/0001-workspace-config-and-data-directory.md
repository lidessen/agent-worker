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

### Name inference

When YAML omits `name`, it is inferred from the source. Priority:

1. File name: `review.yml` → `review`, `_global.yml` → `global` (strip `_` prefix)
2. `opts.name` (passed by API callers or `ensureDefault()`)
3. Error — name is required for non-global workspaces

Note: if YAML contains a `name` field, it is always used as-is. Inference only applies when `name` is omitted.

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
| API inline | POST /workspaces `{source: "name: foo\nagents: ..."}` | request body YAML | `foo` (from YAML content) | `workspace-data/foo/` |
| Project-local data | `aw run ./review.yml` (YAML has `data_dir: ./.aw`) | `./review.yml` | `review` | `./.aw/` (relative to config file) |

### Global workspace behavior

- Daemon reads `~/.agent-worker/workspaces/_global.yml` at startup
- If file does not exist, uses built-in default config:
  ```yaml
  agents:
    default: {}
  storage: file
  ```
  Name is set to `global` by `ensureDefault()`.
- The `default: {}` agent triggers runtime auto-discovery (CLI first, then API key)
- If auto-discovery fails (no CLI, no API key), falls back to empty agents (`agents: {}`) so the daemon can still start

### YAML schema changes

**`WorkspaceDef` type:**

| Field | Before | After |
|-------|--------|-------|
| `name` | `string` (required) | `string?` (optional, inferred from file name) |
| `storage_dir` | `string?` | removed, replaced by `data_dir` |
| `data_dir` | — | `string?` (custom data directory, default: auto) |
| `storage` | `"memory" \| "file"` | unchanged |

## Consequences

- All workspace runtime data has a single default location (`~/.agent-worker/workspace-data/`)
- Config files can live anywhere — no coupling between config location and data location
- Users can opt into project-local data via `data_dir` in YAML
- Global workspace becomes user-configurable via `~/.agent-worker/workspaces/_global.yml`
- CLI commands remain `aw create/run <config.yml>` — no new command forms
