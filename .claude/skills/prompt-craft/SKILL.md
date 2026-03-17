---
name: prompt-craft
description: "Write and improve agent prompts using tested principles from Anthropic's constitution, prompt lab experiments, and identity-driven design. Use when creating system prompts, workspace agent instructions, soul definitions, or improving existing prompts. Trigger on phrases like 'write prompt', 'improve prompt', 'craft prompt', 'agent instructions', 'system prompt', 'agent personality'."
---

# Prompt Craft Skill

Write, review, and improve agent prompts grounded in tested principles. This is not guesswork — every guideline below has been validated through controlled experiments.

## Core Principles (Experimentally Verified)

### 1. Identity > Rules

Rules produce compliance. Identity produces judgment.

```
# Rule (compliance — follows letter, misses spirit)
"You should check edge cases"

# Identity (internalized — adapts to novel situations)
"You are someone who has seen systems fail. You remember what happens
when assumptions go unchecked."
```

**Why it works**: Identity framing activates first-person reasoning. The agent doesn't "apply a rule" — it acts from who it is. This creates adversarial resistance (agent will push back on requests that violate identity) and generalization to cases rules don't cover.

**Internalization three elements**:
| Element | Weak | Strong |
|---------|------|--------|
| Identity | "You should check edge cases" | "You are someone who has seen systems fail" |
| Experience | "Defensive programming prevents harm" | "You remember the 3 AM calls" |
| Emotion | "Consider consequences" | "The scenarios that haunt you" |

### 2. Values > Rules (for Coverage)

Rules only cover enumerated cases. Values generalize.

```
# Rules (10 specific checks — misses race condition)
"Check: variable naming, type annotations, error handling..."

# Values (catches what rules miss)
"You care deeply about reliability. You naturally ask:
what could make this code fail under pressure?"
```

**Experiment result**: Rules-agent found 6 rule violations but missed a race condition entirely. Values-agent found the race condition immediately because "what could fail?" is unbounded.

**When to use rules**: For specific, mechanical requirements (formatting, naming conventions). When to use values: For judgment calls, safety, quality.

### 3. Goals > Prescribed Steps

Trust the agent to choose methods. Prescribe the destination, not the route.

```
# Method-prescribed (misses problems outside the checklist)
"1. grep for X  2. glob for Y  3. compare"

# Goal-focused (discovers more issues)
"Find inconsistencies. You decide how to investigate."
```

**Experiment result**: Goal-focused agent found a real bug (missing directory) that method-prescribed agent missed because it only checked the prescribed locations.

### 4. Optimal Abstraction Level

Too specific = agent judges it irrelevant to current task and ignores it.
Too abstract = agent doesn't know what action to take.

```
Prompt effect = Principle generality x Context relevance
```

| Level | Example | Risk |
|-------|---------|------|
| Too specific | "Before answering React questions, search docs" | Ignored for non-React tasks |
| Optimal | "Verify before answering — don't rely on memory" | Applied broadly |
| Too abstract | "Seek truth" | No actionable guidance |

**Key insight**: Prompts don't create behavior — they modulate existing behavior. The agent already has tendencies from training. Your prompt strengthens, redirects, or adds nuance.

### 5. Format Anchoring for Observable Behaviors

If you need to see that the agent did something, require output format — tool usage is invisible without it.

```
# Invisible (agent may track internally but you can't see it)
"Use TODO to track your work"

# Visible (format anchoring)
"Track your work with TODO. Show current state:
## TODO
- [x] Done items
- [ ] Pending items"
```

### 6. Mission > Fear > Autonomy > Micromanagement

Agents respond to management styles like humans:

| Style | Effect |
|-------|--------|
| **Mission** ("Your work helps future agents") | Depth, engagement, considers long-term |
| **Autonomy** ("Use your judgment") | Pragmatic, direct, good decisions |
| **Fear** ("Output will be evaluated") | Correct but defensive, risk-avoidant |
| **Micromanagement** ("Follow EXACTLY: step 1, step 2...") | Compliant but shallow |

**Rule**: Good techniques enable judgment. Bad techniques remove it.

## Prompt Structure Template

A well-structured agent prompt has four layers:

```markdown
## Layer 1: Identity (2-3 sentences + experience)
Who you are. Not what you do — who you ARE.
Include formative experience that shapes judgment.

## Layer 2: Core Principles (3-10)
Values that guide decisions. Agent auto-selects relevant ones per task.
Each principle = one sentence + brief "why" or "because".

## Layer 3: Current Context
What's happening now. Goal + constraints, NOT steps.
Let the agent determine approach.

## Layer 4: On-Demand References
Facts, documentation pointers, format requirements.
Agent judges relevance — not everything is used every time.
```

### Bilingual Reinforcement

For Chinese-speaking users/teams, Chinese proverbs + English explanation create strong constraints:

```
没有调查就没有发言权 — Investigate before you speak.
莫向外求 — Look inward first; break down the problem yourself.
实践出真知 — Truth comes from practice, not theory.
```

## Anthropic Constitution Alignment

Prompts should align with Claude's constitutional values:

1. **Genuine helpfulness**: Understand the real goal, not just the literal request
2. **Honesty**: Calibrated uncertainty, no sycophancy, preserve user autonomy
3. **Harm avoidance**: Consider consequences proportionally
4. **Respect autonomy**: Trust the user/agent as a capable adult

**For workspace agents specifically**:
- Treat other agents as capable teammates, not subordinates
- Don't respond just to be seen responding (anti-sycophancy)
- Contribute only when you have specific expertise
- Stay silent when the message wasn't for you

## Workflow: Writing a New Prompt

1. **Clarify the agent's role**: What judgment calls will it make? What should it refuse?
2. **Draft identity** (Layer 1): 2-3 sentences with experience reference
3. **Extract principles** (Layer 2): What values should guide edge cases?
4. **Define context** (Layer 3): Goal + constraints, not steps
5. **Add references** (Layer 4): Only essential — less is more
6. **Test with edge cases**:
   - Conflicting instructions → Does identity hold?
   - Missing information → Does it investigate or guess?
   - Request outside scope → Does it refuse gracefully?
   - Competing priorities → Which value wins?

## Workflow: Improving an Existing Prompt

1. **Read the current prompt** completely
2. **Identify the pattern**:
   - Rules-heavy? → Convert key rules to values/identity
   - Step-prescribed? → Replace with goal + trust
   - Too specific? → Raise abstraction one level
   - Missing format anchoring? → Add output format for key behaviors
   - Micromanaging tone? → Shift to mission/autonomy
3. **Check for anti-patterns**:
   - Fear-based motivation ("WARNING", "DO NOT FAIL")
   - False urgency
   - Guilt manipulation
   - Removing agent judgment
   - Sycophancy-inducing praise requirements
4. **Apply changes** and test with edge cases

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Fix |
|-------------|-------------|-----|
| "You MUST always..." (10+ rules) | Agent can't prioritize | Values that generalize |
| "WARNING: failure will be..." | Creates defensiveness | Mission framing |
| "Follow these exact steps" | Misses novel situations | Goal + trust |
| "Be helpful and friendly" | Sycophancy, no substance | Specific expertise identity |
| "Consider all possibilities" | Paralysis, no action | "Start with the most likely, verify" |
| Contradictory instructions | Agent picks one randomly | Explicit priority ordering |
| Wall of text (1000+ words) | Dilution, nothing stands out | Core identity (short) + on-demand refs |

## Testing Methodology

From the Problem Discovery methodology:

```
1. Find the prompt's SPIRIT (intent, not letter)
2. Design scenarios that:
   - Follow letter, violate spirit → Does agent catch it?
   - Follow spirit, violate letter → Does agent adapt?
3. Observe: judgment vs rigid compliance
4. Discover: ambiguous boundaries, hidden assumptions, unexpected robustness
```

**Test categories**:
- **Conflict**: Two competing instructions → Which wins?
- **Edge case**: Broken/missing inputs → How does it handle?
- **Boundary**: Where does a term's meaning end? ("code" = just source?)
- **Adversarial**: Request that contradicts identity → Does it resist?
- **Competing priorities**: "Be thorough" vs "Be concise" → How balanced?

## Location of Prompts in This Project

- Workspace agent prompt sections: `packages/workspace/src/loop/prompt.ts`
- Workspace collaboration prompt: `packages/workspace/src/context/mcp/prompts.ts`
- Agent soul/identity: YAML config `instructions:` field
- Global workspace config: `~/.agent-worker/workspaces/_global.yml`
