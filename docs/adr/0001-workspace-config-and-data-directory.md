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
    ├── _global/
    │   ├── status.json
    │   ├── channels/
    │   ├── inbox/
    │   └── docs/
    ├── monitor/
    │   └── ...
    └── review--pr-123/
        └── ...
```

### Data directory resolution

One rule with one override:

1. YAML specifies `data_dir` field → use it (relative paths resolve from config file location)
2. Otherwise → `~/.agent-worker/workspace-data/<name>[--<tag>]/`

### Name inference

When YAML omits `name`, infer from context (priority order):

1. `name` field in YAML content
2. File name: `review.yml` → `review`, `_global.yml` → `_global`
3. `opts.name` fallback (from API callers)
4. Default: `"global"`

### Scenario mapping

| Scenario | Command | Config source | Data directory |
|----------|---------|--------------|----------------|
| Global workspace | daemon startup | `workspaces/_global.yml` (fallback to built-in default) | `workspace-data/_global/` |
| Global named | `aw create monitor` | `workspaces/monitor.yml` | `workspace-data/monitor/` |
| Local file | `aw run ./review.yml` | `./review.yml` | `workspace-data/review/` |
| Local + tag | `aw run ./review.yml --tag pr-123` | `./review.yml` | `workspace-data/review--pr-123/` |
| Remote URL | `aw run https://.../review.yml` | fetched at runtime | `workspace-data/review/` |
| API inline | POST /workspaces | request body YAML | `workspace-data/<name>/` |
| Project-local | YAML has `data_dir: ./.aw` | any | `./.aw/` |

### Global workspace behavior

- Daemon reads `~/.agent-worker/workspaces/_global.yml` at startup
- If not present, uses built-in default: `agents: { default: {} }, storage: file`
- The `default` agent triggers runtime auto-discovery (CLI first, then API key)
- If discovery fails, falls back to empty agents so daemon can still start

### YAML schema changes

- `storage_dir` → renamed to `data_dir` (clearer semantics)
- `name` → optional (inferred from file name or context)
- `storage` field retained (`"memory" | "file"`, default `"file"`)

## Consequences

- All workspace runtime data has a single default location (`workspace-data/`)
- Config files can live anywhere — no coupling between config location and data location
- Users can opt into project-local data via `data_dir` in YAML
- Global workspace becomes user-configurable via `_global.yml`
- `aw create <name>` can look up configs from `workspaces/` directory
