---
description: 开工声明 — 按 devflow 定模式 / 入口 / 能力勾选 / 风险级别 / 当前门 / 退出条件 / 用户证据，写进 ledger 后开始
argument-hint: <要做的事，一句话>
---

Skill 加载 `devflow`。对「$ARGUMENTS」执行：

0. `$ARGUMENTS` 为空：先从当前对话最近一条开发意图取任务;仍取不到就只问一句「这轮要做什么(一句话)」,不展开其他问题。

1. DF-00 定模式。讨论或只读审核 → 直接按流程给判断，不建 ledger，结束。
2. 执行 / 计划 / 发布 → DF-01 五行开工声明。入口 B 先看 `git status --short --branch`、`.omc/handoffs/HANDOFF.md`、`.omc/plans/*-todo.md`；非 git 目录用 README / TESTING / _review 定位阻碍；区分 B1 修复 / 恢复与 B2 新增能力。
3. 勾能力（服务端 / 登录 / 支付 / 数据库 / 公开交付），按 DF-03 定风险级别。
4. 写退出条件与验证层；B2 / A 写首批用户来源，B1 / C / 纯自用填 N/A + 理由。
5. 新建或续用 `.omc/plans/<name>-todo.md`，声明放顶部，本轮 ≤ 5 项。然后直接进入对应阶段动手，不等确认；缺退出条件或用户来源时只问这一项。

输出:先给 5 行开工声明(C 小改 / B1 修复可只给前两行 + 退出条件),再给 ledger 路径。ledger 写入失败(目录只读、路径不存在)时把声明原样贴在回复里并说明未落盘原因,不假装已写入。
