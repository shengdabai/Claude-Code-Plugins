#!/usr/bin/env python3
"""devflow-guard.py — PreToolUse(Bash)：已知事故命令 → deny / ask / 提醒。

只覆盖它观察到的 Bash 字符串；npm run deploy 之类封装、MCP、平台 API、push 触发的自动部署看不到。
deny 只用于「已确认会造成事故且有明确替代」的模式；不确定的用 ask；其余提醒。
引用语境（echo / grep / cat / rg / 注释里出现命令）不触发。任何异常静默放行。关闭：DEVFLOW_OFF=1。
"""
import json
import os
import re
import sys


def out(decision=None, reason="", ctx=""):
    hso = {"hookEventName": "PreToolUse"}
    if decision:
        hso["permissionDecision"] = decision
        hso["permissionDecisionReason"] = reason
    if ctx:
        hso["additionalContext"] = ctx
    print(json.dumps({"hookSpecificOutput": hso}, ensure_ascii=False))


QUOTED = re.compile(r"^\s*(echo|printf|grep|rg|cat|sed\s+-n|less|head|tail|man)\b")


def main():
    if os.environ.get("DEVFLOW_OFF") == "1":
        return
    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {}
    if data.get("tool_name") != "Bash":
        return
    cmd = (data.get("tool_input") or {}).get("command") or ""
    cwd = data.get("cwd") or ""
    c = cmd.strip()
    if not c:
        return
    # 纯引用语境（echo / grep / cat 只读，且没有重定向写入）不触发
    if QUOTED.match(c) and not re.search(r"(?<!2)>{1,2}\s*[^&]", c):
        return

    # #2 裸 vercel link：ask（缺目标不等于一定错，但本机踩过坑）
    if re.search(r"\bvercel\s+link\b", c) and "--project" not in c:
        out("ask", "【devflow】裸 vercel link 曾在账户里凭空建空项目（daily-brief 事故）。"
                   "建议 vercel link --project <真名> --scope <team>；确认目录名就是项目名再放行。")
        return

    # #3 D1 migrations apply
    if re.search(r"\bwrangler\s+d1\s+migrations\s+apply\b", c):
        if "Z-Turns-Go" in cwd or "z-turns-go" in c.lower():
            out("deny", "【devflow 拉回】Z Turns Go 生产迁移表为空，migrations apply 会从 0001 重跑破坏数据。"
                        "该项目只能人工 wrangler d1 execute --remote --file migrations/XXXX.sql，先核 schema 与备份（D1 Time Travel 建恢复点）。")
            return
        out(ctx="【devflow 提醒】migrations apply 前：远端 d1_migrations 表记录与本地一致？恢复点已建？迁移表为空的旧项目不要 apply。")
        return

    # force push 到主分支
    if re.search(r"\bgit\s+push\b.*(--force\b|-f\b|--force-with-lease\b)", c) and re.search(r"\b(main|master)\b", c):
        out("deny", "【devflow 拉回】禁止 force push 到 main/master。回滚用 git revert。")
        return

    # #14 密钥写进 wrangler.toml
    if re.search(r"wrangler\.toml", c) and re.search(r"(?i)(secret|api_key|token|password)\s*=\s*['\"][A-Za-z0-9_\-]{12,}", c):
        out("deny", "【devflow 拉回】密钥不能写进 wrangler.toml [vars]（会进 git）。用 wrangler secret put <NAME>。")
        return

    # #4 发布类命令：提醒（Tony 的 ask 规则已覆盖确认弹窗）
    if re.search(r"\b(wrangler\s+(pages\s+)?deploy|vercel\s+(--prod|deploy)|npm\s+publish|gh\s+release\s+create|npm\s+run\s+(deploy|release)|pnpm\s+(deploy|release))\b", c):
        out(ctx="【devflow 提醒】发布四步：测试验收 → 受控生产 → 冒烟 → 开放流量。现在这条命令的精确目标 / 环境是？"
                "launch-check 报告（.omc/launch-check/）对应当前 HEAD 且无 FAIL？凭证（product-release-audit）对应当前产物？涉及迁移已有恢复点？部署归 Claude，Codex 只做发布后浏览器验证。")
        return

    # #14 git push 提醒
    if re.search(r"\bgit\s+push\b", c):
        out(ctx="【devflow 提醒】push 前检查本次将推送的提交范围（不只工作区）：无明文密钥；公开仓已脱敏（真名 / 绝对路径 / 内部 endpoint）。")
        return

    # #13 后台 codex / agy
    if re.search(r"\b(codex|agy)\b", c) and (re.search(r"&\s*$", c) or "nohup" in c):
        out(ctx="【devflow 提醒】codex / agy 后台跑会丢 PATH（exit 127）。前台 + 绝对路径 + stdin 传 prompt。")
        return


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
