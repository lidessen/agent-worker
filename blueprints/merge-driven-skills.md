# Merge Driven Skills

## Plan

Merge the current methodology skills into one `attention-driven` skill with a
stable daily entrypoint and progressively loaded command/reference files.
The merged skill is named for the core theory: allocate attention around the
load-bearing 30%, not around a rigid workflow phase model.

The merge is not a mechanical concat. The new skill should preserve the
load-bearing concepts while removing trigger competition between sibling
skills:

- `goal` owns direction, continuity, record entries, criteria, and STOPs.
- `design` owns current system shape, decisions, and blueprints.
- `fact` owns falsifiable observations, verification, TDD discipline, and
  evidence trails. This replaces the user-facing `evidence-driven` name.
- `reframe` owns paradigm-level shape work before design is stable.
- `harness` owns project context wiring, setup, sync, and audit.

Target structure:

```text
skills/attention-driven/
  SKILL.md
  commands/
    audit.md
    close.md
    design.md
    fact.md
    go.md
    goal.md
    reframe.md
    setup.md
  references/
    artifact-policy.md
    control-review.md
    control-loop.md
    cold-review-prompt.md
    design.md
    fact.md
    goal.md
    harness.md
    reframe.md
    routing.md
    setup.md
    templates.md
    traps.md
    writing-guide.md
  scripts/
```

### Design Constraints

- Keep `SKILL.md` short. It should define the entrypoint, command dispatch, and
  routing vocabulary only.
- Do not add a `methods/` or `sub-skills/` directory. Put detailed method
  material in `references/` and executable entrypoints in `commands/`.
- `/attention-driven go` is the default daily entrypoint. It reads goal and recent
  record state when present, names the current mainline, and routes to the
  smallest needed layer.
- Historical artifacts are evidence and rationale, not load-bearing current
  state. If a decision or blueprint was wrong, correct the current artifact or
  create a new one; do not repair history for its own sake.
- Avoid making the merged skill a rigid phase machine. The command should guide
  the mainline and leave strategy free unless a durable artifact boundary is
  load-bearing.
- Preserve direct replacement posture: after migration, stale sibling skill
  entrypoints should be removed or reduced to explicit pointers rather than
  left as competing active skills.

### Migration Coverage Table

| Source | Target | Treatment |
| --- | --- | --- |
| `skills/goal-driven/SKILL.md` | `SKILL.md`, `commands/go.md`, `commands/goal.md`, `commands/close.md`, `references/goal.md` | Split daily loop, goal lifecycle, and conceptual reference. |
| `skills/goal-driven/commands/set.md` | `commands/goal.md`, `references/templates.md` | Preserve interview protocol and setup details. |
| `skills/goal-driven/commands/review.md` | `commands/audit.md`, `commands/goal.md` | Keep strategic review under goal command; expose overall drift check through audit. |
| `skills/goal-driven/commands/close.md` | `commands/close.md` | Preserve close protocol. |
| `skills/goal-driven/references/stories.md` | `references/goal.md` | Preserve as optional interpretation layer. |
| `skills/goal-driven/references/templates.md` | `references/templates.md` | Merge with other templates. |
| `skills/goal-driven/references/example.md` | omit or compress into `references/goal.md` | Examples are non-load-bearing; keep only if needed after first pass. |
| `skills/design-driven/SKILL.md` | `commands/design.md`, `references/design.md`, `references/artifact-policy.md`, `references/routing.md` | Keep shape ownership and 30/70 principle; reduce phase rigidity. |
| `skills/design-driven/commands/init.md` | `commands/setup.md`, `references/setup.md` | Merge into unified setup. |
| `skills/design-driven/commands/bootstrap.md` | `commands/design.md` | Preserve design bootstrap path. |
| `skills/design-driven/commands/audit.md` | `commands/audit.md`, `commands/design.md` | Preserve design/code drift audit. |
| `skills/design-driven/references/cold-review-prompt.md` | `references/cold-review-prompt.md` | Preserve. |
| `skills/design-driven/references/templates.md` | `references/templates.md` | Merge decision/blueprint templates. |
| `skills/design-driven/references/writing-guide.md` | `references/writing-guide.md` | Preserve and trim if needed. |
| `skills/design-driven/references/example.md` | omit or compress into `references/design.md` | Examples are secondary; avoid bloating first pass. |
| `skills/evidence-driven/SKILL.md` | `commands/fact.md`, `references/fact.md` | Rename user-facing layer to fact; preserve falsifiability, TDD, evidence trail. |
| `skills/evidence-driven/commands/init.md` | `commands/setup.md`, `references/setup.md` | Merge config wiring into unified setup. |
| `skills/reframe/SKILL.md` | `commands/reframe.md`, `references/reframe.md`, `references/routing.md` | Preserve unsettled-paradigm entry and handoff to design. |
| `skills/reframe/commands/init.md` | `commands/setup.md`, `commands/reframe.md` | Merge setup and explicit reframe init behavior. |
| `skills/reframe/commands/explain.md` | `commands/reframe.md` | Preserve explain subcommand. |
| `skills/reframe/commands/close.md` | `commands/reframe.md`, `commands/close.md` | Preserve concept close/graduation. |
| `skills/reframe/references/phase-guide.md` | `references/reframe.md` | Preserve phases as detailed reference. |
| `skills/reframe/references/template.md` | `references/templates.md` | Merge concept template. |
| `skills/reframe/references/traps.md` | `references/traps.md` | Preserve anti-patterns. |
| `skills/reframe/references/cross-skill.md` | `references/routing.md`, `references/reframe.md` | Merge into unified layer routing. |
| `skills/harness/SKILL.md` | `references/harness.md`, `commands/setup.md`, `commands/audit.md` | Preserve context architecture and lifecycle model. |
| `skills/harness/commands/init.md` | `commands/setup.md`, `references/setup.md` | Merge project harness initialization. |
| `skills/harness/commands/audit.md` | `commands/audit.md` | Preserve context architecture audit. |
| `skills/setup-lidessen-skills/SKILL.md` | `commands/setup.md`, `references/setup.md` | Replace independent skill with setup mode/preset. |
| `skills/setup-lidessen-skills/commands/init.md` | `commands/setup.md` | Merge. |
| `skills/setup-lidessen-skills/commands/sync.md` | `commands/setup.md` | Merge. |
| `skills/setup-lidessen-skills/commands/audit.md` | `commands/audit.md` | Merge. |
| `skills/setup-lidessen-skills/references/cross-cutting-principles.md` | `references/setup.md` | Preserve as setup-managed principles. |

### Enhancement Checklist

- Add `/attention-driven go` with a concrete daily loop:
  read `goals/GOAL.md` if present, scan recent record/open STOPs, name the
  principal tension, choose the layer, and close with a record draft when goal
  artifacts exist.
- Add `references/routing.md` so routing rules live in one place and command
  files do not duplicate cross-skill explanations.
- Add `references/artifact-policy.md` to encode the 30/70 rule and the
  "correct current state, do not repair history" policy.
- Add `commands/setup.md` as the replacement for `setup-lidessen-skills`,
  `design-driven init`, `evidence-driven init`, `reframe init`, and harness
  init wiring.
- Rename "evidence" to user-facing `fact` while preserving the evidence-driven
  discipline inside the reference.
- Update top-level project instructions that reference old skills.

### Verification

- Every source row in the migration coverage table has a target file in the new
  tree.
- `skills/attention-driven/SKILL.md` stays under 250 lines.
- No stale references to `/design-driven`, `/goal-driven`, `/evidence-driven`,
  `/reframe`, `/harness`, or `/setup-lidessen-skills` remain in active project
  instructions except explicit migration notes.
- Four dry-run prompts can be answered by the new skill without loading every
  reference:
  - "今天继续推进这个目标"
  - "我要改设计"
  - "这个实现怎么证明完成"
  - "给新项目 setup 这套规则"

### Three-Role Control Review Synthesis

Shared conclusion: engineering cybernetics should strengthen attention-driven
as a convergence and diagnosis posture, not as new source terminology or a new
phase.

Adopted from the engineering-control expert:

- complex work should name what is being steered and the primary metric;
- two failed corrections trigger assumption identification before more force;
- no-authority situations must route to harness, goal narrowing, or a blocker;
- mapping from source control terms belongs in a translation appendix.

Adopted from the skill author:

- protect `/attention-driven go` as the stable daily entrypoint;
- keep 30/70 above all imported theory;
- keep control analysis as a stuck-work diagnostic, not a required artifact;
- add a formalism trap for target/gap/correction checklists.

Adopted from the target user:

- ordinary `go` should present only `Mainline`, `Route`, and `Next move`;
- full stuck-frame diagnosis should appear only for noisy, recurring, blocked,
  or non-converging work;
- `current shape` needs examples across code, writing, research, and project
  steering;
- setup instructions should install a usable entry posture, not just concepts.

## Build

- Added `skills/attention-driven/SKILL.md` as the single methodology entrypoint.
- Added command files for `go`, `goal`, `design`, `fact`, `reframe`, `setup`,
  `audit`, and `close`.
- Added reference files for routing, artifact policy, goal, design, fact,
  reframe, harness, setup, templates, traps, writing guide, and cold review.
- Updated `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json`, and
  `skills/technical-article-writing/SKILL.md` to reference `attention-driven`.
- Removed the old independent `goal-driven`, `design-driven`,
  `evidence-driven`, `reframe`, `harness`, and `setup-lidessen-skills` tracked
  skill files so their metadata no longer competes with the merged entrypoint.
- Renamed the merged skill from `harness-driven` to `attention-driven` after
  strengthening the core 30/70 law: find the principal 30%, preserve it as the
  durable skeleton, and treat the remaining 70% of execution detail as flexible.
- Re-audited the old split skills source-by-source and restored compressed
  theory notes that were lost in the first merge pass. Added
  `references/migration-audit.md` as a temporary holding file for coverage notes
  and candidate future restores.
- Added the localized engineering-control lens in
  `references/control-loop.md` and connected it to `SKILL.md`, `go`, routing,
  artifact policy, design, and fact.
- Deepened the lens into an engineering work model while localizing the
  vocabulary: system boundary, target, observations, gap, authority,
  disturbances, settling conditions, multi-rate loops, feedforward plus
  feedback, observability/controllability, model identification, stability
  failure modes, robustness, and a scratch steering snapshot.
- Mapped the merged layers to local steering responsibilities: goal as target
  keeping, design as system-shape modeling, fact as observation, reframe as
  lens replacement, and setup/harness as continuity wiring.
- Added an anti-formalist learning rule: external theories and mature project
  forms must be understood as transferable operating principles, localized to
  the concrete control problem, and only then turned into local artifacts or
  actions.
- Corrected the engineering-control application itself to follow that rule:
  source terms like reference/plant/sensor/actuator are kept as translation
  scaffolding inside the reference, while SKILL.md, commands, routing, and setup
  instructions use local attention-driven language: target, current shape,
  observation, gap, correction, and continuity.
- Added `references/control-review.md` as the three-role review surface for
  method imports and major skill changes: engineering-control expert, skill
  author, and target user.
- Tightened `/attention-driven go` so ordinary work uses `Mainline / Route /
  Next move`; the fuller stuck frame is only for noisy, recurring, blocked, or
  non-converging work.
- Strengthened routing with no-authority handling, two-failed-corrections
  model identification, and one-off/repeated/structural disturbance handling.

## Verify

- `wc -l skills/attention-driven/SKILL.md` -> under the 250-line limit.
- `find skills -mindepth 2 -maxdepth 2 -name SKILL.md` shows only
  `article-refactor`, `attention-driven`, `technical-article-writing`, and
  `writing-profile` as active repo-local skills.
- `rg` over active instruction files and skills finds no stale old methodology
  entrypoints outside the migration blueprint and historical goal record.
- `find skills/attention-driven -type f` confirms the target command/reference
  tree exists.
- Core theory now lives in `SKILL.md` and `references/artifact-policy.md`, while
  command mechanics remain secondary.
- `references/migration-audit.md` lists every old tracked methodology file and
  its treatment in the merged skill.
- The localized engineering-control lens gives the merged skill an explicit
  feedback model: target, observation, gap, correction, disturbance, stability,
  and adaptation.
- Multi-rate control is explicit: fast execution/fact loops must not rewrite
  slow goal/design/setup artifacts without repeated evidence.
- Setup-managed instruction text now carries the localized responsibility
  mapping instead of listing the old layers as flat sibling concepts.
- The engineering-cybernetics reference now explicitly rejects copying forms:
  learn the spirit, translate it locally, then verify that the translated form
  improves control.
- Active entrypoints no longer present control-theory vocabulary as the form of
  the skill; they expose the localized steering vocabulary instead.
- Three-role review was run against the skill and its shared findings were
  incorporated into `go`, `routing`, `traps`, `control-loop`, setup managed
  wording, and the new `control-review` reference.
