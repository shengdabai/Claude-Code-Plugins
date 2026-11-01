---
description: 我在哪、卡在哪、能不能说完成 — 核对 devflow 阶段退出条件，扫 TODO / test.skip / .only，核证据是否随代码改动失效
allowed-tools: Bash, Read, Grep, Glob
---

Skill 加载 `devflow`。对当前项目执行：

1. 读 `.omc/plans/*-todo.md` 顶部声明与 `.omc/handoffs/HANDOFF.md`（有则读），复述模式 / 入口 / 能力 / 风险级别 / 当前阶段 / 退出条件。没有声明就先按 `/devflow:start` 补。
2. 运行 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/devflow-scan.sh"`，列出改动文件里的 TODO / FIXME / test.skip / .only / 未实现分支。
3. 核证据时效：ledger 里每条证据的代码摘要（git HEAD 或文件哈希）与当前是否一致；不一致标「已失效，需重跑」。
4. 对照 DF-05 当前阶段退出条件，逐项给 PASS / REVISE / WAITING / STOP / N/A 与依据。
5. 对照 DF-06 指出正在偏离的信号（若有）。
6. 结论三选一：可以说完成 / 还差 N 项（列出，区分未跑、失败、明确跳过）/ 应回到阶段 X。下一步一句话。
