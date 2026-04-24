# plan — Meta-intake and test plan generation

> **这是子阶段文件，不直接面向用户**。由 `commands/dispatch.md` 在首次启动时调用。用户不应该直接触发 plan——他们只用 `/writing-profile` 无参数，dispatch 会自动 plan → W1 → …

Generate a customized test plan based on a short meta-interview. Write the plan to `~/.claude/writing-profile/state.md`.

The plan stage is brief (5–10 minutes). Do not start scoring dimensions here — that happens in `run-unit` (which dispatch calls after plan). The goal here is only to calibrate the subsequent runs to the user's literary background.

## Process

### 1. Check for existing state

Check whether `~/.claude/writing-profile/state.md` exists.

- **Doesn't exist** → proceed to step 2.
- **Exists and no units complete** → ask if the user wants to regenerate (meta-intake answers may have changed). If yes, archive to `state-<YYYYMMDD-HHMM>.md.bak` and proceed.
- **Exists and some units complete** → warn that regenerating will not re-ask already-completed units but will update calibration flags. Offer `/writing-profile show` instead.

Create `~/.claude/writing-profile/` and `~/.claude/writing-profile/units/` directories if they don't exist.

### 2. Run meta-intake (5 questions)

Ask these conversationally, one at a time, waiting for each answer before asking the next. Do not present them as a form. Do not explain the dimensions yet.

1. **阅读日常** — 你大致每周读些什么？(古文/现代散文/小说/诗歌/技术书/网络文章/都差不多……随便说)
2. **写作日常** — 你平时写得最多的是什么？(技术文章/博客/日记/评论/小说/工作文档……)
3. **古典接触度** — 对古典文学（唐诗宋词、古文、四大名著）的接触深度？(熟读/略知/基本没读/特别讨厌)
4. **翻译比例** — 你读的书里翻译文学和原创汉语的比例大致如何？
5. **反感谱系** — 有没有读到就烦的作家或类型？(老实说，不会用来判断你)

### 3. Infer calibration flags

Translate the answers into flags that will adjust each dimension's test strategy.

**古典暴露度是首要门控**——它决定 W7 走哪条路径 **以及 W7 在 state.md 里的初始状态**，必须在 plan 阶段定下来：

| 古典接触自陈 | classical_exposure | W7 路径 | state.md 初始状态 |
|-----------|--------------------|---------|-------------------|
| "熟读古典" or 能随口背古诗古文 | high | 路径 A（标准 12 题） | `[ ] not started` |
| "略知" or 读过几本但不精 | medium | 路径 C（degraded 6 题） | `[ ] not started [degraded]` |
| "基本没读" or "特别讨厌" | low | 路径 B（skip，C_V 标 null）| `[-] skipped` |

**关键**：低暴露用户在 plan 阶段就把 W7 标为 `[-] skipped`，dispatch 永远不会把他们拖进 W7。`[-]` 状态计入"全部完成"判定，6 个其他单元完成后就能直接 finalize。

`classical_exposure` 本身不进入类型构念（它不是偏好，是背景），但会作为独立字段写入 state.md（供 dispatch 决策）和 profile.md（供下游 skill 参考）。

**其他 calibration 影响**：

| 用户情况 | 影响的维度 | 调整 |
|---------|-----------|------|
| 翻译文学阅读占比高（> 50%） | W3, W4 | 锚点作家扩充翻译家（王佐良、余光中、木心；或引用翻译腔对照） |
| 特别讨厌某位作家 | 全局 | 记下来：不要用该作家作**正向**锚点，可作为对照使用 |
| 技术文章是主要写作 | W3, W4 | 锚点多用文学散文（测他们非工作写作时的本心），不用技术博客（会偏 J） |
| "都差不多/什么都读" | 全局 | 不做特别调整，按默认计划 |
| 从不读诗歌 | W5, W6 | 避免大量使用古诗做锚点；改用散文/小说节选 |

### 4. Generate state.md

Write `~/.claude/writing-profile/state.md` following the structure in `assets/state-template.md`. Fill in:

- **Timestamp** — both creation and last-updated
- **Meta-intake answers** — verbatim, not paraphrased
- **Calibration flags** — the list derived in step 3
- **Unit list** — all 7 dimensions, each marked `[ ] not started`, with per-unit notes if calibration affected it (e.g. `W7 [degraded: 6 questions, modern anchors only]`)
- **Target question count** — default 84 (7 × 12), adjusted by any flags; note the soft-floor (60) and hard-cap

Use the file verbatim as your schema — don't improvise structure.

### 5. Report and return control to dispatch

一段简短汇报（不要问"要不要开始"——那是 dispatch 的决定）：

> Plan ready. 7 维度，约 84 题。可随时中断，下次 `/writing-profile` 会自动接着跑。
> {{若 W7 被标为 skipped，追加一句：古典暴露度低，W7 已标为跳过；实际约 72 题。}}

然后**立即把控制权交还 dispatch**——dispatch 看到 plan 已完成、没有 in-progress 单元、有未跑单元（首个是 W1），会自动走 C 路径进入 W1。plan 不做分支、不等确认。

这和 dispatch.md 路径 A 的"不提问直接进 W1"保持一致：**dispatch 调用 plan 是首次启动流程的一环，plan 不是独立命令**。用户已经通过 `/writing-profile`（无参）表达意愿了，不需要二次确认。

## Notes for the agent

- Do not over-explain what the dimensions are during plan. The user will find out as they run each one. Over-explaining biases their answers.
- If the user seems confused about a meta-intake question, give a one-line example, not a rationale lecture.
- Do not describe the type archetypes (学院派 etc.) at plan stage — those are a finalize reveal.
- Tone: light, quick. This should feel like a short chat, not a bureaucracy.
