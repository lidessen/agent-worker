# attention-driven:design

Design layer: current system shape, boundaries, decisions, and blueprints.
Design owns the working model: what system is being changed, which boundaries
matter, which mechanisms are available, and which changes would alter the shape
itself.

Read `references/design.md`, `references/artifact-policy.md`, and
`references/templates.md` before writing design artifacts. Use
`references/writing-guide.md` when drafting or reviewing design prose.

## Normal Entry

1. Read `design/DESIGN.md` first if it exists.
2. Read the relevant per-package or per-area design doc.
3. Check pending design decisions and active blueprints that touch the area.
4. Decide whether the task stays inside the current shape or changes it.

If it stays inside shape, proceed with implementation planning. If it changes
shape, write a decision before source edits.

## Shape Change

Shape change means adding/removing/merging modules, changing how modules
connect, changing durable artifact ownership, or introducing a key mechanism.

For shape changes:

1. Draft `design/decisions/NNN-title.md`.
2. Include context, recommendation, alternatives, consequences, and verification
   expectations.
3. Run a cold review using `references/cold-review-prompt.md` when the change is
   substantial.
4. Wait for human adoption/rejection.
5. If adopted, update `design/DESIGN.md` and relevant package docs before code.

Do not rewrite the system shape because one local correction failed. Escalate
to design only when observations show the boundary or mechanism assumption is
wrong.

## Blueprint

Use a blueprint when a task is non-trivial, spans sessions, or needs resumable
state. Skip it for bug fixes, small config edits, or work shorter to do than to
plan.

Blueprints follow Plan -> Build -> Verify:

- Plan: scope, approach, constraints, verification criteria.
- Build: what changed.
- Verify: falsifiable checks and results.

During active work, TODO/State scaffolding is allowed. Strip temporary scaffold
when the blueprint is done, but keep follow-ups that future work should see.

## Bootstrap

If a project has no `design/DESIGN.md` but enough stable shape to describe,
bootstrap by reading the code and writing the current shape. If the category is
unsettled and the shape is not stable enough, route to `reframe` first.

## Design Audit

Use audit when design and implementation may have drifted. Classify findings:

- doc-only drift: update design docs to match current implementation;
- implementation drift: code violates design;
- unresolved design question: write a decision or ask the human;
- historical artifact issue: leave history alone unless it misleads current
  state, then add a current correction.
