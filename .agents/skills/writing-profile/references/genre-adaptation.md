# Genre adaptation — how downstream writing skills consume the profile

Consumer contract for any genre-specific writing skill (technical-article-writing, and future blog/diary/essay skills). Defines how to read `~/.claude/writing-profile/profile.md` and apply genre-specific modulation so the finished piece sounds like *this user writing in that genre*, not generic AI output.

## Separation of concerns

- **profile.md** owns the **stable voice baseline** — the 7-dim vector and the user's personal `机械反 AI 清单`. Genre-agnostic.
- **Each genre skill** owns a **modulator recipe** — how this genre shifts, clamps, or amplifies each axis, plus any genre-specific dims profile doesn't cover.
- The composed result is the **effective voice spec** for one piece. It informs drafting (soft) and drives revision's mechanical pass (hard).

Profile doesn't change to fit a piece. Modulation is where genre adaptation lives.

## What profile.md exposes

The `## 坐标` YAML block is the machine contract:

```yaml
S_N, T_F, E_I, J_P, D_L, G_H, C_V   # 7 signed ints, -10..+10 (C_V may be null)
classical_exposure                   # high | medium | low
type, subtype_cn, archetype
confidence                           # per-axis
```

Plus `## 机械反 AI 清单` — three parts: **必删**, **必审查**, **保留 / 鼓励**. Everything else in profile.md is human-facing; only the 坐标 block and the 机械反 AI 清单 are consumed programmatically.

## The three modulation operations

A genre modulator defines, per axis, zero or more of:

### Clamp — set floor or ceiling, leave user value alone in-range
```
G_H: clamp_min -3        # even if user is -8 (strong 反讽), don't drop below -3 in this genre
J_P: clamp_max +8        # cap closure to avoid forced tidiness
E_I: clamp_min 0         # must address reader — no pure 朝内
```
Use for **hard floors/ceilings** the genre imposes regardless of user preference.

### Shift — additive offset
```
E_I: shift -3            # diary nudges toward I by 3
S_N: shift +1            # argumentative genres skew slightly abstract
```
Use when the genre **nudges** without overriding. User's natural end still comes through.

### Amplify — scale the user's existing signal
```
J_P: amplify 1.3         # user J+4 → J+5.2; user P-4 → P-5.2
```
Use when the genre **doubles down** on whichever side the user leans. Rare — clamp or shift is usually cleaner.

**Apply order**: amplify → shift → clamp. Clip final result to [-10, +10].

## Genre-specific additional dims

Some knobs are only meaningful within a genre, so profile doesn't carry them. Each genre skill picks which extras apply:

| Dim | Range | Example use |
|-----|-------|-------------|
| `formality` | -5..+5 | technical article ~+3; diary ~-3 |
| `pronoun_density` | low / medium / high | first-person frequency |
| `technical_density` | low / medium / high | jargon-to-prose ratio |
| `hedge_floor` | 0..5 | minimum allowed hedges per 1000 words (usually 0) |
| `address_register` | reader / self / observer | who the text speaks to |

## Two-pass application

### Draft-time — soft guidance
The effective voice spec informs drafting taste, not rule-by-rule checks:
- Rhythm and sentence-length variation (`D_L` + `G_H`)
- Hedge density (`T_F` + genre's `hedge_floor`)
- Abstraction level (`S_N` + genre's `technical_density`)
- First-person frequency (`E_I` + genre's `pronoun_density`)
- Closure vs openness at section endings (`J_P`)

Hold the spec in mind while writing; don't tick boxes.

### Revise-time — hard mechanical pass
In the genre skill's revision phase, run in this order:

1. **Profile's `机械反 AI 清单` verbatim** — 必删 delete, 必审查 flag-and-rewrite, 保留 skip even if it looks odd. This is user-specific and runs for every genre.
2. **Genre-specific mechanical list** (if the genre skill defines one) — additions particular to this genre.
3. **Axis spot-check** — if a whole section trends against user preference on a primary axis (sentence-length distribution for `D_L`; hedge count for `T_F`; first-person ratio for `E_I`), flag for rewrite.

Run after prose-level revision, not before.

## Fallback when no profile exists

If `~/.claude/writing-profile/profile.md` is absent:

1. Tell the user once, near the start: *"No writing profile found. Output will use generic defaults; run `/writing-profile` to calibrate."*
2. Proceed with genre defaults only — skip baseline modulation, use the genre's native voice assumptions.
3. Don't auto-run the profile skill. Suggest, don't force.

## Worked example — technical article for `ENTP-R · 杂文家`

Baseline from profile.md:
```
S_N +7, T_F +3, E_I +5, J_P +6, D_L +8, G_H -7, C_V -3
```

Technical-article modulator:
```
S_N: shift +1            # argumentative → more abstract
T_F: shift +1, clamp_min 0
E_I: clamp_min +1        # reader-addressed
J_P: shift +1            # closure bias
G_H: clamp_min -3        # pull irony back from -7 toward -3
formality +3, pronoun_density low, technical_density high
```

Effective spec:
```
S_N +8, T_F +4, E_I +5, J_P +7, D_L +8, G_H -3, C_V -3
formality +3, pronoun_density low, technical_density high
```

Produces: dense, abstract, structured prose that argues confidently. Irony pulled from the user's natural -7 to an article-appropriate -3 — dry wit over sustained sarcasm. First-person low but not zero. Formal without going academic.

## Contract for genre skill authors

A genre writing skill that integrates with writing-profile should:

1. **Load** `~/.claude/writing-profile/profile.md` at the start of its voice-calibration phase.
2. **Define** its modulator recipe (clamp/shift/amplify per axis + extras) in its own `references/` file — keep SKILL.md under 500 lines.
3. **Compose** the effective voice spec by applying the recipe to the baseline.
4. **Use** the spec for drafting (soft) and revision's mechanical pass (hard).
5. **Run** profile's `机械反 AI 清单` verbatim in revision; optionally add a genre-specific list.
6. **Fall back** gracefully if profile.md is absent.
