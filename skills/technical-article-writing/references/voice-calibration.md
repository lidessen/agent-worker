# Voice calibration — technical-article-writing modulator

The modulator recipe this skill applies to the user's baseline profile. Read alongside [../../writing-profile/references/genre-adaptation.md](../../writing-profile/references/genre-adaptation.md), which defines the clamp/shift/amplify framework.

## Modulator recipe

Apply to the 坐标 block from `~/.claude/writing-profile/profile.md`. Order: amplify → shift → clamp. Clip final values to [-10, +10].

| Axis | Operation | Reason |
|------|-----------|--------|
| S_N  | shift +1                  | argumentative writing skews slightly abstract — concepts carry the chain |
| T_F  | shift +1, clamp_min 0     | reasoning chain needs a logical stance; no pure 感受 mode |
| E_I  | clamp_min +1              | article must address a reader; pure 朝内 becomes a journal entry |
| J_P  | shift +1                  | articles land a claim — closure bias |
| D_L  | no change                 | follow user; density is personal rhythm, not a genre requirement |
| G_H  | clamp_min -3              | dry wit OK; sustained irony undermines argumentative weight |
| C_V  | no change                 | follow user; 文白 is personal taste, genre-neutral |

## Genre-specific extras

```yaml
formality: +3           # mid-to-high; not academic, not conversational
pronoun_density: low    # first-person for stances only, not throat-clearing
technical_density: high
hedge_floor: 0          # never add hedges; profile's 清单 controls removal
address_register: reader
```

## How the effective spec shapes drafting

When drafting each section, hold the composed spec in mind — taste calibration, not a checklist.

- **Hedges** — `T_F` shifted toward logic + `hedge_floor 0`: state claims directly. When a claim is contested, follow Phase 5's "X is true. Some argue Y, but Z." pattern. Never pad with "perhaps" / "one could argue."
- **Abstraction level** — `S_N +1` shift pulls toward concept, but Phase 4's concrete-detail rule wins at sentence level. Abstract scaffolding, concrete examples.
- **First-person** — `pronoun_density low`: "I" is reserved for stance moments ("I think the standard framing misses..."), not throat-clearing ("In this article, I will...").
- **Irony** — `G_H clamp_min -3`: user's natural wit comes through in word choice and dry asides, not in load-bearing argument moves. If the profile has user at G_H -7, this is the biggest gap to notice.
- **Closure** — `J_P` shift +1: section endings land. Revisit Phase 3's "end sections with forward motion" with extra weight on the landing half.
- **Rhythm** — follows user's `D_L` directly. If user is strong L (疏朗), don't pack the piece dense just because it's "technical."

## Revision mechanical additions

Applied in Phase 7's sentence pass **after** profile's `机械反 AI 清单` runs (profile's list is user-specific and always wins first). These are technical-article-universal.

### Must delete
- "本文将探讨..." / "In this article we will..." — cut; title + first sentence already do this
- "值得注意的是" / "it is worth noting" — cut unconditionally
- "综上所述" / "in summary" / "总而言之" — restructure; the claim should land without signaling
- "某种程度上" / "to some extent" when not qualifying a specific thing — cut

### Must audit
- Any paragraph opening with "Moreover / Furthermore / Additionally / 此外" — usually signals a missed structural beat; rewrite the transition per Phase 3
- Three-part parallels in the thesis sentence — break into prose; parallelism is decorative here, not argumentative
- Jargon introduced without grounding in the first 20% of the piece — either define on first use or replace with the concrete thing (Phase 5 audience rule)
- Sections ending on a hedge ("这或许值得进一步思考") — rewrite to land or delete; `J_P` bias demands closure

### Keep even if it looks odd
- Short punch sentences after long builds — rhythm, not terseness bug
- Dry asides in parentheses — user's natural wit; don't polish away
- First-person stance sentences — if the user is `E_I` positive, leave them

## Fallback when no profile

If `~/.claude/writing-profile/profile.md` is missing:

1. Note once to the user: *"No writing profile found. Output will use generic defaults; run `/writing-profile` to calibrate."*
2. Use the extras above as-is (`formality +3`, `pronoun_density low`, etc.) plus neutral baselines on the 7 axes.
3. Skip the profile-specific 机械反 AI 清单; still run the genre-specific mechanical list above.
4. Don't auto-run `/writing-profile`. Suggest, don't force.
