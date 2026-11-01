# claude-code-plugins

A small Claude Code plugin marketplace from a daily heavy user: a development-process guard, a decision journal, and two interface mods (secret redaction and a task-ledger progress band).

These are the plugins I run every day. They are shared as working references, not as a polished product: read the code, keep what helps, change the rest.

| Plugin | Type | What it does |
|---|---|---|
| [`devflow`](devflow/) | skill + hooks + commands | A product-development process guard. When you say "build / fix / deploy", it asks for a 5-line kick-off statement, walks a 9-stage flow with three gates (self-use → others can use → paid), and denies, asks or warns on known incident commands: force push to `main`/`master`, secrets written into `wrangler.toml [vars]`, a bare `vercel link`, re-running `wrangler d1 migrations apply`. Includes `/devflow:start` and `/devflow:check`. |
| [`decision-tracker`](decision-tracker/) | skill | Records major personal decisions in four layers (raw input / decision facts / assumptions / outcome check), keeps an index and a pattern library, and quotes your own past lessons back when you log a new decision. Data stays in a local folder (default `~/.whylog`). |
| [`secret-shield`](secret-shield/) | mod | Before tool output (Bash, Read, MCP, WebFetch …) enters the conversation, replaces high-confidence credentials with placeholders. The model reads the masked version; your screen still shows the original. `/secret-shield on\|off\|status`. |
| [`tony-cockpit`](tony-cockpit/) | mod | Shows the open task ledger (`.omc/plans/*-todo.md`) progress and next item above the prompt, adds a `/ledger` side pane, and shows a toast at 80% context so you save state before compacting. |

## Install

```text
/plugin marketplace add shengdabai/claude-code-plugins
/plugin install devflow@tony
/plugin install decision-tracker@tony
```

The two mods (`secret-shield`, `tony-cockpit`) need Claude Code 2.1.286 or later and load from disk:

1. Clone this repository.
2. Add the mod folders to `CLAUDE_CODE_PLUGIN_DIRS` in the `env` block of `~/.claude/settings.json` (colon-separated absolute paths).
3. Interactive sessions reload on save. For `claude -p`, also set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`.

Check a mod with `claude plugin validate <dir>` and `claude plugin test <dir>`.

## Notes

- `devflow` was written for one person's workflow. Its rules mention tools and folders from that setup (for example a local complaint dataset or a `launch-check` skill). Treat those lines as examples and replace them with your own sources.
- Hooks only see Bash command strings and file writes. Deploys hidden behind `npm run deploy`, MCP calls or push-triggered CI are not intercepted.
- No plugin here sends data anywhere. `secret-shield` and `tony-cockpit` run locally inside Claude Code.

## 中文说明

一个 Claude Code 插件市场，是我每天在用的四个插件：

- **devflow**：产品开发流程守门员。说「开发 / 修 / 上线」就先写 5 行开工声明，按 9 阶段 + 三道门（自用 → 他人可用 → 付费）推进；遇到已知事故命令（force push 主分支、密钥写进 `wrangler.toml [vars]`、裸 `vercel link`、重跑 D1 迁移）时阻断、确认或提醒。
- **decision-tracker**：重大决策记录与复盘，四层拆解，记新决策时用你自己的历史教训提醒你；数据只存在本地目录。
- **secret-shield**（mod）：工具输出进入对话前，把高置信度凭据换成占位符。
- **tony-cockpit**（mod）：输入框上方显示当前任务台账进度，`/ledger` 侧栏，上下文到 80% 时提醒先落盘。

安装方法见上方 Install。devflow 的规则里有作者本机的工具名和目录，当作示例，按你自己的环境替换。

## License

MIT, see [LICENSE](LICENSE).
