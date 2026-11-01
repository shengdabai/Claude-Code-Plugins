# devflow — Tony 的产品开发流程守门员

说「开发 / 编程 / 写代码 / 做个产品 / 修 bug / 上线 / 部署」就按流程走；偏离就拉回。真源在 `skills/devflow/SKILL.md`（规则版本见文件头），三端共用。

## 三端如何生效

| 端 | 机制 | 能做什么 |
|---|---|---|
| Claude Code 终端 | 插件（skills-dir 自动加载或 marketplace 安装）：skill + UserPromptSubmit 路由 hook + PreToolUse 守门 hook + 2 个命令 | 关键词候选 → 模型定模式 → 开工声明；事故命令 deny / ask / 提醒；完成前扫描 |
| Codex CLI | `~/.codex/skills/devflow` 软链到同一 skill 目录；`~/.codex/hooks.json` 里同一个 `devflow-router.py` 挂 UserPromptSubmit；AGENTS.md 一行入口 | 同上，但 Codex 侧没有 PreToolUse 守门（Codex hooks 只挂了路由），命令级阻断靠 skill 自律 |
| ChatGPT / Claude 客户端 | `client-instructions/*.md` 粘贴进 Project 指令（由脚本从 SKILL.md 生成） | 只做讨论 / 只读审核 / 计划，执行回终端 |

## 安装与更新

```bash
# Claude Code：已软链为 skills-dir 插件，新会话自动加载为 devflow@skills-dir
ls -la ~/.claude/skills/devflow
# 或 marketplace 方式
claude plugin install devflow@tony
# 改了 hooks/ 后在会话里 /reload-plugins；改 SKILL.md 即时生效

# Codex：软链 + hooks.json（已配置）；修改 hooks.json 后 Codex 可能要求重新信任 hook
ls -la ~/.codex/skills/devflow

# 客户端指令：改 SKILL.md 的 CLIENT 段后重新生成
python3 scripts/build-client-instructions.py
```

## 命令

- `/devflow:start <一句话>`：定模式 → 开工声明 → 建 ledger → 开始
- `/devflow:check`：我在哪、卡在哪、能不能说完成（含 TODO / test.skip 扫描与证据时效核对）
- 发布前置门：`launch-check` skill（`~/.agents/skills/launch-check`，各 AI 技能目录软链）。阶段 8 之前跑 `bash ~/.agents/skills/launch-check/scripts/launch-check.sh <dir>`，十类上线前检查逐项给结论与优化建议，有 FAIL 即 NO-GO；它不替代 `product-release-audit` 的发布拦截。

## 关闭

环境变量 `DEVFLOW_OFF=1`，或消息里写「不走流程」。

## 边界（诚实说明）

- hook 只看得到 Bash 字符串与文件写入；`npm run deploy` 之类封装只提醒不阻断，MCP / 平台 API / push 触发的自动部署看不到。
- 「继续」「按刚才方案做」不靠关键词，靠会话里已有的任务状态。
- hook 判断证据文件是否存在，不能证明内容真实；需求是否真实、架构取舍是否合理，仍靠模型 + 人。

## 文件

```
devflow/
├── .claude-plugin/plugin.json
├── skills/devflow/SKILL.md            ← 真源（含 CLIENT 段）
├── skills/devflow/references/{failures.md, commands.md}   ← failures #26–#28 来自 2026-10 行业事件
├── (外部) ~/.agents/skills/launch-check/   ← 发布前置门，阶段 8 引用
├── hooks/{hooks.json, devflow-router.py, devflow-guard.py}
├── commands/{start.md, check.md}
├── scripts/{devflow-scan.sh, build-client-instructions.py}
└── client-instructions/{chatgpt-project.md, claude-project.md}   ← 生成物
```

