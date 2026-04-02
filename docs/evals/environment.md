# Development Environment

This note captures the local testing setup used during development evaluations.

## Code Location

The sandbox contains a shared workspace with the cloned repo. Use the shared workspace path from the prompt's directories section.

## Quality Checks

Before submitting for review:

```sh
bun test
bunx oxlint
bunx tsgo --build
```

## Testing Changes With an Heir Instance

To test modified code without affecting the running daemon:

```sh
cd <shared-workspace-path>
bun packages/agent-worker/src/cli/index.ts daemon start \
  -p 7421 --data-dir ~/.agent-worker-heir --mcp-port 42425
```

This starts an isolated daemon on port `7421`.

- `7420`: Regent, the current production instance
- `7421`: Heir, the test instance with local changes
- data dir: `~/.agent-worker-heir/`

After verifying behavior, stop the heir and merge code to `main`.

## Git Workflow

- Create a feature branch with a descriptive name.
- Commit in small steps with clear messages.
- Push and request review before merging.
