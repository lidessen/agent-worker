# retest — Redo all or part of the assessment

`/writing-profile retest [W<N>]` 重做测试。

- 无参数 → **全部重测**（破坏性：归档旧 state/units/profile，重跑 plan + 7 维。需二次确认）
- `W1` / `W2` / … / `W7` → **单维度重测**（别名；等价于直接 `/writing-profile W3`）

这是"**重做**"的入口，区别于裸调 `/writing-profile`（首次建 or 继续中）。想彻底清掉画像但又不想马上重测，直接 `rm -rf ~/.claude/writing-profile/` 即可。

## 参数路径

### A. `retest W<N>` — 单维度重测

直接把控制权交给 `references/phases/run-unit.md`，参数为 `W<N>`。run-unit 已经处理已完维度的 retest 二次确认——别重复问。

行为与用户直接打 `/writing-profile W<N>` 完全一致；本路径只是命名更直观。

### B. `retest`（无参数）— 全部重测

**破坏性操作，必须二次确认**。流程：

#### 1. 判断当前状态

读 `~/.claude/writing-profile/`：
- 什么都没有 → 告知 "尚未建画像，不需要 retest。用 `/writing-profile` 直接开始。" 退出。
- state.md 存在但未完成 → 告知 "测试尚未完成。继续进行中的测试用 `/writing-profile`；如果确实想从头再来继续用 `retest`。" 然后继续流程。
- profile.md 已 finalize → 正常流程。

#### 2. 展示将要清除的内容

```
## ⚠️ 即将全部重测：
- 当前画像：ENTP-R · 杂文家（2026-04-18 finalize）
- 所有 7 个维度测试结果会被归档
- 旧 profile.md 会归档到 ~/.claude/writing-profile.<timestamp>.bak/
- 建完新画像前，下游 skill（technical-article-writing 等）仍读旧 profile.md 直到 finalize

预计耗时：~30 分钟（和首次相当）
```

如果只是对某个维度不满意，提示："只想调单个维度？`/writing-profile W<N>` 更快。"

#### 3. 要求显式确认

不接受"行"/"可以"这类模糊同意。要用户打"确认 retest"或"yes, retest all"。含糊 → 取消，不动文件。

#### 4. 执行

归档（不直接删）旧数据：

```
mv ~/.claude/writing-profile  ~/.claude/writing-profile.<timestamp>.bak
mkdir ~/.claude/writing-profile
```

告诉用户备份路径。

#### 5. 交接给 plan 阶段

归档后，把控制权交给 `references/phases/plan.md` 开始 meta-intake。告诉用户 "已归档，现在开始重新计划。" 然后立刻进入 plan 流程，不要让用户再敲一次 `/writing-profile`。

plan 完成后按正常 dispatch 路径（跑 W1 → W2 → …）。

## 不做的事

- **不在 `retest` 流程里手动跑每个维度**——交给 plan + dispatch，它们已经会按顺序处理
- **不静默执行全部重测**——必须二次确认
- **不清掉 skill 自身的方法论文件**——只动 `~/.claude/writing-profile/`
- **用户想"清掉但不马上测"不通过本命令**——直接告诉他们 `rm -rf ~/.claude/writing-profile/` 比起设计多一个命令更简单
