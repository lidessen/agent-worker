# Writing Guide

How to write good design artifacts. Reference this when creating or 
reviewing DESIGN.md, proposals, or blueprints.

## Tone

Match the team's language. Write like explaining to a smart colleague who 
just joined — they need the shape and the non-obvious choices, not details.

## What good looks like

**Module descriptions** — two lines:
```
### Auth Service
- **Does**: User auth, token management, permission checks
- **Doesn't**: User profiles, billing, audit logs
```

**Key mechanisms** — the pattern, not the schema:
```
Good:  "Workers are disposable — continuity lives in the workspace. 
        When a worker hits its limits, a fresh one picks up from a 
        structured handoff, not from the old worker's history."

Bad:   "WorkerRun { id, status, startedAt, runner_type, input_packet }"
```

**Key decisions** — only real tradeoffs:
```
Good:  "Outbox over direct push — decouples core from platforms, 
        guarantees delivery. Direct push simpler but fragile."

Bad:   "We use TypeScript." (not a real decision)
```

**ASCII diagrams** — answer "what talks to what" in 5 seconds:
```
[Module]         you control
(External)       you don't control
──>              sync call
..>              async / event
```

## What to avoid

- API endpoints, types, config — that's code
- Diagrams with every branch — happy path only
- Over 200 lines per file
- Module "does" longer than 3 lines — split the module
- Decisions without a rejected alternative
