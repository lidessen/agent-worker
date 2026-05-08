# harness:audit — Evaluate a project's context architecture

Analyze the current project's harness artifacts and identify layer 
violations, missing context, and optimization opportunities.

## Process

### 1. Inventory

Scan for all harness artifacts in the project:

```
L1 artifacts        CLAUDE.md, .cursorrules, .github/copilot-instructions.md,
                    AGENTS.md, codex.md, .windsurfrules, settings.json (hooks)

L2 artifacts        design/, blueprints/, installed skills (SKILL.md bodies)

L3 artifacts        Skill supporting files, scripts/, references/, assets/
```

Note which exist, which are missing, and approximate token counts for L1 
artifacts.

### 2. Evaluate L1

Read every L1 artifact. Check for:

- **Bloat** — implementation details, file-by-file breakdowns, generic 
  practices, information derivable from code. These belong in L2/L3.
- **Gaps** — missing build commands, missing architectural overview, 
  missing non-obvious conventions. The agent will guess wrong without these.
- **Staleness** — references to files/modules/patterns that no longer 
  exist. Stale L1 is worse than missing L1.
- **Redundancy** — same information in multiple L1 files (CLAUDE.md and 
  .cursorrules both describing architecture).

Apply the litmus test: would removing this line cause the agent to make 
a worse architectural decision? If not, it doesn't belong in L1.

### 3. Evaluate L2

Check whether the project has appropriate L2 artifacts:

- Does the project have design docs or architectural documentation that 
  the agent can load when needed?
- Are skills structured with lean bodies and supporting files, or is 
  everything inlined?
- Are there task-level records (blueprints, ADRs) the agent can reference?

### 4. Evaluate L3 accessibility

Check whether L2 artifacts properly point to L3 resources:

- Can the agent discover supporting files from L2 references?
- Are reference chains shallow (one level deep from SKILL.md)?
- Are L3 files focused and self-contained?

### 5. Report

Present findings organized by severity:

```
Critical    Agent lacks architectural awareness (missing/empty L1)
            Agent context is overloaded (L1 > 2000 tokens of noise)

Important   Layer violations (L3 in L1, missing L2 for complex project)
            Stale references in L1

Suggested   Optimization opportunities (consolidation, better pointers)
            Missing hooks for mechanical enforcement
```

For each finding, explain what's wrong, why it matters, and the specific 
fix. Don't just list problems — propose the migration (which content 
moves from which layer to which layer).
