---
name: harness
description: |
  Agent harness architecture — structure a project's agent context across 
  layers for effective AI-assisted development. Covers CLAUDE.md, skills, 
  design docs, hooks, and all artifacts that shape how an agent understands 
  and operates in a codebase.

  Use when setting up or improving a project's agent configuration, when 
  agent context feels bloated or disorganized, when onboarding a new project 
  for AI-assisted development, or when the agent keeps losing architectural 
  awareness mid-task. Trigger on phrases like "set up claude", "improve 
  CLAUDE.md", "agent keeps forgetting", "context is too long", "harness 
  setup", "organize agent context", "how should I structure my prompts".

  Supports arguments: `/harness audit` to evaluate an existing project's 
  context architecture, `/harness init` to set up harness from scratch.
argument-hint: "[audit | init]"
---

# Harness Architecture

An agent's context window is its working memory — finite and precious. 
The craft of harness programming is migrating the right information to the 
right context layer, so the agent always has enough awareness to make good 
decisions without drowning in details it doesn't yet need.

Two concerns, one discipline: **context architecture** (what the agent 
knows) and **agent lifecycle** (how the agent works across time). They 
meet at artifacts — an artifact is both information (context) and a 
mechanism for continuity (lifecycle).

## Commands

When invoked with an argument, dispatch to the corresponding file:

- `/harness audit` → Read and follow `commands/audit.md` in this skill directory.
  Evaluate an existing project's context architecture and suggest improvements.
- `/harness init` → Read and follow `commands/init.md` in this skill directory.
  First-time project setup — bootstrap a project's harness from scratch.
- No argument → Continue with the methodology below.

---

## Part I: Context Architecture

How to structure what the agent knows.

### The Three Layers

Every piece of information an agent might need belongs at one of three 
abstraction levels:

```
┌─────────────────────────────────────────────────────┐
│  L1  Architecture                                   │
│  System shape, boundaries, invariants, principles   │
│  Always in context. Small, stable, high-leverage.   │
│  ≈ 100–500 tokens per artifact                      │
├─────────────────────────────────────────────────────┤
│  L2  Design                                         │
│  Patterns, mechanisms, approach, task plan           │
│  Loaded on activation. The working blueprint.       │
│  ≈ 1000–5000 tokens per artifact                    │
├─────────────────────────────────────────────────────┤
│  L3  Implementation                                 │
│  Concrete code, scripts, reference data, examples   │
│  Loaded on demand. The raw material.                │
│  Size varies — only what's needed right now          │
└─────────────────────────────────────────────────────┘
```

The higher the layer, the smaller and more stable it is. L1 gives the 
agent orientation. L2 gives it a plan. L3 gives it the details to execute.

**The key insight**: most harness problems come from layer violations — 
L3 details polluting L1 (bloated CLAUDE.md full of implementation notes), 
or L1 context missing entirely (agent has no architectural awareness and 
makes decisions that break system boundaries).

### Mapping Artifacts to Layers

```
L1 (always present)          L2 (on activation)         L3 (on demand)
─────────────────────        ──────────────────────      ──────────────
CLAUDE.md                    Skill body (SKILL.md)       scripts/
Skill metadata               design/DESIGN.md            references/
  (name + description)       blueprints/                 assets/
Hook triggers                Task plans                  Code files
Project-level invariants     Decision records            Test fixtures
```

### CLAUDE.md — the L1 anchor

CLAUDE.md is the most critical L1 artifact. It's always loaded, so every 
token must earn its place. A good CLAUDE.md contains:

- **What this system is** — one sentence
- **How to build/test/run** — the commands, nothing more
- **Architectural shape** — module boundaries, data flow, key patterns 
  (or a pointer to design/ if using design-driven)
- **Non-obvious conventions** — things the agent can't derive from code

A bad CLAUDE.md contains: file-by-file breakdowns (agent can read the 
tree), generic best practices (agent already knows), implementation 
details that change frequently (belongs in L2/L3).

**Litmus test**: if removing a line from CLAUDE.md wouldn't cause the 
agent to make a worse architectural decision, the line doesn't belong.

### Skills — L1 metadata, L2 body, L3 files

A skill naturally spans all three layers:

- **L1**: `name` + `description` in frontmatter (~100 tokens). Loaded 
  at startup for all installed skills. This is how the agent decides 
  whether to activate a skill — make it precise.
- **L2**: The markdown body of SKILL.md (<5000 tokens). Loaded when 
  activated. Contains the methodology, the loop, the principles.
- **L3**: Supporting files (commands/, scripts/, references/). 
  Loaded only when the skill dispatches to them.

Keep SKILL.md under 500 lines. If it's longer, something belongs in L3.

### Context Principles

**Smallest effective context** — Every token in L1 competes with the 
agent's working space for the current task. Write L1 artifacts ruthlessly 
— include only what changes the agent's decisions. Details that are 
nice-to-know but don't affect judgment belong in L2 or L3.

**Stable layers, volatile details** — L1 should change rarely (project 
architecture doesn't shift daily). L2 changes per-task (each blueprint is 
different). L3 changes constantly (code evolves). If you find yourself 
updating CLAUDE.md frequently, the information probably belongs at a 
lower layer.

**Pointers over content** — When L1 needs to reference complex 
information, point to it rather than inlining it. "See design/DESIGN.md 
for module boundaries" is better than copying the module list into 
CLAUDE.md. The agent loads L2/L3 when needed.

### Diagnosing Layer Problems

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Agent forgets project architecture mid-task | L1 too thin or missing | Add architectural context to CLAUDE.md |
| Agent drowns in context, slow responses | L1 too thick — L3 details leaking up | Audit CLAUDE.md, move details to L2/L3 files |
| Agent breaks module boundaries | No design docs or CLAUDE.md lacks boundaries | Add design/ or architectural section to CLAUDE.md |
| Agent loads unnecessary files | Skill body has too many inline references | Split into supporting files, load on demand |
| Agent repeats same mistakes | Missing hook or missing L1 principle | Add a hook (mechanical) or CLAUDE.md rule (judgment) |

---

## Part II: Agent Lifecycle

How the agent works across time.

### Succession over persistence

Every agent instance is ephemeral — it lives for one session, then its 
context is gone. Don't fight this. Design for succession: knowledge 
survives through artifacts, not through any single agent's memory.

The unit of continuity is the artifact chain, not the agent instance. 
L1 and L2 artifacts (CLAUDE.md, design docs, blueprints) are the 
institutional memory that outlives every session. Commit messages are 
the archaeological record. Blueprint State sections are handoff documents 
from one generation to the next. Verification criteria are how the next 
generation trusts the previous one's work.

To give an "agent" a longer effective lifecycle, don't extend the session 
— raise the abstraction level. An agent operating at L1 (architecture) 
spans the lifetime of the project. An agent operating at L3 (implementation 
details) lives and dies within one task. The layers aren't just about 
context efficiency — they're about temporal scope.

### One task, one context

A single task should fit within one context window. If it can't, it's 
two tasks. This is the fundamental unit of agent work — each task gets 
a focused context with only the information it needs, preventing earlier 
work from polluting later decisions. When scoping tasks, ask: can the 
agent complete this without its context degrading?

### Hooks — lifecycle guardrails

Hooks shape agent behavior from outside the context window — always 
active, zero-cost in tokens. Two flavors:

- **Prompt hooks** — inject a reminder, let the agent apply judgment. 
  Best for checks that need context awareness (layer integrity, 
  consistency, architectural boundaries).
- **Script hooks** — run a command, pass or block mechanically. Best 
  for checks that don't need judgment (linting, format validation, 
  forbidden patterns).

### Consistency after change

When you change something that other files reference — a path, a name, 
a term, a structure — check every file that depends on it. Stale 
references are a common failure mode: you rename a directory but leave 
old paths in SKILL.md, change a convention but leave the old wording in 
CLAUDE.md. A prompt hook that reminds "did you update everything that 
references what you just changed?" is one of the highest-value hooks 
you can add to a project.

---

## Meta-principle

### Understand why, not just what

An agent that understands the reasoning behind a constraint exercises 
better judgment in novel situations than one following a rigid rule. When 
writing any harness artifact, explain the *why* — it costs a few extra 
tokens but compounds into better decisions across every task.

> "If we want models to exercise good judgment across a wide range of 
> novel situations, they need to be able to generalize — to apply broad 
> principles rather than mechanically following specific rules."
> — [Anthropic's constitution](https://www.anthropic.com/constitution)
