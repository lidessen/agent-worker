# Reframe Reference

Reframe is for categories whose shape is not stable enough for design.

## Fit

Use reframe for AI-native systems, agent-first interfaces, post-mobile
categories, or any work where the old paradigm keeps sneaking in as the
skeleton.

Do not use it for normal feature design, incremental redesign, or vague "make
it AI" requests. Use design when the shape is already stable enough to describe.

## Phases

1. Name the target and the old paradigm.
2. Extract 3-5 abstract functions.
3. Redraw the skeleton from new primitives.
4. Stress-test without traditional crutches.
5. Mine mature domains for transferable patterns, not copied shapes.
6. Add familiar flesh only as projection.
7. Run a comprehension test.
8. Close, graduate, abandon, or supersede.

## Skeleton / Flesh

Skeleton is the load-bearing abstract function set. Flesh is the surface a user
sees. Most "AI-native" failures rebuild flesh while leaving the old skeleton in
place. A real reframe reconstructs the skeleton from new primitives first; any
familiar surface later is only projection.

Flesh governance:

- Familiarity is fine; mimicry is suspicious.
- Every flesh element must name the skeleton state it projects.
- Flesh never adds capability the skeleton lacks. If it tries to, revise the
  skeleton instead.

## Transfer Learning

Mature domains often solved isomorphic problems. Mine for patterns, not shapes.
For each candidate transfer, ask what abstract problem it solved and whether
this domain faces the same abstract problem. Record deliberate non-transfers to
prevent re-litigation.

## Concept Artifacts

Use `concepts/<target>.md` when exploration spans sessions. Keep the file as a
working sketchbook, not a polished architecture doc.

When a concept stabilizes, graduate its load-bearing skeleton into design via
`design/DESIGN.md` or a design decision. After graduation, reframe steps out.

## Evidence

Stress-test and comprehension-test verdicts need fact observations. "It held"
without an observation is not enough.

Stress-test outcomes are: holds, bends, collapses. Collapse is not failure; it
may reveal the boundary where the new paradigm does not help.

Comprehension failures have three different feedback paths:

- flesh problem -> revise projection;
- skeleton problem -> revise skeleton;
- essence problem -> revise abstract functions.

Misdiagnosis turns the loop into cosmetic iteration.

## Relationship to Goal

Goal runs parallel as the destination compass. A reframe pivot can trigger a
goal STOP if it changes what success means.
