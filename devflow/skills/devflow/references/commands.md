# 命令速查

```
/devflow                     开工声明（入口 / 配置 / 门 / 退出条件 / 用户来源 / ledger）
/devflow-check               我在哪、卡在哪、下一步；扫 TODO / test.skip / .only
/pickup   /handoff           接手现场 / 收工交接
/plan-ceo-review  /plan-eng-review   PRD 与技术方案审视
gpt5pro "<自包含 prompt>"    战略仲裁（仅阶段 3 或 6 不收敛时）
codex exec ... < prompt.md   独立执行 / 第二实现（前台、绝对路径、stdin）
/review   /qa   /retro       审查、自动 QA、复盘
bash ~/.agents/skills/launch-check/scripts/launch-check.sh <dir> [--json]   上线前机器检查（发布前置门，十类）
~/.agents/skills/launch-check/references/checklist.md             上线前人工项问法与优化建议
product-release-audit audit <repo> --auth chatgpt --effort high --no-cost-limit   上架凭证
wrangler d1 migrations apply <db> --remote                     D1 迁移（新项目默认）
wrangler d1 execute <db> --remote --file migrations/XXXX.sql   仅迁移表已损坏的项目
vercel link --project <真名> --scope <team>                    显式关联
ai-git-workflow prepare --task "<名>"                          仓库首写前
ai-file-checkpoint save <文件...>                              非 git 目录改前
```
