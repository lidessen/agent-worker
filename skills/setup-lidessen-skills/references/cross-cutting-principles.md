<!--
This file is the canonical source of cross-cutting principles for the lidessen skills collection. The content from below this comment is what `setup-lidessen-skills` copies verbatim into target-project harness configs between paired `<!-- lidessen-setup:* -->` markers. Edits to this file propagate to all consumers on next `/setup-lidessen-skills sync`. The lidessen/skills repo itself dogfoods this — its own CLAUDE.md "Guiding Principles" section is injected from this file.

When adding or modifying a principle: keep each one self-contained (a downstream consumer must be able to act on it without further context), and bump the version marker that `setup-lidessen-skills` tracks so consumers know to sync. Section heads are at `###` (h3) level, intended to nest under a user-owned `## Guiding Principles` (h2). Adjust depth at copy time only if the consumer's layout demands it.
-->

### Principles over rules

Skills should help agents understand *why*, not just specify *what*. A skill that explains reasoning and principles produces better judgment across novel situations than one that mechanically lists rules. Favor broad principles over rigid prescriptions — give the agent enough context to generalize, not just enough rules to comply. ([Anthropic's constitution](https://www.anthropic.com/constitution): "If we want models to exercise good judgment across a wide range of novel situations, they need to be able to generalize — to apply broad principles rather than mechanically following specific rules.")

### Hierarchical context management

Agent context is finite — structure it in layers: L1 (architecture, always present), L2 (design, on activation), L3 (implementation, on demand). The higher the layer, the smaller and more stable. Keep SKILL.md under 500 lines; split details into supporting files. See the [harness skill](skills/harness/SKILL.md) for the full methodology and the [Agent Skills Specification](https://agentskills.io/specification#progressive-disclosure) for the underlying spec.

### Design for finite human bandwidth

Agent throughput keeps rising; human review capacity doesn't. When designing a skill or shaping any output that lands in front of a human, treat the output like code architecture: humans review the skeleton (the 20% whose failure invalidates the rest), agents own the details within, and details should be cheap to throw out without disturbing the skeleton. Generalizes design-driven's 30/70 to all agent-human collaboration. See [harness Part III](skills/harness/SKILL.md) for the full principle and consequences.

### Principal contradiction first

When a task has many decisions or moving parts, agents drift unless something forces sequencing. Identify the *principal contradiction* — the load-bearing decision whose resolution changes the shape of all downstream work — and lock it before drafting details. Operational test (cascade): for each candidate, ask "if this is wrong and the rest is right, does the rest still hold?" If no, it's principal; lock it first. If yes, it's secondary; defer. The same logic recurs across this repo at different layers — design-driven's 30/70 (skeleton vs flesh), goal-driven's General Line (destination before path), reframe's 3-5 abstract functions (essence before shape). This principle adds the *execution layer*: within a single task, locate the load-bearing decision before drafting downstream artifacts. Roots in Mao's [On Contradiction](https://www.marxists.org/reference/archive/mao/selected-works/volume-1/mswv1_17.htm) — the principal contradiction's existence and development determines the form of the others; grasp it and "纲举目张" follows. Re-evaluate at transitions: once the principal is resolved, the next layer's contradiction may become principal.
