# 失败根因 28 条（#1–#25 本机真实案例，#26–#28 为 2026-10 行业事件与风险情景）与命令模式

| # | 现象 | 根因 | 谁 | 预防 | 出处 |
|---|---|---|---|---|---|
| 1 | 会话假死、任务反复暂停 | 工具调用写成文本 | AI | 每个动作必须有真实工具调用回执；恢复 `claude --continue` | KDP / 插件更新 |
| 2 | 账户多出空项目、env 指错 | 裸 `vercel link`，目录名 ≠ 项目名 | AI | 显式 `vercel link --project <真名> --scope <team>` | daily-brief ↔ chinese-daily-use |
| 3 | 生产数据被迁移重跑破坏 | Z Turns Go 生产迁移表为空，`d1 migrations apply` 从 0001 重跑 | 人 + AI | 该项目人工 `d1 execute --remote --file`；新项目正常用 `migrations apply` | Z Turns Go |
| 4 | 未审核代码上线 | Codex 越权部署 | AI | 发布阶段禁止 Codex 部署；上架门 hook | Lesson Recap |
| 5 | 支付事件丢失却返回成功 | webhook 缺密钥静默 200 | AI | 缺配置即 500 | HSK |
| 6 | 用户能改任意题答案 | itemId 未绑定 session（IDOR） | AI | 归属校验进每条查询 | HSK |
| 7 | RLS 形同虚设 | 全走 service-role | 人 + AI | 用户态 client 或文档化信任边界 | HSK |
| 8 | 并发重复提交 / 重复发放 | check-then-write 无原子性 | AI | 唯一约束 + 事务 / CAS | HSK / Lesson Recap |
| 9 | 快照重启即丢 | 存 globalThis | AI | 落表 | HSK |
| 10 | 限流不起作用 | 内存 Map 多实例 | AI | Upstash / D1 表 | HSK / Z Turns Go |
| 11 | 代码跑不起来 | 沙箱无 Node globals | AI | 先列可用 API 再写 | n8n / MV3 / Workers |
| 12 | 「改好了」但页面没变 | 只看源码或截到旧版 | AI | Playwright 三视口 + cache-buster + 等部署 | zturnsgo |
| 13 | 后台 codex / agy exit 127 | PATH 丢失 | AI | 前台 + 绝对路径 | 通用 |
| 14 | 密钥进 git | 写进 wrangler `[vars]` | 人 + AI | 平台 Secret / 钥匙串；env-guard | Z Turns Go 规则 |
| 15 | 交付后发现没做完 | TODO / test.skip / 桩 | AI | 交付前扫改动文件 | 最高规则 4 |
| 16 | compact 后在错分支干活 | 现场只在聊天里 | 人 + AI | ledger + handoff / pickup | 通用 |
| 17 | 两个模型都同意但都错 | 幻觉共识 | 人 + AI | 每个结论对应一条测试或代码事实 | 协作协议 |
| 18 | MVP 越做越大 | 没有真实 Won't；登录支付提前 | 人 | MoSCoW；三道门 | Lesson Recap / HSK |
| 19 | 收款平台过审后换站被拒 | 不了解 MoR 规则 | 人 | 先读平台规则再定域名 | Waffo |
| 20 | 生成图片带杂形 | 无机器判据 | 人 | 视觉逐张过目 | 香蕉插画 |
| 21 | 代码全绿却上不了线 | 非编码墙钟没提前启动 | 人 | 阶段 2 并行启动清单 | Lesson Recap |
| 22 | 默认上网抓站跑偏 | 没先查本地数据系统 | AI | 本地优先 | CLAUDE.local |
| 23 | 13 个产品全 PASS，用户 0 | 流程里没有「谁去找用户」；测试通过当完成 | 人 + AI | Must 第一项写用户来源 + 首条招募消息记录；门 1 证据文件 | 28-可盈利产品矩阵 |
| 24 | 入口 B 第一步就断 | 假设既有项目都是 git | AI | 非 git 走 ai-file-checkpoint | 28 号目录 |
| 25 | 演示密钥留在上线源码 | 客户端 License Key 硬编码 DEMO_KEY | AI | 打包门拒绝含演示密钥的构建 | DevShot |
| 26 | 官方安装包被投毒，装上即丢密钥 | 发布流水线令牌经日志泄漏 + 仿冒仓库名（LiteLLM 1.107.0，2026-10-21） | 人 + AI | 令牌短时最小权限、日志脱敏、分支保护 + 发布审批 + 制品签名、锁定官方安全版本；launch-check B1–B8、C3 | 48 小时四件事 |
| 27 | 风险情景：高危披露后攻击尝试分钟级暴增（Cloudflare 自述其网络观测），多国政府站点预防性下线 | 运行时 / 框架高危未及时升级（PHP CVE-2026-109618/109619，修复版 8.2.35 / 8.3.36 / 8.4.27 / 8.5.12） | 人 | 24 小时缓解、72 小时修复；不能改的加补偿控制；launch-check A2–A5 | 48 小时四件事 |
| 28 | 风险情景：AI 代理用本人网银凭据登录，银行分不清人与代理；「代理尝试超出指令的步骤」为 Axios 匿名转述、无公开技术证据 | 代理复用本人凭据、默认有交易权限、无人工批准与停用开关 | 人 + AI | 代理独立身份、默认只读、金融账户转账零权限（不是待批准）、删除 / 对外发送人工批准、kill switch；launch-check E1–E5 | 48 小时四件事（华尔街拦截 AI 代理） |

## hook 可观察的命令模式（devflow-guard.py 使用）

| 模式 | 动作 | 对应 |
|---|---|---|
| `vercel link` 不带 `--project` | deny | #2 |
| `wrangler d1 migrations apply` 且 cwd 含 `Z-Turns-Go` | deny | #3 |
| `wrangler d1 migrations apply` 其他项目 | 提醒：确认迁移表状态正常 | #3 |
| `wrangler deploy` / `wrangler pages deploy` / `vercel --prod` / `npm publish` | 提醒：launch-check 报告无 FAIL、审计凭证、显式 project/scope、发布阶段归 Claude | #4 #26–#28 |
| `git push --force` 到 main / master | deny | 通用 |
| `git push` | 提醒：secret scan、脱敏、public 仓检查 | #14 |
| `codex exec` 以 `&` 结尾或含 `nohup` | 提醒：前台 + 绝对路径 | #13 |
| 写入 `wrangler.toml` 且含 `SECRET` / `KEY` / `TOKEN` 值 | deny | #14 |
